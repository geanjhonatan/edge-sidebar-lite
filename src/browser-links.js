'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Never pass arbitrary schemes, javascript:, file:, credentials or control
// characters from a third-party webpage to Windows or another executable.
function safeWebLink(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function displayLink(link) {
  const url = new URL(link);
  const pathname = `${url.origin}${url.pathname}`;
  return pathname.length > 240 ? `${pathname.slice(0, 237)}...` : pathname;
}

const BROWSER_CANDIDATES = [
  { name: 'Microsoft Edge', paths: [['PROGRAMFILES(X86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'], ['PROGRAMFILES', 'Microsoft', 'Edge', 'Application', 'msedge.exe']] },
  { name: 'Google Chrome', paths: [['PROGRAMFILES', 'Google', 'Chrome', 'Application', 'chrome.exe'], ['PROGRAMFILES(X86)', 'Google', 'Chrome', 'Application', 'chrome.exe'], ['LOCALAPPDATA', 'Google', 'Chrome', 'Application', 'chrome.exe']] },
  { name: 'Vivaldi', paths: [['LOCALAPPDATA', 'Vivaldi', 'Application', 'vivaldi.exe'], ['PROGRAMFILES', 'Vivaldi', 'Application', 'vivaldi.exe'], ['PROGRAMFILES(X86)', 'Vivaldi', 'Application', 'vivaldi.exe']] },
  { name: 'Mozilla Firefox', paths: [['PROGRAMFILES', 'Mozilla Firefox', 'firefox.exe'], ['PROGRAMFILES(X86)', 'Mozilla Firefox', 'firefox.exe']] },
  { name: 'Brave', paths: [['PROGRAMFILES', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'], ['LOCALAPPDATA', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe']] },
  { name: 'Opera', paths: [['LOCALAPPDATA', 'Programs', 'Opera', 'launcher.exe'], ['PROGRAMFILES', 'Opera', 'launcher.exe']] }
];

function detectedBrowsers(platform = process.platform, env = process.env, exists = fs.existsSync) {
  if (platform !== 'win32') return [];
  return BROWSER_CANDIDATES.flatMap((browser) => {
    const found = browser.paths.map(([key, ...parts]) => env[key] ? path.join(env[key], ...parts) : '')
      .find((candidate) => candidate && exists(candidate));
    return found ? [{ name: browser.name, executable: found }] : [];
  });
}

function launchBrowser(browser, rawUrl) {
  const url = safeWebLink(rawUrl);
  if (!url || !browser?.executable || !fs.existsSync(browser.executable)) {
    return Promise.reject(new Error('Navegador ou URL inválidos.'));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(browser.executable, [url], { windowsHide: true, detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

module.exports = { safeWebLink, displayLink, detectedBrowsers, launchBrowser };
