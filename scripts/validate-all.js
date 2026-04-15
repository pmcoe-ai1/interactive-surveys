#!/usr/bin/env node
/**
 * validate-all.js
 * Runs all validation gates in sequence. ALL must PASS.
 *
 * Usage:
 *   node scripts/validate-all.js [--skip-jira] [--sprint N]
 *
 * Exit 0 if ALL gates pass, exit 1 if any fail.
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const skipJira = args.includes('--skip-jira');
const sprintIdx = args.indexOf('--sprint');
const sprintNum = sprintIdx >= 0 ? args[sprintIdx + 1] : null;

const jiraFlag = skipJira ? ' --skip-jira' : '';

const gates = [
  { name: 'validate-direction', cmd: `node scripts/validate-direction.js` },
  { name: 'validate-epics', cmd: `node scripts/validate-epics.js${jiraFlag}` },
  { name: 'validate-stories', cmd: `node scripts/validate-stories.js${jiraFlag}` },
  { name: 'validate-entities', cmd: `node scripts/validate-entities.js` },
  { name: 'validate-prisma', cmd: `node scripts/validate-prisma.js` },
  { name: 'validate-brd', cmd: `node scripts/validate-brd.js` },
];

// Add sprint-specific DoR check if sprint number provided
if (sprintNum) {
  gates.push({
    name: `validate-dor (sprint ${sprintNum})`,
    cmd: `node scripts/validate-dor.js --sprint ${sprintNum}`
  });
}

let passed = 0;
let failed = 0;
const failures = [];

console.log(`Running ${gates.length} validation gates...\n`);

for (const gate of gates) {
  try {
    const output = execSync(gate.cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    console.log(`  PASS  ${gate.name}`);
    if (output.trim()) console.log(`        ${output.trim()}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${gate.name}`);
    const stderr = (err.stderr || '').trim();
    const stdout = (err.stdout || '').trim();
    const msg = stderr || stdout || 'unknown error';
    console.log(`        ${msg.split('\n').join('\n        ')}`);
    failed++;
    failures.push({ name: gate.name, message: msg });
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed out of ${gates.length} gates`);
console.log(`${'═'.repeat(60)}`);

if (failed > 0) {
  console.error(`\nBLOCKED: ${failed} gate(s) failed. Fix before proceeding.`);
  process.exit(1);
} else {
  console.log(`\nALL GATES PASS. Ready for sprint execution.`);
  process.exit(0);
}
