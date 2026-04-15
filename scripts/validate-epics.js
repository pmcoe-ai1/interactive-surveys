#!/usr/bin/env node
/**
 * validate-epics.js
 * Gate: Runs after Step 3. Deterministic — zero AI, zero randomness.
 *
 * Checks:
 * 1. epics.yaml exists and is valid YAML
 * 2. Has epics array (non-empty)
 * 3. Every epic has id, name, jira_key, description
 * 4. No duplicate epic IDs
 * 5. Epic IDs match pattern E{N}
 * 6. Jira keys match pattern ISURV-{N}
 * 7. Descriptions are non-empty strings
 *
 * Exit 0 on PASS, exit 1 on FAIL with specific error messages.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const EPICS_FILE = path.join(ROOT, 'epics.yaml');

const errors = [];

// 1. File exists
if (!fs.existsSync(EPICS_FILE)) {
  console.error('FAIL  epics.yaml does not exist');
  process.exit(1);
}

let data;
try {
  data = yaml.parse(fs.readFileSync(EPICS_FILE, 'utf8'));
} catch (e) {
  console.error(`FAIL  epics.yaml is not valid YAML: ${e.message}`);
  process.exit(1);
}

// 2. Has epics array
if (!data || !Array.isArray(data.epics) || data.epics.length === 0) {
  console.error('FAIL  epics.yaml has no epics array or it is empty');
  process.exit(1);
}

// 3-7. Validate each epic
const epicIds = new Set();

for (const epic of data.epics) {
  if (!epic.id) errors.push('Epic missing id');
  if (!epic.name) errors.push(`Epic ${epic.id || '?'} missing name`);
  if (!epic.jira_key) errors.push(`Epic ${epic.id || '?'} missing jira_key`);
  if (!epic.description || epic.description.trim().length === 0) {
    errors.push(`Epic ${epic.id || '?'} missing or empty description`);
  }

  if (epic.id) {
    if (epicIds.has(epic.id)) errors.push(`Duplicate epic ID: ${epic.id}`);
    epicIds.add(epic.id);

    if (!/^E\d+$/.test(epic.id)) {
      errors.push(`Epic ID '${epic.id}' does not match pattern E{N}`);
    }
  }

  if (epic.jira_key && !/^ISURV-\d+$/.test(epic.jira_key)) {
    errors.push(`Epic ${epic.id}: jira_key '${epic.jira_key}' does not match pattern ISURV-{N}`);
  }
}

// Report
if (errors.length > 0) {
  console.error(`FAIL  validate-epics: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS  validate-epics: ${data.epics.length} epics, all have id/name/jira_key/description`);
  process.exit(0);
}
