#!/usr/bin/env node
/**
 * validate-brd.js
 * Gate: Validates BRD skeleton against stories and entities.
 *
 * Checks:
 * 1. brd-skeleton.yaml exists and parses
 * 2. header has domain, date, author, version
 * 3. features[] count matches epics count (10)
 * 4. intents[] count matches stories count (50)
 * 5. Every intent has featureRef pointing to a valid feature
 * 6. Every intent has storyRef pointing to a valid story ID
 * 7. Every intent has jiraKey
 * 8. scenarios[] exist (at least E1 scenarios present)
 * 9. glossary[] has entries for each entity
 * 10. unfilled_sections lists the 9 deferred sections
 *
 * Exit 0 on PASS, exit 1 on FAIL.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const BRD_FILE = path.join(ROOT, 'brd-skeleton.yaml');
const STORIES_DIR = path.join(ROOT, 'stories');

const errors = [];

if (!fs.existsSync(BRD_FILE)) {
  console.error('FAIL  brd-skeleton.yaml does not exist');
  process.exit(1);
}

let brd;
try {
  brd = yaml.parse(fs.readFileSync(BRD_FILE, 'utf8'));
} catch (e) {
  console.error(`FAIL  brd-skeleton.yaml: invalid YAML: ${e.message}`);
  process.exit(1);
}

// Collect story IDs
const storyIds = new Set();
const storyFiles = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.yaml'));
for (const file of storyFiles) {
  const data = yaml.parse(fs.readFileSync(path.join(STORIES_DIR, file), 'utf8'));
  if (data && Array.isArray(data.stories)) {
    for (const s of data.stories) storyIds.add(s.id);
  }
}

// 2. Header
if (!brd.header) errors.push('missing header');
else {
  if (!brd.header.domain) errors.push('header missing domain');
  if (!brd.header.date) errors.push('header missing date');
  if (!brd.header.author) errors.push('header missing author');
  if (!brd.header.version) errors.push('header missing version');
}

// 3. Features
const featureIds = new Set();
if (!Array.isArray(brd.features) || brd.features.length < 10) {
  errors.push(`features: expected 10, got ${(brd.features || []).length}`);
} else {
  for (const f of brd.features) featureIds.add(f.id);
}

// 4+5+6+7. Intents
if (!Array.isArray(brd.intents) || brd.intents.length < 50) {
  errors.push(`intents: expected 50, got ${(brd.intents || []).length}`);
}
for (const intent of (brd.intents || [])) {
  if (!intent.featureRef || !featureIds.has(intent.featureRef)) {
    errors.push(`intent ${intent.id}: invalid featureRef '${intent.featureRef}'`);
  }
  if (!intent.storyRef || !storyIds.has(intent.storyRef)) {
    errors.push(`intent ${intent.id}: invalid storyRef '${intent.storyRef}'`);
  }
  if (!intent.jiraKey) {
    errors.push(`intent ${intent.id}: missing jiraKey`);
  }
}

// 8. Scenarios
if (!Array.isArray(brd.scenarios) || brd.scenarios.length < 20) {
  errors.push(`scenarios: expected at least 20, got ${(brd.scenarios || []).length}`);
}

// 9. Glossary
if (!Array.isArray(brd.glossary) || brd.glossary.length < 8) {
  errors.push(`glossary: expected at least 8 entries, got ${(brd.glossary || []).length}`);
}

// 10. Unfilled sections
if (!Array.isArray(brd.unfilled_sections) || brd.unfilled_sections.length < 9) {
  errors.push(`unfilled_sections: expected 9 deferred sections, got ${(brd.unfilled_sections || []).length}`);
}

// Report
if (errors.length > 0) {
  console.error(`FAIL  validate-brd: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS  validate-brd: ${brd.features.length} features, ${brd.intents.length} intents, ${brd.scenarios.length} scenarios, ${brd.glossary.length} glossary terms, ${brd.unfilled_sections.length} deferred sections`);
  process.exit(0);
}
