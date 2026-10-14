'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

/**
 * Serialized, atomic JSON writes. The .bak contains the previous valid state,
 * never a corrupted primary file. No app profile, cookies or sessions are copied.
 */
function createConfigStore(filePath) {
  const backupPath = `${filePath}.bak`;
  let queue = Promise.resolve();

  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        (!Array.isArray(value.sites) && !Array.isArray(value.apps)) ||
        !value.window || typeof value.window !== 'object' || Array.isArray(value.window)) {
      throw new Error('Estrutura de configurações inválida.');
    }
    return value;
  }

  async function parseFile(candidate) {
    return validate(JSON.parse(await fs.readFile(candidate, 'utf8')));
  }

  async function read() {
    try {
      return { value: await parseFile(filePath), source: 'primary' };
    } catch (originalError) {
      try {
        return { value: await parseFile(backupPath), source: 'backup' };
      } catch (backupError) {
        if (originalError.code === 'ENOENT' && backupError.code === 'ENOENT') {
          return { value: null, source: 'new' };
        }
        const error = new Error('Não foi possível ler as configurações nem o backup. Os arquivos foram preservados.');
        error.cause = originalError;
        throw error;
      }
    }
  }

  async function atomicReplace(destination, data) {
    const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${randomUUID()}.tmp`);
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(data, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  async function writeSnapshot(snapshot) {
    const data = JSON.stringify(validate(JSON.parse(snapshot)), null, 2);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      const old = await fs.readFile(filePath, 'utf8');
      validate(JSON.parse(old));
      // Only replace a valid backup with a *valid* previous config.
      await atomicReplace(backupPath, old);
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError) &&
          error.message !== 'Estrutura de configurações inválida.') throw error;
      // Current file absent/corrupt: preserve the last good .bak.
    }
    await atomicReplace(filePath, data);
  }

  function save(value) {
    const snapshot = JSON.stringify(value); // snapshot synchronously; mutations later cannot affect this write
    const task = queue.then(() => writeSnapshot(snapshot));
    queue = task.catch(() => {}); // failed writes must not permanently block future saves
    return task;
  }

  return { read, save, filePath, backupPath };
}

module.exports = { createConfigStore };
