'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdateService, compareVersions, normalizeRelease, releaseUrlFor, readGitHubRelease, sanitizeUpdatePrefs } = require('../src/update-service');

(async () => {
  assert.equal(compareVersions('v0.4.0', '0.4.0-beta.1'), 1);
  assert.equal(compareVersions('0.4.0-beta.1', '0.3.1'), 1);
  assert.equal(compareVersions('0.4.0', '0.4.0'), 0);
  assert.equal(normalizeRelease({ draft: true, tag_name: 'v1.0.0' }), null);
  assert.equal(normalizeRelease({ prerelease: true, tag_name: 'v1.0.0' }), null);
  assert.equal(normalizeRelease({ tag_name: 'v0.4.1', body: '<script>HACK</script>Notas úteis' }).notes.includes('<script>'), false);
  assert.match(releaseUrlFor('v0.4.1'), /releases\/tag\/v0.4.1$/);
  assert.equal(sanitizeUpdatePrefs({ autoCheck: false, installOnQuit: true }).autoCheck, false);
  let notified = 0, requests = 0;
  const latest = async () => { requests++; return { version: '0.4.1', notes: 'Correções estáveis', url: releaseUrlFor('v0.4.1') }; };
  const service = createUpdateService({ currentVersion: '0.4.0-beta.1', releaseFetcher: latest,
    onAvailable: () => notified++ });
  const s1 = await service.check(true);
  assert.equal(s1.status, 'available');
  assert.equal(s1.latestVersion, '0.4.1');
  assert.equal(s1.secureInstall, false);
  assert.equal(notified, 1);
  await assert.rejects(service.download(), /bloqueado/i);
  assert.throws(service.installNow, /não validada/i);
  service.later();
  assert.equal(service.getState().preferences.postponedVersion, '0.4.1');
  await service.check(true);
  assert.equal(notified, 1, 'não repetir notificação adiada');
  assert.equal(requests, 2);
  let down = 0, quit = 0;
  class FakeUpdater extends EventEmitter {
    async checkForUpdates() { this.emit('update-available', { version: '0.4.2', releaseNotes: 'Fix de áudio' }); }
    async downloadUpdate() { down++; this.emit('download-progress', { percent: 67.5 }); this.emit('update-downloaded', { version: '0.4.2' }); return true; }
    quitAndInstall() { quit++; }
  }
  const fake = new FakeUpdater();
  const secure = createUpdateService({ currentVersion: '0.4.0', updater: fake,
    installAuthorized: true, isPackaged: true, platform: 'win32' });
  secure.setPrefs({ autoCheck: true, installOnQuit: false });
  await secure.check();
  assert.equal(secure.getState().status, 'available');
  await secure.download();
  assert.equal(secure.getState().ready, true);
  assert.equal(secure.getState().progress, 100);
  assert.equal(down, 1);
  secure.installNow();
  assert.equal(quit, 1);
  assert.equal(secure.getState().latestVersion, '0.4.2');
  const api404 = async () => ({ ok: false, status: 404, headers: { get: () => '0' } });
  assert.equal(await readGitHubRelease(api404), null);
  const failService = createUpdateService({ currentVersion: '0.4.0', releaseFetcher: async () => { throw new Error('network'); } });
  const failed = await failService.check(true);
  assert.equal(failed.status, 'error');
  assert.match(failed.message, /conexão/i);
  console.log('OK: updates read-only, version checks, postponement, signed download flow and errors');
})().catch(err => { console.error(err); process.exitCode=1; });
