#!/usr/bin/env node
/**
 * check-route-parity.js
 *
 * Deterministic guard that compares the Express test helper routes against the
 * real Next.js API routes. Runs before Jest in the test-run CI job.
 *
 * Usage:
 *   node scripts/check-route-parity.js --sprint 3
 *
 * Exit 0 — all checks pass.
 * Exit 1 — one or more failures printed to stderr with file:line references.
 *
 * Three checks:
 *   Check 1  Route existence + HTTP verb export  (catches missing route files)
 *   Check 2a Forward parity: helper codes ⊆ route codes  (catches wrong catch-block status)
 *   Check 2b Reverse parity: route codes ⊆ helper codes  (catches untested production branches)
 *   Check 3  Synthetic stub detection  (catches inline express() in test files)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const sprintIdx = args.indexOf('--sprint');
if (sprintIdx === -1 || !args[sprintIdx + 1]) {
  console.error('Usage: node scripts/check-route-parity.js --sprint <N>');
  process.exit(1);
}
const SPRINT = args[sprintIdx + 1];
const ROOT   = path.resolve(__dirname, '..');

const HELPER_PATH  = path.join(ROOT, `tests/sprint-${SPRINT}/helpers/app.ts`);
const TESTS_DIR    = path.join(ROOT, `tests/sprint-${SPRINT}`);
const NEXTJS_ROOT  = path.join(ROOT, 'src/app');

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Return 1-based line number for character index `idx` in `src`. */
function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

/**
 * Brace-counting body extractor.
 * `braceIdx` must be the index of an opening `{` in `src`.
 * Returns the substring from `{` to the matching `}` (inclusive).
 */
function extractBody(src, braceIdx) {
  let depth = 0;
  for (let i = braceIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(braceIdx, i + 1);
    }
  }
  // Fallback: return to end of file (should not happen on valid TS)
  return src.slice(braceIdx);
}

// ─── Route extraction from Express helper ────────────────────────────────────

/**
 * Parse the Express helper file and return all route registrations.
 * Returns: [{ method, expressPath, body, line }]
 */
function parseHelperRoutes(helperSrc) {
  const routes = [];
  // Match:  app.METHOD('/path',   or  app.METHOD("/path",
  const re = /app\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi;
  let match;
  while ((match = re.exec(helperSrc)) !== null) {
    const method      = match[1].toUpperCase();
    const expressPath = match[2];
    const afterMatch  = match.index + match[0].length;

    // Find the arrow function opening brace `=> {`
    const arrowIdx = helperSrc.indexOf('=>', afterMatch);
    if (arrowIdx === -1) continue;
    const braceIdx = helperSrc.indexOf('{', arrowIdx + 2);
    if (braceIdx === -1) continue;

    const body = extractBody(helperSrc, braceIdx);
    routes.push({
      method,
      expressPath,
      body,
      line: lineOf(helperSrc, match.index),
    });
  }
  return routes;
}

// ─── Path mapping ─────────────────────────────────────────────────────────────

/**
 * Convert an Express path to the expected Next.js route.ts file path.
 * /api/surveys/:id/responses → src/app/api/surveys/[id]/responses/route.ts
 */
function expressToNextjsFile(expressPath) {
  const mapped = expressPath.replace(/:([a-zA-Z]+)/g, '[$1]');
  return path.join(NEXTJS_ROOT, mapped, 'route.ts');
}

// ─── Status code extraction ───────────────────────────────────────────────────

/**
 * Extract 4xx/5xx status codes from an Express handler body.
 * Looks for explicit `res.status(N)` calls in the handler body.
 * Also follows `requireAuth(` calls — that helper function always emits 401.
 */
function extractHelperCodes(body, helperSrc) {
  const codes = new Set();
  const re = /\.status\s*\(\s*(\d+)\s*\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const code = parseInt(m[1], 10);
    if (code >= 400) codes.add(code);
  }

  // Follow requireAuth() calls — the function body always emits res.status(401)
  if (/\brequireAuth\s*\(/.test(body) && helperSrc) {
    const fnMarker = 'function requireAuth(';
    const fnIdx    = helperSrc.indexOf(fnMarker);
    if (fnIdx !== -1) {
      const braceIdx = helperSrc.indexOf('{', fnIdx + fnMarker.length);
      if (braceIdx !== -1) {
        const fnBody = extractBody(helperSrc, braceIdx);
        const re2 = /\.status\s*\(\s*(\d+)\s*\)/g;
        let m2;
        while ((m2 = re2.exec(fnBody)) !== null) {
          const code = parseInt(m2[1], 10);
          if (code >= 400) codes.add(code);
        }
      }
    }
  }

  return codes;
}

/**
 * Extract 4xx/5xx status codes from a Next.js route handler body.
 * Handles both:
 *   { status: 404 }          — literal
 *   { status }               — shorthand variable, traced to ternary declaration
 */
function extractRouteCodes(body) {
  const codes = new Set();

  // Literal: { status: N }
  const literalRe = /\{\s*status\s*:\s*(\d+)\s*\}/g;
  let m;
  while ((m = literalRe.exec(body)) !== null) {
    const code = parseInt(m[1], 10);
    if (code >= 400) codes.add(code);
  }

  // Shorthand { status } — trace to `const status = condition ? N1 : N2`
  if (/\{\s*status\s*\}/.test(body)) {
    const ternaryRe = /const\s+status\s*=\s*[^?]+\?\s*(\d+)\s*:\s*(\d+)/g;
    while ((m = ternaryRe.exec(body)) !== null) {
      const c1 = parseInt(m[1], 10);
      const c2 = parseInt(m[2], 10);
      if (c1 >= 400) codes.add(c1);
      if (c2 >= 400) codes.add(c2);
    }
  }

  return codes;
}

/**
 * Find and extract the body of a specific exported handler in a Next.js route file.
 * e.g., method='GET' finds `export async function GET(` and returns its body.
 * Returns null if the handler is not found.
 *
 * Uses paren-counting to skip past the parameter list (which may contain destructuring
 * like `{ params }`) before finding the opening `{` of the function body.
 */
function extractRouteHandler(routeSrc, method) {
  const marker = `export async function ${method}(`;
  const fnIdx  = routeSrc.indexOf(marker);
  if (fnIdx === -1) return null;

  // Find the closing ) of the parameter list by paren-counting from the opening (
  let parenDepth = 0;
  let i = fnIdx + marker.length - 1; // position of the opening (
  while (i < routeSrc.length) {
    if (routeSrc[i] === '(') parenDepth++;
    else if (routeSrc[i] === ')') {
      parenDepth--;
      if (parenDepth === 0) break;
    }
    i++;
  }

  // Find the opening { of the function body after the closing )
  const braceIdx = routeSrc.indexOf('{', i + 1);
  if (braceIdx === -1) return null;

  return extractBody(routeSrc, braceIdx);
}

/**
 * Some routes in the helper are served as Next.js pages (not API routes).
 * e.g., GET /api/s/:slug → src/app/s/[slug]/page.tsx
 * Strip the /api prefix, map params, and check for a page.tsx at that path.
 */
function hasPageEquivalent(expressPath) {
  const withoutApi = expressPath.replace(/^\/api/, '');
  const mapped     = withoutApi.replace(/:([a-zA-Z]+)/g, '[$1]');
  const pagePath   = path.join(ROOT, 'src/app', mapped, 'page.tsx');
  return fs.existsSync(pagePath);
}

// ─── Check 1: Route existence + HTTP verb export ──────────────────────────────

function check1(routes, helperRelPath) {
  const failures = [];

  for (const { method, expressPath, line } of routes) {
    const nextjsFile    = expressToNextjsFile(expressPath);
    const nextjsRelPath = path.relative(ROOT, nextjsFile);

    if (!fs.existsSync(nextjsFile)) {
      // Skip if this route is served as a Next.js page, not an API route
      if (hasPageEquivalent(expressPath)) continue;

      failures.push(
        `FAIL [Check 1] Missing Next.js route file: ${nextjsRelPath}\n` +
        `     Express helper registers: ${method} ${expressPath} (${helperRelPath}:${line})`
      );
      continue; // can't check verb if file missing
    }

    const routeSrc = fs.readFileSync(nextjsFile, 'utf8');
    if (!routeSrc.includes(`export async function ${method}(`)) {
      failures.push(
        `FAIL [Check 1] ${nextjsRelPath} exists but does not export ${method}\n` +
        `     Express helper registers: ${method} ${expressPath} (${helperRelPath}:${line})`
      );
    }
  }

  return failures;
}

// ─── Check 2a + 2b: Bidirectional status code parity ─────────────────────────

function check2(routes, helperRelPath, helperSrc) {
  const failures = [];

  for (const { method, expressPath, body: helperBody, line } of routes) {
    // Skip routes served as pages — they have no API route.ts to compare
    if (hasPageEquivalent(expressPath)) continue;

    const nextjsFile    = expressToNextjsFile(expressPath);
    const nextjsRelPath = path.relative(ROOT, nextjsFile);

    if (!fs.existsSync(nextjsFile)) continue; // already reported in check1

    const routeSrc  = fs.readFileSync(nextjsFile, 'utf8');
    const routeBody = extractRouteHandler(routeSrc, method);

    if (!routeBody) continue; // already reported in check1

    const helperCodes = extractHelperCodes(helperBody, helperSrc);
    const routeCodes  = extractRouteCodes(routeBody);

    // 2a: helper codes must be present in route
    const missing = [...helperCodes].filter(c => !routeCodes.has(c));
    if (missing.length > 0) {
      failures.push(
        `FAIL [Check 2a] ${method} ${expressPath}\n` +
        `     Helper returns [${[...helperCodes].sort().join(', ')}] ` +
        `but Next.js route only has [${[...routeCodes].sort().join(', ')}].\n` +
        `     Missing status codes: [${missing.sort().join(', ')}]\n` +
        `     Helper: ${helperRelPath}:${line}\n` +
        `     Route:  ${nextjsRelPath}`
      );
    }

    // 2b: route codes must be present in helper (untested production branches)
    const untested = [...routeCodes].filter(c => !helperCodes.has(c));
    if (untested.length > 0) {
      failures.push(
        `FAIL [Check 2b] ${method} ${expressPath}\n` +
        `     Next.js route returns [${untested.sort().join(', ')}] but no helper path exercises it.\n` +
        `     Untested production branch — add these status paths to ${helperRelPath} for this route.\n` +
        `     Route: ${nextjsRelPath}`
      );
    }
  }

  return failures;
}

// ─── Check 3: Synthetic stub detection ───────────────────────────────────────

function check3() {
  const failures = [];
  if (!fs.existsSync(TESTS_DIR)) return failures;

  const testFiles = getAllTestFiles(TESTS_DIR);
  const stubRe    = /\bexpress\s*\(\s*\)/;

  for (const filePath of testFiles) {
    // Skip the helpers directory itself
    if (filePath.includes(`${path.sep}helpers${path.sep}`)) continue;
    if (filePath.endsWith('helpers/app.ts')) continue;

    const src = fs.readFileSync(filePath, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (stubRe.test(lines[i])) {
        const relPath = path.relative(ROOT, filePath);
        failures.push(
          `FAIL [Check 3] Synthetic stub detected: ${relPath}:${i + 1}\n` +
          `     Found inline express() call outside helpers/app.ts.\n` +
          `     Tests must use buildApp(prisma) from helpers/ — not route reimplementations.`
        );
        break; // one report per file
      }
    }
  }

  return failures;
}

/** Recursively collect all .test.ts files under a directory. */
function getAllTestFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTestFiles(full));
    } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.js')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(HELPER_PATH)) {
    console.log(`check-route-parity: no helper found at ${path.relative(ROOT, HELPER_PATH)} — skipping`);
    process.exit(0);
  }

  const helperSrc     = fs.readFileSync(HELPER_PATH, 'utf8');
  const helperRelPath = path.relative(ROOT, HELPER_PATH);
  const routes        = parseHelperRoutes(helperSrc);

  console.log(`check-route-parity: sprint ${SPRINT} — ${routes.length} routes found in helper`);

  const failures = [
    ...check1(routes, helperRelPath),
    ...check2(routes, helperRelPath, helperSrc),
    ...check3(),
  ];

  if (failures.length === 0) {
    console.log(`check-route-parity: all checks passed ✓`);
    process.exit(0);
  }

  console.error(`\ncheck-route-parity: ${failures.length} failure(s) found\n`);
  for (const f of failures) {
    console.error(f);
    console.error('');
  }
  process.exit(1);
}

main();
