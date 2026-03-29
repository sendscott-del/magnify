#!/usr/bin/env node
/**
 * generate-changelog.js
 *
 * Reads git log since the last tag and categorizes commits into
 * enhancements and bug fixes, then prepends a new entry to constants/changelog.ts.
 *
 * Commit message conventions:
 *   feat: / add: / enhance:     → Enhancement
 *   fix: / bug: / patch:        → Bug Fix
 *   (all others)                → Enhancement by default
 *
 * Run: node scripts/generate-changelog.js
 * Called automatically by: npm run build:web
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

// Get current version from package.json
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const version = pkg.version;

// Get today's date
const today = new Date().toISOString().split('T')[0];

// Get last tag, or use the initial commit if no tags
const lastTag = run('git describe --tags --abbrev=0 2>/dev/null') || run('git rev-list --max-parents=0 HEAD');
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';

// Get commits since last tag
const log = run(`git log ${range} --pretty=format:"%s" --no-merges`);
if (!log) {
  console.log('[generate-changelog] No new commits since last tag. Skipping.');
  process.exit(0);
}

const commits = log.split('\n').filter(Boolean);
const enhancements = [];
const bugFixes = [];

for (const msg of commits) {
  const lower = msg.toLowerCase();
  if (/^(fix|bug|patch|hotfix)[\s:(]/.test(lower)) {
    bugFixes.push(msg.replace(/^(fix|bug|patch|hotfix)[\s:(]+/i, '').trim());
  } else {
    const clean = msg.replace(/^(feat|add|enhance|update|chore|refactor|style|test|docs)[\s:(]+/i, '').trim();
    enhancements.push(clean);
  }
}

// Read existing changelog
const changelogPath = path.join(__dirname, '../constants/changelog.ts');
let existing = fs.readFileSync(changelogPath, 'utf-8');

// Check if this version already exists
if (existing.includes(`version: '${version}'`)) {
  console.log(`[generate-changelog] Version ${version} already in changelog. Skipping.`);
  process.exit(0);
}

// Build new entry string
const enhancementsStr = enhancements.map(e => `      '${e.replace(/'/g, "\\'")}',`).join('\n');
const bugFixesStr = bugFixes.map(b => `      '${b.replace(/'/g, "\\'")}',`).join('\n');

const newEntry = `  {
    version: '${version}',
    date: '${today}',
    enhancements: [
${enhancementsStr}
    ],
    bugFixes: [
${bugFixesStr}
    ],
  },`;

// Insert new entry after the opening bracket of CHANGELOG array
existing = existing.replace(
  'export const CHANGELOG: ChangelogEntry[] = [',
  `export const CHANGELOG: ChangelogEntry[] = [\n${newEntry}`
);

fs.writeFileSync(changelogPath, existing);
console.log(`[generate-changelog] Added v${version} with ${enhancements.length} enhancements and ${bugFixes.length} bug fixes.`);
