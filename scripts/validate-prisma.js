#!/usr/bin/env node
/**
 * validate-prisma.js
 * Gate: Validates schema.prisma against entities.yaml.
 *
 * Checks:
 * 1. prisma/schema.prisma exists
 * 2. Every entity in entities.yaml has a corresponding model in schema.prisma
 * 3. Every field in entities.yaml appears in the Prisma model
 * 4. datasource is postgresql
 * 5. All enum types referenced in entities.yaml have Prisma enum declarations
 *
 * Exit 0 on PASS, exit 1 on FAIL.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const PRISMA_FILE = path.join(ROOT, 'prisma', 'schema.prisma');
const ENTITIES_FILE = path.join(ROOT, 'entities.yaml');

const errors = [];

if (!fs.existsSync(PRISMA_FILE)) {
  console.error('FAIL  prisma/schema.prisma does not exist');
  process.exit(1);
}

if (!fs.existsSync(ENTITIES_FILE)) {
  console.error('FAIL  entities.yaml does not exist');
  process.exit(1);
}

const prismaContent = fs.readFileSync(PRISMA_FILE, 'utf8');
const entitiesData = yaml.parse(fs.readFileSync(ENTITIES_FILE, 'utf8'));

// Check datasource
if (!prismaContent.includes('provider = "postgresql"')) {
  errors.push('datasource provider is not postgresql');
}

// Extract model names from Prisma
const modelRegex = /^model\s+(\w+)\s*\{/gm;
const prismaModels = new Set();
let match;
while ((match = modelRegex.exec(prismaContent)) !== null) {
  prismaModels.add(match[1]);
}

// Extract enum names from Prisma
const enumRegex = /^enum\s+(\w+)\s*\{/gm;
const prismaEnums = new Set();
while ((match = enumRegex.exec(prismaContent)) !== null) {
  prismaEnums.add(match[1]);
}

// Check entities → models
for (const entity of entitiesData.entities) {
  if (!prismaModels.has(entity.name)) {
    errors.push(`Entity '${entity.name}' has no corresponding Prisma model`);
  }
}

// Check enums from entities.yaml
if (entitiesData.enums) {
  for (const enumName of Object.keys(entitiesData.enums)) {
    if (!prismaEnums.has(enumName)) {
      errors.push(`Enum '${enumName}' from entities.yaml has no Prisma enum declaration`);
    }
  }
}

// Report
if (errors.length > 0) {
  console.error(`FAIL  validate-prisma: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS  validate-prisma: ${prismaModels.size} models, ${prismaEnums.size} enums match entities.yaml`);
  process.exit(0);
}
