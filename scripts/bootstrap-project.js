#!/usr/bin/env node
/**
 * bootstrap-project.js
 * Sets up the project for sprint execution:
 * 1. Ensures package.json has all required deps
 * 2. Writes tsconfig.json
 * 3. Writes jest.config.js
 * 4. Creates src/app.ts if missing
 * 5. Runs: npm install, prisma generate, tsc --noEmit, jest --passWithNoTests
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
    return true;
  } catch (e) {
    if (opts.warnOnly) {
      console.log(`  WARN: ${cmd} failed (non-fatal)`);
      return false;
    }
    throw e;
  }
}

// 1. Ensure package.json deps
console.log('\n=== 1. Checking package.json dependencies ===');
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const runtimeDeps = {
  'express': '^4.18.2',
  '@prisma/client': '^5.0.0'
};

const devDeps = {
  'typescript': '^5.0.0',
  'ts-jest': '^29.0.0',
  'jest': '^29.0.0',
  '@types/jest': '^29.0.0',
  'supertest': '^6.0.0',
  '@types/supertest': '^2.0.0',
  '@types/express': '^4.0.0',
  'prisma': '^5.0.0',
  'testcontainers': '^10.0.0',
  '@testcontainers/postgresql': '^10.0.0',
  'ts-node': '^10.0.0'
};

if (!pkg.dependencies) pkg.dependencies = {};
if (!pkg.devDependencies) pkg.devDependencies = {};

let depsChanged = false;
for (const [dep, ver] of Object.entries(runtimeDeps)) {
  if (!pkg.dependencies[dep]) {
    pkg.dependencies[dep] = ver;
    console.log(`  + ${dep} (runtime)`);
    depsChanged = true;
  }
}
for (const [dep, ver] of Object.entries(devDeps)) {
  if (!pkg.devDependencies[dep]) {
    pkg.devDependencies[dep] = ver;
    console.log(`  + ${dep} (dev)`);
    depsChanged = true;
  }
}

if (depsChanged) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('  package.json updated');
} else {
  console.log('  all deps present');
}

// 2. Write tsconfig.json
console.log('\n=== 2. Writing tsconfig.json ===');
const tsconfig = {
  compilerOptions: {
    target: 'ES2020',
    module: 'commonjs',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    outDir: './dist',
    rootDir: '.',
    declaration: true,
    resolveJsonModule: true,
    types: ['jest', 'node']
  },
  include: ['src/**/*', 'tests/**/*'],
  exclude: ['node_modules', 'dist']
};
fs.writeFileSync(path.join(ROOT, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
console.log('  tsconfig.json written');

// 3. Write jest.config.js
console.log('\n=== 3. Writing jest.config.js ===');
const jestConfig = `/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/sprint-results/', '/dist/'],
  testTimeout: 60000,
  forceExit: true,
};
`;
fs.writeFileSync(path.join(ROOT, 'jest.config.js'), jestConfig);
console.log('  jest.config.js written');

// 4. Create src/app.ts if missing
console.log('\n=== 4. Checking src/app.ts ===');
const srcDir = path.join(ROOT, 'src');
const appFile = path.join(srcDir, 'app.ts');
if (!fs.existsSync(appFile)) {
  fs.mkdirSync(srcDir, { recursive: true });
  const appTs = `import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw\`SELECT 1\`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
  });
}

export { app, prisma };
`;
  fs.writeFileSync(appFile, appTs);
  console.log('  src/app.ts created');
} else {
  console.log('  src/app.ts exists');
}

// 5. npm install
console.log('\n=== 5. npm install ===');
run('npm install');

// 6. prisma generate
console.log('\n=== 6. prisma generate ===');
run('npx prisma generate');

// 7. tsc --noEmit (warn only)
console.log('\n=== 7. tsc --noEmit (warn-only) ===');
run('npx tsc --noEmit', { warnOnly: true });

// 8. jest --passWithNoTests
console.log('\n=== 8. jest --passWithNoTests ===');
run('npx jest --passWithNoTests', { warnOnly: true });

console.log('\n=== BOOTSTRAP COMPLETE ===');
