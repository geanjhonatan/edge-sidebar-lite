'use strict';

// All network and install decisions happen in the trusted Electron main process.
// A Github release description is UNTRUSTED text; it must never become HTML or code.
const REPO = 'geanjhonatan/edge-sidebar-lite';
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const MAX_RESPONSE_BYTES = 256 * 1024;
const INITIAL_CHECK_DELAY_MS = 20_000;
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function parseVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] || '' };
}

function compareVersions(a, b) {
  const aa = parseVersion(a), bb = parseVersion(b);
  if (!aa || !bb) throw new Error('Versão inválida.');
  for (const key of ['major', 'minor', 'patch']) {
    if (aa[key] !== bb[key]) return Math.sign(aa[key] - bb[key]);
  }
  if (!aa.pre && bb.pre) return 1;
  if (aa.pre && !bb.pre) return -1;
  if (aa.pre !== bb.pre) return aa.pre.localeCompare(bb.pre, 'en', { numeric: true });
  return 0;
}

function formatReleaseNotes(value) {
  // Keep only plain text. No markdown renderer or HTML insertion in our UI.
  return String(Array.isArray(value) ? value.map(x => x?.note || '').join('\n') : value || '')
    .replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 2800);
}

function releaseUrlFor(tag) {
  if (!/^v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(String(tag || ''))) return RELEASES_PAGE;
  return `${RELEASES_PAGE}/tag/${encodeURIComponent(tag)}`;
}

function normalizeRelease(release) {
  if (!release || release.draft || release.prerelease || !parseVersion(release.tag_name)) return null;
  return {
    version: String(release.tag_name).replace(/^v/, ''),
    notes: formatReleaseNotes(release.body),
    url: releaseUrlFor(release.tag_name)
  };
}

async function readGitHubRelease(fetcher = fetch) {
  const response = await fetcher(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'edge-sidebar-lite-update-checker' },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000)
  });
  if (response.status === 404) return null; // Repo has no published Releases yet.
  if (!response.ok) throw new Error(`GitHub Releases retornou HTTP ${response.status}.`);
  const sizeHeader = Number(response.headers?.get?.('content-length') || 0);
  if (sizeHeader > MAX_RESPONSE_BYTES) throw new Error('Resposta de atualização grande demais.');
  // Reading a bounded stream also prevents decompressed oversized responses.
  let text = '';
  const decoder = new TextDecoder();
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Metadados grandes demais.'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } else {
    text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error('Resposta grande demais.');
  }
  return normalizeRelease(JSON.parse(text));
}

function sanitizeUpdatePrefs(candidate = {}) {
  return {
    autoCheck: candidate.autoCheck !== false,
    autoDownload: Boolean(candidate.autoDownload),
    installOnQuit: Boolean(candidate.installOnQuit),
    postponedVersion: parseVersion(candidate.postponedVersion) ? String(candidate.postponedVersion).replace(/^v/, '') : ''
  };
}

function createUpdateService({ currentVersion, onState = () => {}, onAvailable = () => {}, releaseFetcher = readGitHubRelease,
  updater = null, installAuthorized = false, isPackaged = false, platform = process.platform } = {}) {
  const compatible = isPackaged && platform === 'win32';
  // Only enabled after signing configuration, certificate verification and OS testing.
  const secureInstall = Boolean(compatible && installAuthorized && updater);
  let prefs = sanitizeUpdatePrefs();
  let checking = null;
  let downloading = null;
  let s = {
    version: currentVersion, status: 'idle', latestVersion: null, notes: '', releaseUrl: RELEASES_PAGE,
    progress: 0, message: '', available: false, ready: false, secureInstall, installSupported: secureInstall,
    automaticChecksSupported: true
  };
  const dispatch = () => onState(getState());
  const patch = (data) => { s = { ...s, ...data }; dispatch(); };
  const getState = () => ({ ...s, preferences: { ...prefs } });

  if (secureInstall) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.on('checking-for-update', () => patch({ status: 'checking', message: 'Procurando atualização assinada…' }));
    updater.on('update-not-available', () => patch({ status: 'current', available: false, message: 'Você já está na versão mais recente.' }));
    updater.on('update-available', (info) => {
      if (!parseVersion(info?.version) || compareVersions(info.version, currentVersion) <= 0) return;
      const release = { version: String(info.version), notes: formatReleaseNotes(info.releaseNotes), url: releaseUrlFor(info.version) };
      patch({ status: 'available', latestVersion: release.version, notes: release.notes, releaseUrl: release.url, available: true, ready: false, message: 'Nova atualização assinada disponível.' });
      if (prefs.postponedVersion !== release.version) onAvailable(getState());
      if (prefs.autoDownload) void download().catch(() => {});
    });
    updater.on('download-progress', (progress) => patch({ status: 'downloading', progress: Math.max(0, Math.min(100, Number(progress?.percent) || 0)), message: 'Baixando atualização…' }));
    updater.on('update-downloaded', (info) => {
      updater.autoInstallOnAppQuit = prefs.installOnQuit;
      patch({ status: 'downloaded', progress: 100, ready: true, latestVersion: info.version, message: 'Atualização pronta. Você escolhe quando instalar.' });
    });
    updater.on('error', (error) => patch({ status: 'error', message: safeError(error) }));
  }

  function safeError(error) {
    const code = String(error?.code || '');
    if (code.startsWith('ERR_UPDATER_MANIFEST')) return 'Verificação da assinatura dos metadados falhou. Instalação bloqueada.';
    return 'Falha ao consultar ou baixar atualização. Confira a conexão e tente novamente.';
  }
  function setPrefs(input) {
    prefs = sanitizeUpdatePrefs(input);
    if (secureInstall) updater.autoInstallOnAppQuit = Boolean(s.ready && prefs.installOnQuit);
    dispatch();
    return getState();
  }
  async function check(manual = false) {
    if (s.ready || downloading) return getState();
    if (checking) return checking;
    if (downloading) return getState();
    checking = (async () => {
      if (manual && prefs.postponedVersion) { prefs.postponedVersion = ''; dispatch(); }
      patch({ status: 'checking', message: 'Verificando atualizações…' });
      try {
        if (secureInstall) {
          // electron-updater verifies the Authenticode publisher for downloaded installers.
          // With electron-builder v26, the manifest itself is HTTPS + SHA512, not Ed25519 signed.
          await updater.checkForUpdates();
        } else {
          const release = await releaseFetcher();
          if (!release || compareVersions(release.version, currentVersion) <= 0) {
            patch({ status: 'current', available: false, ready: false, message: release ? 'Você está na versão mais recente.' : 'Nenhuma Release publicada até agora.' });
          } else {
            const changed = s.latestVersion !== release.version;
            patch({ status: 'available', available: true, ready: false, latestVersion: release.version,
              notes: release.notes, releaseUrl: release.url,
              message: 'Versão nova identificada. Instalação automática aguardando assinatura digital.' });
            if (changed && prefs.postponedVersion !== release.version) onAvailable(getState());
          }
        }
      } catch (error) {
        patch({ status: 'error', message: safeError(error) });
      }
      return getState();
    })().finally(() => { checking = null; });
    return checking;
  }
  async function download() {
    if (!secureInstall) throw new Error('Download automático bloqueado: falta configuração de assinatura digital confiável.');
    if (!s.available || s.ready) return getState();
    if (downloading) return downloading;
    patch({ status: 'downloading', progress: 0, message: 'Iniciando download…' });
    downloading = Promise.resolve(updater.downloadUpdate()).then(() => getState()).catch((error) => {
      patch({ status: 'error', message: safeError(error) });
      throw new Error(s.message);
    }).finally(() => { downloading = null; });
    return downloading;
  }
  function installNow() {
    if (!secureInstall || !s.ready) throw new Error('Atualização ainda não validada para instalação.');
    updater.quitAndInstall(false, true);
    return getState();
  }
  function later() {
    if (s.latestVersion) prefs.postponedVersion = s.latestVersion;
    dispatch();
    return getState();
  }
  return { getState, check, download, installNow, later, setPrefs, releasesPage: RELEASES_PAGE };
}

module.exports = { REPO, RELEASES_PAGE, parseVersion, compareVersions, normalizeRelease, readGitHubRelease, releaseUrlFor,
  sanitizeUpdatePrefs, createUpdateService };
