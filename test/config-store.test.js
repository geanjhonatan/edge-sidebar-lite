'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createConfigStore } = require('../src/config-store');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sidebar-config-test-'));
  try {
    const file = path.join(dir, 'config.json');
    const store = createConfigStore(file);
    assert.deepEqual(await store.read(), { value: null, source: 'new' });
    const snapshot = (name, x=1) => ({ window: { side: 'right', panelWidth: x }, sites: [{ id: name, label: name, url: 'https://example.com/' }] });
    await store.save(snapshot('original', 420));
    assert.equal((await store.read()).value.sites[0].id, 'original');
    assert.equal((await fs.readdir(dir)).some(n=>n.endsWith('.tmp')), false);
    await store.save(snapshot('newer', 650));
    assert.equal(JSON.parse(await fs.readFile(file + '.bak', 'utf8')).sites[0].id, 'original');
    assert.equal((await store.read()).value.sites[0].id, 'newer');
    // Simulate a crash corrupting the live file, while backup remains valid.
    await fs.writeFile(file, '{not json');
    let recovered = await store.read();
    assert.equal(recovered.source, 'backup');
    assert.equal(recovered.value.sites[0].id, 'original');
    // Restoring must NEVER replace valid backup with corrupt primary.
    await store.save(recovered.value);
    assert.equal(JSON.parse(await fs.readFile(file + '.bak', 'utf8')).sites[0].id, 'original');
    assert.equal((await store.read()).source, 'primary');
    // Overlapping writes serialize and preserve the last requested snapshot.
    await Promise.all(Array.from({length: 20}, (_,i) => store.save(snapshot(`site-${i}`, 420+i))));
    assert.equal((await store.read()).value.sites[0].id, 'site-19');
    assert.equal((await fs.readdir(dir)).some(n=>n.endsWith('.tmp')), false);
    // Both files corrupt: explicitly fail without resetting or deleting user data.
    await fs.writeFile(file, 'broken-primary');
    await fs.writeFile(file+'.bak', 'broken-backup');
    await assert.rejects(store.read(), /preservados/);
    assert.equal(await fs.readFile(file, 'utf8'), 'broken-primary');
    assert.equal(await fs.readFile(file+'.bak', 'utf8'), 'broken-backup');
    console.log('OK: config atômica, backup, recuperação e gravações concorrentes');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
