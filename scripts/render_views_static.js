const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8000';
const OUTPUT_DIR = process.env.SCREENSHOT_DIR || 'screenshots';
const HTML_DIR = path.join(OUTPUT_DIR, 'html');

const VIEWS = [
  { mode: 'pipeline', file: 'view-pipeline.png' },
  { mode: 'companion', file: 'view-companion.png' },
  { mode: 'dashboard', file: 'view-dashboard.png' },
  { mode: 'history', file: 'view-history.png' },
  { mode: 'ideas', file: 'view-ideas.png' },
  { mode: 'settings', file: 'view-settings.png' },
  { mode: 'thumbnail', tab: 'studio', file: 'view-thumbnail-studio.png' },
  { mode: 'thumbnail', tab: 'library', file: 'view-thumbnail-library.png' },
  { mode: 'marketing', tab: 'library', file: 'view-marketing-campaigns.png' },
  { mode: 'marketing', tab: 'studio', file: 'view-marketing-repurpose.png' },
  { mode: 'marketing', tab: 'notes', file: 'view-marketing-compose.png' },
  { mode: 'marketing', tab: 'quotes', file: 'view-marketing-quotes.png' },
  { mode: 'marketing', tab: 'scheduled', file: 'view-marketing-publishing.png' },
  { mode: 'audience', tab: 'browser', file: 'view-audience-browser.png' },
  { mode: 'audience', tab: 'insights', file: 'view-audience-insights.png' },
];

function normalizeHtml(html, cssText) {
  let out = html;
  out = out.replace('<head>', `<head>\n  <base href="${BASE_URL}/">`);
  out = out.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '');
  out = out.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, '');
  out = out.replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]+" rel="stylesheet">\s*/g, '');
  out = out.replace(/<link rel="stylesheet" href="\/static\/css\/app\.css">\s*/g, `<style>\n${cssText}\n</style>\n`);
  out = out.replace(/src="\/static\//g, `src="${BASE_URL}/static/`);
  out = out.replace(/<script src="[^"]+"><\/script>\s*/g, '');
  out = out.replace(/<div class="auth-overlay[\s\S]*?<div class="app">/, '<div class="app">');
  return out;
}

function stateScript(view) {
  return `
<style>
  #auth-overlay { display: none !important; }
</style>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const view = ${JSON.stringify(view)};
    document.querySelectorAll('.nav').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

    const nav = document.querySelector(\`button.nav[data-mode="\${view.mode}"]\`);
    const page = document.getElementById(\`page-\${view.mode}\`);
    if (nav) nav.classList.add('active');
    if (page) page.classList.add('active');

    document.querySelectorAll('[data-mk-tab]').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.marketing-pane').forEach(el => el.classList.remove('active'));
    if (view.mode === 'marketing') {
      const tab = view.tab || 'library';
      const mkBtn = document.querySelector(\`[data-mk-tab="\${tab}"]\`);
      const mkPane = document.getElementById(\`mk-pane-\${tab}\`);
      if (mkBtn) mkBtn.classList.add('active');
      if (mkPane) mkPane.classList.add('active');
    }

    document.querySelectorAll('[data-th-tab]').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.thumb-pane').forEach(el => el.classList.remove('active'));
    if (view.mode === 'thumbnail') {
      const tab = view.tab || 'studio';
      const thBtn = document.querySelector(\`[data-th-tab="\${tab}"]\`);
      const thPane = document.getElementById(\`th-pane-\${tab}\`);
      if (thBtn) thBtn.classList.add('active');
      if (thPane) thPane.classList.add('active');
    }

    document.querySelectorAll('[data-a="aud-tab"]').forEach(el => el.classList.remove('active'));
    const audBrowser = document.getElementById('aud-pane-browser');
    const audInsights = document.getElementById('aud-pane-insights');
    if (audBrowser) audBrowser.style.display = 'none';
    if (audInsights) audInsights.style.display = 'none';
    if (view.mode === 'audience') {
      const tab = view.tab || 'browser';
      const audBtn = document.querySelector(\`[data-a="aud-tab"][data-tab="\${tab}"]\`);
      if (audBtn) audBtn.classList.add('active');
      const pane = document.getElementById(\`aud-pane-\${tab}\`);
      if (pane) pane.style.display = '';
    }
  });
</script>`;
}

async function main() {
  fs.mkdirSync(HTML_DIR, { recursive: true });
  const [htmlRes, cssRes] = await Promise.all([
    fetch(BASE_URL),
    fetch(`${BASE_URL}/static/css/app.css`),
  ]);
  const html = normalizeHtml(await htmlRes.text(), await cssRes.text());

  for (const view of VIEWS) {
    const filePath = path.join(HTML_DIR, view.file.replace(/\.png$/, '.html'));
    const rendered = html.replace('</body>', `${stateScript(view)}\n</body>`);
    fs.writeFileSync(filePath, rendered);
    console.log(filePath);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
