const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

assert.equal(process.getuid(), 1000);
assert.equal(process.version, 'v22.23.4');
assert.equal(process.execPath, '/opt/ci-node/bin/node');
assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH, '/ms-playwright');
const project = createRequire('/work/web/package.json');
assert.equal(project('playwright/package.json').version, '1.60.0');
assert.equal(project('playwright-core/package.json').version, '1.60.0');
const core = path.dirname(project.resolve('playwright-core/package.json'));
const records = JSON.parse(fs.readFileSync(path.join(core, 'browsers.json'), 'utf8')).browsers;
for (const name of ['chromium', 'chromium-headless-shell']) {
  const item = records.find(record => record.name === name);
  assert(item, 'Missing browser revision record: ' + name);
  assert.equal(item.revision, '1223');
  assert.equal(item.browserVersion, '148.0.7778.96');
}
const { chromium } = project('playwright');
assert(fs.statSync(chromium.executablePath()).isFile(), 'Full Chromium binary must exist');
assert(fs.statSync('/ms-playwright/chromium_headless_shell-1223').isDirectory(), 'Headless-shell cache must exist');

async function main() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('offline-loopback-ok');
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    // Preserve the existing Vitest/Playwright launch defaults. The Chromium
    // internal sandbox is off by default; isolation is the outer Docker boundary.
    browser = await chromium.launch({ headless: true });
    assert.equal(browser.version(), '148.0.7778.96');
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port, { timeout: 10000 });
    assert.equal(await page.textContent('body'), 'offline-loopback-ok');
    console.log('Pinned Node/Playwright/Chromium and private loopback verified; internal browser sandbox follows unchanged defaults');
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      server.closeAllConnections();
      if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
