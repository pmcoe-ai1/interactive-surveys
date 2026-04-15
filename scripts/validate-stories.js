#!/usr/bin/env node
/**
 * validate-stories.js
 * Gate: Runs after Step 4. Deterministic — zero AI, zero randomness.
 *
 * Checks:
 * 1. stories/*.yaml files exist (at least one)
 * 2. Every story has id, jira_key, epic, title, as_a, i_want, so_that
 * 3. Every story has at least 3 scenarios
 * 4. Every scenario has id, given, when, then
 * 5. No duplicate story IDs across all files
 * 6. No duplicate scenario IDs across all files
 * 7. Story IDs match pattern S{N}.{M}
 * 8. Scenario IDs match pattern SC{N}.{M}.{P}
 * 9. dependencies.yaml exists and references valid story IDs
 * 10. No circular dependencies
 *
 * Flags: --skip-jira  (skip Jira verification)
 *
 * Exit 0 on PASS, exit 1 on FAIL with specific error messages.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const STORIES_DIR = path.join(ROOT, 'stories');
const DEPS_FILE = path.join(ROOT, 'dependencies.yaml');
const skipJira = process.argv.includes('--skip-jira');

const errors = [];

// 1. Stories directory exists and has files
if (!fs.existsSync(STORIES_DIR)) {
  console.error('FAIL  stories/ directory does not exist');
  process.exit(1);
}

const storyFiles = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.yaml'));
if (storyFiles.length === 0) {
  console.error('FAIL  stories/ directory has no YAML files');
  process.exit(1);
}

// Collect all stories
const allStories = [];
const storyIds = new Set();
const scenarioIds = new Set();
let totalScenarios = 0;

for (const file of storyFiles) {
  const filePath = path.join(STORIES_DIR, file);
  let data;
  try {
    data = yaml.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    errors.push(`${file}: invalid YAML: ${e.message}`);
    continue;
  }

  if (!data || !Array.isArray(data.stories) || data.stories.length === 0) {
    errors.push(`${file}: no stories array or it is empty`);
    continue;
  }

  for (const story of data.stories) {
    // Required fields
    if (!story.id) errors.push(`${file}: story missing id`);
    if (!story.jira_key) errors.push(`${file}: story ${story.id || '?'} missing jira_key`);
    if (!story.epic) errors.push(`${file}: story ${story.id || '?'} missing epic`);
    if (!story.title) errors.push(`${file}: story ${story.id || '?'} missing title`);
    if (!story.as_a) errors.push(`${file}: story ${story.id || '?'} missing as_a`);
    if (!story.i_want) errors.push(`${file}: story ${story.id || '?'} missing i_want`);
    if (!story.so_that) errors.push(`${file}: story ${story.id || '?'} missing so_that`);

    // ID pattern
    if (story.id && !/^S\d+\.\d+$/.test(story.id)) {
      errors.push(`${file}: story ID '${story.id}' does not match pattern S{N}.{M}`);
    }

    // Duplicate check
    if (story.id) {
      if (storyIds.has(story.id)) errors.push(`Duplicate story ID: ${story.id}`);
      storyIds.add(story.id);
    }

    allStories.push(story);

    // Scenarios
    if (!Array.isArray(story.scenarios) || story.scenarios.length < 3) {
      errors.push(`${file}: story ${story.id} has ${(story.scenarios || []).length} scenarios — minimum 3 required`);
    }

    for (const sc of (story.scenarios || [])) {
      if (!sc.id) errors.push(`${file}: story ${story.id}: scenario missing id`);
      if (!sc.given) errors.push(`${file}: story ${story.id}: scenario ${sc.id || '?'} missing given`);
      if (!sc.when) errors.push(`${file}: story ${story.id}: scenario ${sc.id || '?'} missing when`);
      if (!sc.then) errors.push(`${file}: story ${story.id}: scenario ${sc.id || '?'} missing then`);

      if (sc.id && !/^SC\d+\.\d+\.\d+$/.test(sc.id)) {
        errors.push(`${file}: scenario ID '${sc.id}' does not match pattern SC{N}.{M}.{P}`);
      }

      if (sc.id) {
        if (scenarioIds.has(sc.id)) errors.push(`Duplicate scenario ID: ${sc.id}`);
        scenarioIds.add(sc.id);
      }

      totalScenarios++;
    }
  }
}

// 9. Dependencies
if (!fs.existsSync(DEPS_FILE)) {
  errors.push('dependencies.yaml does not exist');
} else {
  let depsData;
  try {
    depsData = yaml.parse(fs.readFileSync(DEPS_FILE, 'utf8'));
  } catch (e) {
    errors.push(`dependencies.yaml: invalid YAML: ${e.message}`);
  }

  if (depsData && Array.isArray(depsData.dependencies)) {
    const depStoryIds = new Set();
    for (const dep of depsData.dependencies) {
      if (!dep.story) {
        errors.push('dependencies.yaml: entry missing story field');
        continue;
      }
      if (!storyIds.has(dep.story)) {
        errors.push(`dependencies.yaml: story '${dep.story}' not found in stories/*.yaml`);
      }
      depStoryIds.add(dep.story);
      for (const prereq of (dep.depends_on || [])) {
        if (!storyIds.has(prereq)) {
          errors.push(`dependencies.yaml: dependency '${prereq}' (required by ${dep.story}) not found in stories/*.yaml`);
        }
      }
    }

    // 10. Circular dependency check (simple DFS)
    const adjList = {};
    for (const dep of depsData.dependencies) {
      adjList[dep.story] = dep.depends_on || [];
    }

    const visited = new Set();
    const inStack = new Set();

    function hasCycle(node) {
      if (inStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      inStack.add(node);
      for (const dep of (adjList[node] || [])) {
        if (hasCycle(dep)) {
          errors.push(`Circular dependency detected involving: ${node} → ${dep}`);
          return true;
        }
      }
      inStack.delete(node);
      return false;
    }

    for (const node of Object.keys(adjList)) {
      hasCycle(node);
    }
  }
}

// Report
if (errors.length > 0) {
  console.error(`FAIL  validate-stories: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS  validate-stories: ${storyFiles.length} files, ${storyIds.size} stories, ${totalScenarios} scenarios, ${skipJira ? 'Jira skipped' : 'Jira verified'}`);
  process.exit(0);
}
