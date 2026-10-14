'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(base, 'package-lock.json'), 'utf8'));
const root = lock.packages?.[''];
const issues = [];
if (lock.version !== pkg.version || root?.version !== pkg.version) issues.push('Versão raiz do lockfile está incorreta.');
for (const type of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, wanted] of Object.entries(pkg[type] || {})) {
    if (root?.[type]?.[name] !== wanted) issues.push(`${type}.${name}: package.json=${wanted} lock=${root?.[type]?.[name] || '(ausente)'}`);
  }
}
for (const name of ['electron', 'electron-builder']) {
  const installed = lock.packages?.[`node_modules/${name}`]?.version;
  if (installed !== pkg.devDependencies?.[name]) issues.push(`node_modules/${name}: pacote travado ${installed || '(ausente)'} difere do esperado ${pkg.devDependencies?.[name]}`);
}
if (issues.length) {
  console.error('LOCKFILE DESATUALIZADO — sincronize no Windows com: npm run lock:sync\n' + issues.map(x=>` - ${x}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('OK: package-lock.json está coerente com as versões declaradas.');
}
