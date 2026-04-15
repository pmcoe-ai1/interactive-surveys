#!/usr/bin/env node
/**
 * validate-entities.js
 * Gate: Runs after Step 4a. Deterministic — zero AI.
 *
 * Checks:
 * 1. entities.yaml exists and parses
 * 2. Every entity has name, description, source_stories, fields, relationships
 * 3. Every field has name and type
 * 4. All source_stories reference valid story IDs from stories/*.yaml
 * 5. All relationship targets reference valid entity names
 * 6. No duplicate entity names
 * 7. No duplicate field names within an entity
 * 8. Every entity has an id field marked primary
 * 9. Every entity has createdAt
 * 10. lifecycle_states reference valid entities
 * 11. enums section exists
 *
 * Exit 0 on PASS, exit 1 on FAIL.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const ENTITIES_FILE = path.join(ROOT, 'entities.yaml');
const STORIES_DIR = path.join(ROOT, 'stories');

const errors = [];

// Collect all story IDs
const storyIds = new Set();
const storyFiles = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.yaml'));
for (const file of storyFiles) {
  const data = yaml.parse(fs.readFileSync(path.join(STORIES_DIR, file), 'utf8'));
  if (data && Array.isArray(data.stories)) {
    for (const s of data.stories) {
      if (s.id) storyIds.add(s.id);
    }
  }
}

// Parse entities
if (!fs.existsSync(ENTITIES_FILE)) {
  console.error('FAIL  entities.yaml does not exist');
  process.exit(1);
}

let data;
try {
  data = yaml.parse(fs.readFileSync(ENTITIES_FILE, 'utf8'));
} catch (e) {
  console.error(`FAIL  entities.yaml: invalid YAML: ${e.message}`);
  process.exit(1);
}

if (!data || !Array.isArray(data.entities) || data.entities.length === 0) {
  console.error('FAIL  entities.yaml: no entities array');
  process.exit(1);
}

const entityNames = new Set();
let totalFields = 0;
let totalRelationships = 0;

for (const entity of data.entities) {
  const eName = entity.name || '?';

  // Required top-level fields
  if (!entity.name) errors.push(`Entity missing name`);
  if (!entity.description) errors.push(`${eName}: missing description`);
  if (!Array.isArray(entity.source_stories)) errors.push(`${eName}: missing source_stories`);
  if (!Array.isArray(entity.fields)) errors.push(`${eName}: missing fields`);
  if (!Array.isArray(entity.relationships)) errors.push(`${eName}: missing relationships`);

  // Duplicate entity name
  if (entityNames.has(eName)) errors.push(`Duplicate entity name: ${eName}`);
  entityNames.add(eName);

  // Validate source_stories
  for (const sid of (entity.source_stories || [])) {
    if (!storyIds.has(sid)) {
      errors.push(`${eName}: source_story '${sid}' not found in stories/*.yaml`);
    }
  }

  // Validate fields
  const fieldNames = new Set();
  let hasId = false;
  let hasCreatedAt = false;

  for (const field of (entity.fields || [])) {
    if (!field.name) errors.push(`${eName}: field missing name`);
    if (!field.type) errors.push(`${eName}: field '${field.name || '?'}' missing type`);

    if (field.name) {
      if (fieldNames.has(field.name)) errors.push(`${eName}: duplicate field '${field.name}'`);
      fieldNames.add(field.name);
      if (field.name === 'id' && field.primary) hasId = true;
      if (field.name === 'createdAt') hasCreatedAt = true;
    }
    totalFields++;
  }

  if (!hasId) errors.push(`${eName}: no 'id' field marked primary`);
  if (!hasCreatedAt) errors.push(`${eName}: no 'createdAt' field`);

  // Validate relationships
  for (const rel of (entity.relationships || [])) {
    totalRelationships++;
  }
}

// Validate relationship targets (second pass after collecting all names)
for (const entity of data.entities) {
  for (const rel of (entity.relationships || [])) {
    if (rel.target && !entityNames.has(rel.target)) {
      errors.push(`${entity.name}: relationship target '${rel.target}' is not a known entity`);
    }
  }
}

// Lifecycle states
if (data.lifecycle_states) {
  for (const [entityName, lc] of Object.entries(data.lifecycle_states)) {
    if (!entityNames.has(entityName)) {
      errors.push(`lifecycle_states: entity '${entityName}' not found`);
    }
  }
}

// Enums
if (!data.enums) {
  errors.push('Missing enums section');
}

// Report
if (errors.length > 0) {
  console.error(`FAIL  validate-entities: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS  validate-entities: ${entityNames.size} entities, ${totalFields} fields, ${totalRelationships} relationships`);
  process.exit(0);
}
