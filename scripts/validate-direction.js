#!/usr/bin/env node
/**
 * validate-direction.js
 * Gate: Runs after Step 1. Deterministic — zero AI, zero randomness.
 *
 * Checks:
 * 1. direction.md exists
 * 2. Has 6 required sections (headings)
 * 3. "Core capabilities" section is non-empty
 * 4. File is at least 20 lines long
 * 5. No empty required sections
 *
 * Exit 0 on PASS, exit 1 on FAIL with specific error messages.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRECTION_FILE = path.join(ROOT, 'direction.md');

const errors = [];

// 1. File exists
if (!fs.existsSync(DIRECTION_FILE)) {
  console.error('FAIL  direction.md does not exist');
  process.exit(1);
}

const content = fs.readFileSync(DIRECTION_FILE, 'utf8');
const lines = content.split('\n');

// 2. Line count
if (lines.length < 20) {
  errors.push(`direction.md has ${lines.length} lines — minimum 20 required`);
}

// 3. Required sections (## headings)
const requiredSections = [
  'What system do you want to build',
  'Core capabilities',
  'Constraints and technologies',
  'Users',
  'Integrations',
  'Differentiator'
];

const headings = lines
  .filter(l => /^##\s/.test(l))
  .map(l => l.replace(/^##\s+/, '').trim().toLowerCase());

for (const section of requiredSections) {
  const found = headings.some(h => h.includes(section.toLowerCase()));
  if (!found) {
    errors.push(`Missing required section: "${section}"`);
  }
}

// 4. Core capabilities section has content
const capIdx = lines.findIndex(l => /^##.*core capabilities/i.test(l));
if (capIdx >= 0) {
  let hasContent = false;
  for (let i = capIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    if (lines[i].trim().length > 0) { hasContent = true; break; }
  }
  if (!hasContent) {
    errors.push('"Core capabilities" section is empty');
  }
}

// 5. No empty required sections
for (const section of requiredSections) {
  const idx = lines.findIndex(l => {
    const h = l.replace(/^##\s+/, '').trim().toLowerCase();
    return /^##\s/.test(l) && h.includes(section.toLowerCase());
  });
  if (idx >= 0) {
    let hasContent = false;
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) break;
      if (lines[i].trim().length > 0) { hasContent = true; break; }
    }
    if (!hasContent) {
      errors.push(`Section "${section}" is empty`);
    }
  }
}

// Report
if (errors.length > 0) {
  console.error(`FAIL  validate-direction: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS  validate-direction: ${headings.length} sections, ${lines.length} lines, all required sections present`);
  process.exit(0);
}
