#!/usr/bin/env node
/**
 * postbuild.js
 *
 * Runs after "expo export --platform web" to:
 * 1. Copy assets/icon.png to dist/apple-touch-icon.png
 * 2. Inject apple-touch-icon and PWA meta tags into dist/index.html
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const indexPath = path.join(distDir, 'index.html');
const iconSrc = path.join(root, 'assets', 'icon.png');
const iconDest = path.join(distDir, 'apple-touch-icon.png');

if (!fs.existsSync(indexPath)) {
  console.error('[postbuild] dist/index.html not found. Did the build succeed?');
  process.exit(1);
}

// 1. Copy icon
fs.copyFileSync(iconSrc, iconDest);
console.log('[postbuild] Copied apple-touch-icon.png to dist/');

// 2. Inject meta tags into <head>
let html = fs.readFileSync(indexPath, 'utf-8');

const tags = `
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Magnify" />
    <meta name="theme-color" content="#1B3A6B" />`;

if (!html.includes('apple-touch-icon')) {
  // Try inserting after <head> or after first <meta charset>
  if (html.includes('<meta charset')) {
    html = html.replace(/(<meta charset[^>]+>)/, `$1${tags}`);
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${tags}`);
  }
  fs.writeFileSync(indexPath, html);
  console.log('[postbuild] Injected PWA meta tags into index.html');
} else {
  console.log('[postbuild] PWA meta tags already present. Skipping injection.');
}
