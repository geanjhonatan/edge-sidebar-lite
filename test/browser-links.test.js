const assert = require('node:assert/strict');
const { safeWebLink, displayLink, detectedBrowsers } = require('../src/browser-links');
assert.equal(safeWebLink('https://example.com/path?a=1'), 'https://example.com/path?a=1');
assert.equal(safeWebLink('http://example.com/'), 'http://example.com/');
for (const unsafe of ['javascript:alert(1)', 'file:///C:/private.txt', 'https://a:b@example.com/', 'data:text/html,hello', '', 'https://']) {
  assert.equal(safeWebLink(unsafe), null, unsafe);
}
assert.equal(displayLink('https://example.com/a?token=secret'), 'https://example.com/a');
assert.deepEqual(detectedBrowsers('linux'), []);
const found = detectedBrowsers('win32', { 'PROGRAMFILES': 'C:\\Program Files', 'LOCALAPPDATA': 'C:\\Users\\Test\\AppData\\Local' },
  (f) => f.endsWith('vivaldi.exe') || f.endsWith('chrome.exe'));
assert.deepEqual(found.map(x => x.name), ['Google Chrome','Vivaldi']);
console.log('browser-links.test.js OK');
