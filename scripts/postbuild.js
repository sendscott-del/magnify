#!/usr/bin/env node
/**
 * postbuild.js
 *
 * Runs after "expo export --platform web" to:
 * 1. Copy icons to dist/ (apple-touch-icon, favicon, PWA-sized)
 * 2. Write dist/manifest.json (PWA manifest)
 * 3. Copy web-public/sw.js → dist/sw.js (service worker)
 * 4. Inject PWA meta tags + manifest link + SW registration into index.html
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const indexPath = path.join(distDir, 'index.html');
const iconSrc = path.join(root, 'assets', 'icon.png');

if (!fs.existsSync(indexPath)) {
  console.error('[postbuild] dist/index.html not found. Did the build succeed?');
  process.exit(1);
}

// 1. Copy icons
fs.copyFileSync(iconSrc, path.join(distDir, 'apple-touch-icon.png'));
fs.copyFileSync(iconSrc, path.join(distDir, 'icon-192.png'));
fs.copyFileSync(iconSrc, path.join(distDir, 'icon-512.png'));
console.log('[postbuild] Copied PWA icons to dist/');

const faviconSrc = path.join(root, 'assets', 'favicon.png');
fs.copyFileSync(faviconSrc, path.join(distDir, 'favicon.png'));
console.log('[postbuild] Copied favicon.png to dist/');

// 2. Write manifest.json
const manifest = {
  name: 'Magnify',
  short_name: 'Magnify',
  description: 'Stake Callings Workflow',
  start_url: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#1B3A6B',
  theme_color: '#1B3A6B',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('[postbuild] Wrote dist/manifest.json');

// 3. Copy service worker
const swSrc = path.join(root, 'web-public', 'sw.js');
const swDest = path.join(distDir, 'sw.js');
if (fs.existsSync(swSrc)) {
  fs.copyFileSync(swSrc, swDest);
  console.log('[postbuild] Copied sw.js to dist/');
} else {
  console.warn('[postbuild] web-public/sw.js not found — skipping SW copy');
}

// 4. Inject meta tags + manifest link + SW registration script
let html = fs.readFileSync(indexPath, 'utf-8');

const headTags = `
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Magnify" />
    <meta name="theme-color" content="#1B3A6B" />
    <link rel="manifest" href="/manifest.json" />`;

if (!html.includes('apple-touch-icon')) {
  if (html.includes('<meta charset')) {
    html = html.replace(/(<meta charset[^>]+>)/, `$1${headTags}`);
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${headTags}`);
  }
  console.log('[postbuild] Injected PWA meta tags');
} else if (!html.includes('rel="manifest"')) {
  // Existing apple meta but no manifest yet — add just the manifest link
  html = html.replace('apple-touch-icon" href="/apple-touch-icon.png" />',
    'apple-touch-icon" href="/apple-touch-icon.png" />\n    <link rel="manifest" href="/manifest.json" />');
  console.log('[postbuild] Added manifest link to existing PWA tags');
}

const swSnippet = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function (err) {
            console.warn('[sw] registration failed', err);
          });
        });
      }
    </script>`;
if (!html.includes("serviceWorker.register('/sw.js')")) {
  html = html.replace('</body>', `${swSnippet}\n</body>`);
  console.log('[postbuild] Injected service worker registration');
}

fs.writeFileSync(indexPath, html);
console.log('[postbuild] index.html updated');
