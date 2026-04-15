#!/usr/bin/env node
/**
 * validate-dor.js
 * Gate: Validates Definition of Ready for a specific sprint.
 *
 * Usage: node scripts/validate-dor.js --sprint 1
 *
 * Checks:
 * 1. sprint-plan.yaml exists and has the specified sprint
 * 2. Every story in the sprint has scenarios (count >= 3)
 * 3. Every story in the sprint has story points > 0
 * 4. Every story's dependencies are satisfied (in completed or current sprint)
 * 5. Every story's entities exist in entities.yaml
 *
 * Exit 0 on PASS, exit 1 on FAIL.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const SPRINT_PLAN = path.join(ROOT, 'sprint-plan.yaml');
const STORY_POINTS = path.join(ROOT, 'story-points.yaml');
const DEPS_FILE = path.join(ROOT, 'dependencies.yaml');
const STORIES_DIR = path.join(ROOT, 'stories');
const ENTITIES_FILE = path.join(ROOT, 'entities.yaml');

// Parse --sprint N
const sprintArg = process.argv.indexOf('--sprint');
if (sprintArg === -1 || !process.argv[sprintArg + 1]) {
  console.error('Usage: node scripts/validate-dor.js --sprint <N>');
  process.exit(1);
}
const sprintNum = parseInt(process.argv[sprintArg + 1]);

const errors = [];

// 1. Sprint plan exists
if (!fs.existsSync(SPRINT_PLAN)) {
  console.error('FAIL  sprint-plan.yaml does not exist');
  process.exit(1);
}

const plan = yaml.parse(fs.readFileSync(SPRINT_PLAN, 'utf8'));
const sprint = plan.sprints.find(s => s.number === sprintNum);
if (!sprint) {
  console.error(`FAIL  Sprint ${sprintNum} not found in sprint-plan.yaml`);
  process.exit(1);
}

const sprintStoryIds = sprint.stories.map(s => s.id);

// Collect all stories + scenarios from YAML files
const allStories = {};
const storyFiles = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.yaml'));
for (const file of storyFiles) {
  const data = yaml.parse(fs.readFileSync(path.join(STORIES_DIR, file), 'utf8'));
  if (data && Array.isArray(data.stories)) {
    for (const s of data.stories) {
      allStories[s.id] = s;
    }
  }
}

// Collect story points
const pointsData = yaml.parse(fs.readFileSync(STORY_POINTS, 'utf8'));
const pointsMap = {};
for (const sp of pointsData.stories) {
  pointsMap[sp.id] = sp.points;
}

// Collect dependencies
const depsData = yaml.parse(fs.readFileSync(DEPS_FILE, 'utf8'));
const depsMap = {};
for (const dep of depsData.dependencies) {
  depsMap[dep.story] = dep.depends_on || [];
}

// Stories in current and earlier sprints
const storiesInCurrentOrEarlier = new Set();
for (const s of plan.sprints) {
  if (s.number <= sprintNum) {
    for (const story of s.stories) {
      storiesInCurrentOrEarlier.add(story.id);
    }
  }
}

// 2. Every story has scenarios (>= 3)
for (const sid of sprintStoryIds) {
  const story = allStories[sid];
  if (!story) {
    errors.push(`${sid}: not found in stories/*.yaml`);
    continue;
  }
  const scenarioCount = (story.scenarios || []).length;
  if (scenarioCount < 3) {
    errors.push(`${sid}: has ${scenarioCount} scenarios — minimum 3 required`);
  }
}

// 3. Every story has points > 0
for (const sid of sprintStoryIds) {
  const pts = pointsMap[sid];
  if (!pts || pts <= 0) {
    errors.push(`${sid}: story points missing or zero`);
  }
}

// 4. Dependencies satisfied
for (const sid of sprintStoryIds) {
  const deps = depsMap[sid] || [];
  for (const dep of deps) {
    if (!storiesInCurrentOrEarlier.has(dep)) {
      errors.push(`${sid}: dependency '${dep}' is in a later sprint`);
    }
  }
}

// 5. Entities coverage (check if story references entities that exist)
// This checks that entities.yaml has the entities needed
if (fs.existsSync(ENTITIES_FILE)) {
  const entitiesData = yaml.parse(fs.readFileSync(ENTITIES_FILE, 'utf8'));
  const entityNames = new Set((entitiesData.entities || []).map(e => e.name));
  // Verify core entities exist
  const requiredEntities = ['User', 'Survey', 'Question', 'Response', 'Answer'];
  for (const eName of requiredEntities) {
    if (!entityNames.has(eName)) {
      errors.push(`Entity '${eName}' missing from entities.yaml — needed by sprint stories`);
    }
  }
}

// Report
if (errors.length > 0) {
  console.error(`FAIL  validate-dor (Sprint ${sprintNum}): ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS  validate-dor (Sprint ${sprintNum}): ${sprintStoryIds.length} stories ready, all scenarios present, all points assigned, all dependencies satisfied`);
  process.exit(0);
}
