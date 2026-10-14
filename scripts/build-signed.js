'use strict';
// Build a *candidate* using a Windows code signing cert present in the OS store
// (usually backed by a hardware token/HSM). Do not release automatically.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertSigningEnvironment } = require('./signing-preflight');

const ROOT = path.resolve(__dirname, '..');
const POLICY_FILE = path.join(ROOT, 'src', 'update-security.json');
const SIGNED_CONFIG = path.join(__dirname, 'signed-builder.config.cjs');
const VERIFY_SIGNATURE_SCRIPT = path.join(__dirname, 'verify-signed.ps1');

function runNodeScript(file) {
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`Verificação interrompida: ${path.basename(file)} (${r.status ?? r.error?.message})`);
}
function exec(command, args, environment = process.env) {
  const r = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: environment, windowsHide: false });
  if (r.error || r.status !== 0) throw new Error(`Comando falhou: ${path.basename(command)} (${r.status ?? r.error?.message})`);
}

function main() {
  if (process.platform !== 'win32') throw new Error('Compilação assinada exige Windows com certificado confiável acessível.');
  const { certName, publisherName } = assertSigningEnvironment();
  if (!fs.existsSync(VERIFY_SIGNATURE_SCRIPT)) throw new Error('Script de verificação ausente.');
  const previousPolicy = fs.readFileSync(POLICY_FILE, 'utf8');
  let modified = false;
  try {
    // Fail fast before touching release policy or running electron-builder.
    runNodeScript(path.join(__dirname, 'verify-lockfile.js'));
    exec('npm.cmd', ['run', 'check']);
    exec('npm.cmd', ['test']);
    const expected = { enabled: true, publisherName, notes: 'Ativado exclusivamente no executável assinado e verificado.' };
    fs.writeFileSync(POLICY_FILE, JSON.stringify(expected, null, 2) + '\n');
    modified = true;
    const cli = path.join(ROOT, 'node_modules', 'electron-builder', 'cli.js');
    if (!fs.existsSync(cli)) throw new Error('electron-builder ausente. Execute npm ci no Windows.');
    exec(process.execPath, [cli, '--win', 'nsis', '--config', SIGNED_CONFIG, '--publish', 'never']);
    exec('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', VERIFY_SIGNATURE_SCRIPT,
      '-DistDir', path.join(ROOT, 'dist'), '-ExpectedPublisher', publisherName,
      '-ExpectedName', certName
    ]);
    console.log('OK: build e assinaturas verificados. O instalador AINDA NÃO foi publicado.');
  } finally {
    // The local source must remain in safe preview mode by default.
    if (modified) fs.writeFileSync(POLICY_FILE, previousPolicy);
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`ERRO: ${error.message}`); process.exitCode = 1; }
}
module.exports = { main };
