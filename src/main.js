const { app, BrowserWindow, Menu, Tray, WebContentsView, ipcMain, nativeImage, screen, session } = require('electron');
const fs = require('node:fs/promises');
const { existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { createWindowsAppBar } = require('./windows-appbar');

const SIDEBAR_WIDTH = 60;
const NAVIGATION_BAR_HEIGHT = 46;
const RESIZE_HANDLE_WIDTH = 8;
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_LIVE_VIEWS = 3;
const MAX_PANEL_WIDTH = 780;
const FLOATING_HEIGHT = 720;
const WINDOW_MARGIN = 16;
const FAVICON_MAX_BYTES = 512 * 1024;
const BASE_PARTITION = 'persist:edge-sidebar-lite';

const DEFAULT_SITES = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/', faviconPath: '' },
  { id: 'whatsapp', label: 'WhatsApp', url: 'https://web.whatsapp.com/', faviconPath: '' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/', faviconPath: '' }
];

const DEFAULT_APPEARANCE = {
  preset: 'dark',
  opacity: 0.96,
  colors: {
    windowBg: '#0d1117',
    sidebarBg: '#111722',
    panelBg: '#0f141d',
    accent: '#4f8cff',
    icon: '#e6edf3',
    text: '#e6edf3',
    button: 'rgba(255,255,255,0.06)',
    active: 'rgba(79,140,255,0.22)',
    border: 'rgba(255,255,255,0.08)',
    hover: 'rgba(255,255,255,0.12)'
  }
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let settingsOpen = false;
let config = null;
let currentViewId = null;
let lastAppliedLayout = null;
let positionSaveTimer = null;
let nativeAppBar = null;
let shellUpdateTimer = null;

const viewEntries = new Map();
const configuredSessions = new Set();

function logError(scope, error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[edge-sidebar-lite] ${scope}: ${message}`);
}

function serializeError(error) {
  if (error instanceof Error) {
    return new Error(error.message);
  }

  return new Error(String(error));
}

function fireAndForget(scope, task) {
  Promise.resolve(task).catch((error) => {
    logError(scope, error);
  });
}

function handleIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!mainWindow || event.sender !== mainWindow.webContents) {
        throw new Error('Origem IPC não autorizada.');
      }
      return await handler(event, ...args);
    } catch (error) {
      logError(`ipc:${channel}`, error);
      throw serializeError(error);
    }
  });
}

function defaultConfig() {
  return {
    window: {
      expanded: true,
      alwaysOnTop: false,
      side: 'right',
      panelWidth: DEFAULT_PANEL_WIDTH,
      docked: false, // false = janela independente; true = barra fixa na borda do monitor
      reserveSpace: true, // quando fixada, reserva espaço real no desktop do Windows
      floatingPosition: null
    },
    activeSiteId: DEFAULT_SITES[0].id,
    sites: DEFAULT_SITES.map((site) => ({ ...site })),
    appearance: sanitizeAppearance(DEFAULT_APPEARANCE)
  };
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function getFaviconCacheDir() {
  return path.join(app.getPath('userData'), 'favicons');
}

function createSiteId() {
  return `site-${randomUUID()}`;
}

function deriveLabelFromUrl(rawUrl) {
  try {
    const hostname = new URL(String(rawUrl)).hostname.replace(/^www\./i, '');
    const [firstPart] = hostname.split('.');
    if (!firstPart) {
      return 'Site';
    }
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
  } catch {
    return 'Site';
  }
}

function sanitizeLabel(value, fallback) {
  const trimmed = String(value || '').trim();
  return (trimmed || fallback || 'Site').slice(0, 48);
}

function sanitizeUrl(rawValue, fallback = 'https://example.com/') {
  try {
    const parsed = new URL(String(rawValue || ''));
    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS is allowed.');
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function sanitizeSite(site, usedIds) {
  const url = sanitizeUrl(site?.url, 'https://example.com/');
  let id = typeof site?.id === 'string' && site.id.trim() ? site.id.trim() : createSiteId();
  while (usedIds.has(id)) {
    id = createSiteId();
  }
  usedIds.add(id);

  return {
    id,
    label: sanitizeLabel(site?.label, deriveLabelFromUrl(url)),
    url,
    faviconPath: typeof site?.faviconPath === 'string' ? site.faviconPath : ''
  };
}

function sanitizeColor(value, fallback) {
  const text = String(value || '').trim();
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text) ? text : fallback;
}

function sanitizeOpacity(value, fallback = DEFAULT_APPEARANCE.opacity) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(Number(numeric.toFixed(2)), 0.55), 1);
}

function sanitizeAppearance(candidate = {}) {
  const colors = candidate.colors || {};
  return {
    preset: typeof candidate.preset === 'string' && candidate.preset ? candidate.preset : DEFAULT_APPEARANCE.preset,
    opacity: sanitizeOpacity(candidate.opacity),
    colors: {
      windowBg: sanitizeColor(colors.windowBg, DEFAULT_APPEARANCE.colors.windowBg),
      sidebarBg: sanitizeColor(colors.sidebarBg, DEFAULT_APPEARANCE.colors.sidebarBg),
      panelBg: sanitizeColor(colors.panelBg, DEFAULT_APPEARANCE.colors.panelBg),
      accent: sanitizeColor(colors.accent, DEFAULT_APPEARANCE.colors.accent),
      icon: sanitizeColor(colors.icon, DEFAULT_APPEARANCE.colors.icon),
      text: sanitizeColor(colors.text, DEFAULT_APPEARANCE.colors.text),
      button: sanitizeColor(colors.button, '#1e2632'),
      active: sanitizeColor(colors.active, '#1f3f73'),
      border: sanitizeColor(colors.border, '#263242'),
      hover: sanitizeColor(colors.hover, '#2a3340')
    }
  };
}

function sanitizeConfig(candidate = {}) {
  const base = defaultConfig();
  let sourceSites;

  if (Array.isArray(candidate.sites)) {
    sourceSites = candidate.sites;
  } else if (Array.isArray(candidate.apps)) {
    sourceSites = candidate.apps;
  } else {
    sourceSites = base.sites;
  }

  const usedIds = new Set();
  const sites = sourceSites.map((site) => sanitizeSite(site, usedIds));
  const requestedActive = candidate.activeSiteId ?? candidate.activeApp ?? base.activeSiteId;
  const activeSiteId = sites.some((site) => site.id === requestedActive)
    ? requestedActive
    : (sites[0]?.id || null);

  return {
    window: {
      expanded: typeof candidate.window?.expanded === 'boolean' ? candidate.window.expanded : base.window.expanded,
      alwaysOnTop: typeof candidate.window?.alwaysOnTop === 'boolean' ? candidate.window.alwaysOnTop : base.window.alwaysOnTop,
      side: candidate.window?.side === 'left' ? 'left' : 'right',
      panelWidth: sanitizeSavedPanelWidth(candidate.window?.panelWidth),
      docked: typeof candidate.window?.docked === 'boolean' ? candidate.window.docked : base.window.docked,
      reserveSpace: typeof candidate.window?.reserveSpace === 'boolean' ? candidate.window.reserveSpace : base.window.reserveSpace,
      floatingPosition: sanitizeFloatingPosition(candidate.window?.floatingPosition)
    },
    activeSiteId,
    sites,
    appearance: sanitizeAppearance(candidate.appearance)
  };
}

async function loadConfig() {
  const filePath = getConfigPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  mkdirSync(getFaviconCacheDir(), { recursive: true });

  if (!existsSync(filePath)) {
    config = defaultConfig();
    await saveConfig();
    return;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    config = sanitizeConfig(JSON.parse(raw));
    config.window.panelWidth = clampPanelWidth(config.window.panelWidth);
  } catch {
    config = defaultConfig();
    await saveConfig();
  }
}

function getTargetDisplay() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return screen.getDisplayMatching(mainWindow.getBounds());
  }
  return screen.getPrimaryDisplay();
}

function getPanelWidthLimits(display = getTargetDisplay()) {
  // Impede que valores antigos (como 1736 px) criem uma janela gigante.
  const usableWidth = config?.window?.docked && config?.window?.reserveSpace && process.platform === 'win32'
    ? display.bounds.width : display.workArea.width;
  const available = Math.max(220, usableWidth - SIDEBAR_WIDTH - RESIZE_HANDLE_WIDTH - WINDOW_MARGIN * 2);
  const max = Math.max(220, Math.min(MAX_PANEL_WIDTH, available, Math.floor(usableWidth * 0.6)));
  return { min: Math.min(MIN_PANEL_WIDTH, max), max };
}

function sanitizeSavedPanelWidth(value) {
  const numeric = Number(value);
  // Um valor herdado muito grande é provavelmente a configuração corrompida.
  if (!Number.isFinite(numeric) || numeric < 220 || numeric > MAX_PANEL_WIDTH) {
    return DEFAULT_PANEL_WIDTH;
  }
  return Math.round(numeric);
}

function sanitizeFloatingPosition(value) {
  if (!value || typeof value !== 'object') return null;
  const { x, y, side } = value;
  return Number.isFinite(x) && Number.isFinite(y) && (side === 'left' || side === 'right')
    ? { x: Math.round(x), y: Math.round(y), side }
    : null;
}

function clampPanelWidth(value, display = getTargetDisplay()) {
  const numeric = Number.isFinite(value) ? Math.round(value) : DEFAULT_PANEL_WIDTH;
  const limits = getPanelWidthLimits(display);
  return Math.min(Math.max(numeric, limits.min), limits.max);
}

async function saveConfig() {
  config.window.panelWidth = clampPanelWidth(config.window.panelWidth);
  config.appearance = sanitizeAppearance(config.appearance);
  const filePath = getConfigPath();
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
}

function toPublicSite(site) {
  return {
    id: site.id,
    label: site.label,
    url: site.url,
    faviconUrl: site.faviconPath ? pathToFileURL(site.faviconPath).toString() : null
  };
}

function getPublicState() {
  const display = getTargetDisplay();
  const limits = getPanelWidthLimits(display);
  return {
    window: {
      ...config.window,
      panelWidth: clampPanelWidth(config.window.panelWidth, display)
    },
    activeSiteId: config.activeSiteId,
    navigation: getNavigationState(),
    appBar: {
      supported: process.platform === 'win32',
      registered: Boolean(nativeAppBar?.state.registered),
      error: nativeAppBar?.state.error || ''
    },
    sites: config.sites.map(toPublicSite),
    appearance: sanitizeAppearance(config.appearance),
    layout: {
      sidebarWidth: SIDEBAR_WIDTH,
      resizeHandleWidth: RESIZE_HANDLE_WIDTH,
      minPanelWidth: limits.min,
      maxPanelWidth: limits.max
    }
  };
}

// Cada site possui seu próprio histórico dentro do WebContentsView ativo.
// Electron 30 usa os métodos diretamente em webContents. Versões mais novas
// disponibilizam os mesmos métodos em navigationHistory.
function navigationAPI(wc) {
  return wc?.navigationHistory && typeof wc.navigationHistory.canGoBack === 'function'
    ? wc.navigationHistory
    : wc;
}

function getNavigationState() {
  const entry = currentViewId ? viewEntries.get(currentViewId) : null;
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed() || !config.window.expanded || settingsOpen) {
    return { canGoBack: false, canGoForward: false, isLoading: false, url: '', siteId: null };
  }
  const history = navigationAPI(wc);
  return {
    canGoBack: Boolean(history?.canGoBack?.()),
    canGoForward: Boolean(history?.canGoForward?.()),
    isLoading: Boolean(wc.isLoading?.()),
    url: wc.getURL?.() || getSiteConfig(currentViewId)?.url || '',
    siteId: currentViewId
  };
}

function sendNavigationState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sidebar:navigation-updated', getNavigationState());
  }
}

function getSiteConfig(siteId = config.activeSiteId) {
  return config.sites.find((site) => site.id === siteId) || null;
}

function getWindowBackgroundColor() {
  return config?.appearance?.colors?.windowBg || DEFAULT_APPEARANCE.colors.windowBg;
}

function applyWindowAppearance() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const appearance = sanitizeAppearance(config.appearance);
  if (typeof mainWindow.setBackgroundColor === 'function') {
    mainWindow.setBackgroundColor(getWindowBackgroundColor());
  }
  if (typeof mainWindow.setOpacity === 'function') {
    mainWindow.setOpacity(appearance.opacity);
  }
}

function getWindowLayout(reserveRect = false) {
  const display = getTargetDisplay();
  // O shell usa a tela completa ao registrar AppBar: workArea já exclui
  // nossa própria barra e causaria deslocamento progressivo.
  const area = reserveRect ? display.bounds : display.workArea;
  const panelWidth = clampPanelWidth(config.window.panelWidth, display);
  const expanded = Boolean(config.window.expanded);
  const side = config.window.side;
  const docked = Boolean(config.window.docked);
  const width = expanded ? SIDEBAR_WIDTH + RESIZE_HANDLE_WIDTH + panelWidth : SIDEBAR_WIDTH;
  let x;
  let y;
  let height;

  if (docked) {
    // Barra fixa na lateral: respeita a área útil e não cobre a barra de tarefas.
    x = side === 'left' ? area.x : area.x + area.width - width;
    y = area.y;
    height = area.height;
  } else {
    // Janela independente: mantém a âncora do lado da barra ao expandir/recolher.
    height = Math.min(FLOATING_HEIGHT, Math.max(260, area.height - WINDOW_MARGIN * 2));
    const canPreserveAnchor = mainWindow && !mainWindow.isDestroyed()
      && lastAppliedLayout?.docked === false && lastAppliedLayout.side === side;
    const stored = config.window.floatingPosition;

    if (canPreserveAnchor) {
      const previous = mainWindow.getBounds();
      x = side === 'right' ? previous.x + previous.width - width : previous.x;
      y = previous.y;
    } else if (stored && stored.side === side) {
      x = stored.x;
      y = stored.y;
    } else {
      x = side === 'left' ? area.x + WINDOW_MARGIN : area.x + area.width - width - WINDOW_MARGIN;
      y = area.y + WINDOW_MARGIN;
    }
    x = Math.min(Math.max(x, area.x), area.x + area.width - width);
    y = Math.min(Math.max(y, area.y), area.y + area.height - height);
  }

  return { display, bounds: { x: Math.round(x), y: Math.round(y), width, height }, docked, side };
}

function persistFloatingPositionSoon() {
  if (!mainWindow || mainWindow.isDestroyed() || config.window.docked) return;
  const bounds = mainWindow.getBounds();
  config.window.floatingPosition = { x: bounds.x, y: bounds.y, side: config.window.side };
  clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(() => {
    fireAndForget('save-floating-position', saveConfig());
  }, 400);
}

function sendState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sidebar:state-updated', getPublicState());
  }
}

function configureSession(siteId) {
  const partition = `${BASE_PARTITION}-${siteId}`;
  if (configuredSessions.has(partition)) {
    return session.fromPartition(partition);
  }

  const isolatedSession = session.fromPartition(partition, { cache: true });
  if (typeof isolatedSession.setPermissionRequestHandler === 'function') {
    isolatedSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  }
  if (typeof isolatedSession.setPermissionCheckHandler === 'function') {
    isolatedSession.setPermissionCheckHandler(() => false);
  }
  if (typeof isolatedSession.setDisplayMediaRequestHandler === 'function') {
    isolatedSession.setDisplayMediaRequestHandler((_request, callback) => callback({ video: null, audio: null }));
  }
  configuredSessions.add(partition);
  return isolatedSession;
}

function allowNavigation(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function markViewUsed(siteId) {
  const entry = viewEntries.get(siteId);
  if (entry) {
    entry.lastUsed = Date.now();
  }
}

function removeCurrentView() {
  if (!mainWindow || !currentViewId) {
    return;
  }

  const entry = viewEntries.get(currentViewId);
  if (entry) {
    try {
      mainWindow.contentView.removeChildView(entry.view);
    } catch {
      // noop
    }
  }

  currentViewId = null;
  sendNavigationState();
}

function destroyView(siteId) {
  const entry = viewEntries.get(siteId);
  if (!entry) {
    return;
  }

  if (currentViewId === siteId) {
    removeCurrentView();
  }

  try {
    if (!entry.view.webContents.isDestroyed()) {
      entry.view.webContents.destroy();
    }
  } catch (error) {
    logError(`destroyView:${siteId}`, error);
  }

  viewEntries.delete(siteId);
}

function trimViewCache() {
  if (viewEntries.size <= MAX_LIVE_VIEWS) {
    return;
  }

  const candidates = [...viewEntries.entries()]
    .filter(([siteId]) => siteId !== config.activeSiteId && siteId !== currentViewId)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  while (viewEntries.size > MAX_LIVE_VIEWS && candidates.length > 0) {
    const [siteId] = candidates.shift();
    destroyView(siteId);
  }
}

async function deleteFaviconFile(faviconPath) {
  if (!faviconPath) {
    return;
  }

  try {
    await fs.rm(faviconPath, { force: true });
  } catch {
    // noop
  }
}

async function saveFaviconImage(siteId, image) {
  if (!image || image.isEmpty()) {
    return '';
  }

  mkdirSync(getFaviconCacheDir(), { recursive: true });
  const outputPath = path.join(getFaviconCacheDir(), `${siteId}.png`);
  const png = image.resize({ width: 32, height: 32 }).toPNG();
  await fs.writeFile(outputPath, png);
  return outputPath;
}

async function fetchImage(iconUrl) {
  if (typeof iconUrl !== 'string' || !iconUrl) {
    return null;
  }

  if (iconUrl.startsWith('data:image/')) {
    const image = nativeImage.createFromDataURL(iconUrl);
    return image.isEmpty() ? null : image;
  }

  let parsed;
  try {
    parsed = new URL(iconUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || typeof fetch !== 'function') {
    return null;
  }

  const response = await fetch(parsed.toString(), {
    redirect: 'follow',
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(8000) : undefined
  });

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    return null;
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > FAVICON_MAX_BYTES) {
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > FAVICON_MAX_BYTES) {
    return null;
  }

  const image = nativeImage.createFromBuffer(buffer);
  return image.isEmpty() ? null : image;
}

async function updateSiteFavicon(siteId, faviconCandidates = [], pageUrl = '') {
  const site = getSiteConfig(siteId);
  if (!site) {
    return;
  }

  const candidates = [];
  for (const candidate of faviconCandidates) {
    if (typeof candidate === 'string' && candidate) {
      candidates.push(candidate);
    }
  }

  try {
    const page = new URL(pageUrl || site.url);
    candidates.push(new URL('/favicon.ico', page.origin).toString());
  } catch {
    // noop
  }

  for (const candidate of candidates) {
    try {
      const image = await fetchImage(candidate);
      if (!image) {
        continue;
      }

      const nextPath = await saveFaviconImage(siteId, image);
      if (nextPath && site.faviconPath !== nextPath) {
        site.faviconPath = nextPath;
        await saveConfig();
        sendState();
      }
      return;
    } catch (error) {
      logError(`favicon:${siteId}`, error);
    }
  }
}

function configureView(siteId, view) {
  const wc = view.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));

  wc.on('will-navigate', (event, targetUrl) => {
    if (!allowNavigation(targetUrl)) {
      event.preventDefault();
    }
  });

  wc.on('will-redirect', (event, targetUrl) => {
    if (!allowNavigation(targetUrl)) {
      event.preventDefault();
    }
  });

  // Atualiza a barra ao navegar normalmente, em SPAs (pushState), ou ao
  // carregar uma página. Eventos de sites inativos não afetam o painel atual.
  for (const eventName of ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading']) {
    wc.on(eventName, () => {
      if (currentViewId === siteId) sendNavigationState();
    });
  }

  wc.on('page-favicon-updated', (_event, favicons) => {
    fireAndForget(`favicon-update:${siteId}`, updateSiteFavicon(siteId, favicons, wc.getURL()));
  });

  wc.on('did-finish-load', () => {
    markViewUsed(siteId);
    if (currentViewId === siteId) sendNavigationState();
    fireAndForget(`favicon-fallback:${siteId}`, updateSiteFavicon(siteId, [], wc.getURL()));
  });

  wc.on('render-process-gone', () => {
    if (currentViewId === siteId) {
      removeCurrentView();
    }
    viewEntries.delete(siteId);
    // Não reinicie automaticamente uma página que está quebrando em loop.
    // O usuário poderá reabrir o atalho quando quiser.
    sendState();
  });
}

function createSiteView(siteId) {
  const site = getSiteConfig(siteId);
  if (!site) throw new Error('Site não encontrado.');

  const view = new WebContentsView({
    webPreferences: {
      session: configureSession(siteId),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  });
  configureView(siteId, view);
  // Adiciona a view ao layout imediatamente. O carregamento remoto pode demorar,
  // e não deve desordenar a ativação de outro site ou o fechamento das configurações.
  fireAndForget(`load-site:${siteId}`, view.webContents.loadURL(site.url));
  return view;
}

function getOrCreateView(siteId) {
  const existing = viewEntries.get(siteId);
  if (existing && !existing.view.webContents.isDestroyed()) {
    existing.lastUsed = Date.now();
    return existing.view;
  }
  const view = createSiteView(siteId);
  viewEntries.set(siteId, { view, lastUsed: Date.now() });
  return view;
}

function layoutCurrentView() {
  if (!mainWindow || mainWindow.isDestroyed() || !currentViewId || settingsOpen || !config.window.expanded) return;
  const entry = viewEntries.get(currentViewId);
  if (!entry || entry.view.webContents.isDestroyed()) return;

  // SEMPRE usar o tamanho real da área de conteúdo, jamais um layout calculado
  // para outro monitor/estado anterior. Bounds de WebContentsView são locais.
  const { width, height } = mainWindow.getContentBounds();
  const panelX = config.window.side === 'left' ? SIDEBAR_WIDTH + RESIZE_HANDLE_WIDTH : 0;
  const panelWidth = Math.max(0, width - SIDEBAR_WIDTH - RESIZE_HANDLE_WIDTH);
  // Reservar a faixa superior do renderer: WebContentsView é uma view nativa
  // e, se cobrir esses 46px, interceptará os cliques dos botões de navegação.
  entry.view.setBounds({
    x: panelX,
    y: NAVIGATION_BAR_HEIGHT,
    width: panelWidth,
    height: Math.max(0, height - NAVIGATION_BAR_HEIGHT)
  });
}

function showActiveView() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const requestedSiteId = (!settingsOpen && config.window.expanded) ? config.activeSiteId : null;
  if (currentViewId === requestedSiteId && requestedSiteId) {
    layoutCurrentView();
    return;
  }
  removeCurrentView();
  if (!requestedSiteId) return;

  const view = getOrCreateView(requestedSiteId);
  mainWindow.contentView.addChildView(view);
  currentViewId = requestedSiteId;
  markViewUsed(requestedSiteId);
  layoutCurrentView();
  trimViewCache();
  sendNavigationState();
}

function syncWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  config.window.panelWidth = clampPanelWidth(config.window.panelWidth);
  const wantsReservation = Boolean(config.window.docked && config.window.reserveSpace
    && process.platform === 'win32' && mainWindow.isVisible());
  const layout = getWindowLayout(wantsReservation);
  applyWindowAppearance();
  // Reserva de verdade (SHAppBarMessage): maximizar outras janelas passa a
  // respeitar a faixa. Quando flutuante, solta, ocultada ou saindo, desfaz.
  if (!wantsReservation) nativeAppBar?.remove();
  const nativeBounds = wantsReservation && nativeAppBar
    ? nativeAppBar.update({
      display: layout.display,
      side: config.window.side,
      width: layout.bounds.width
    }) : null;
  mainWindow.setAlwaysOnTop(wantsReservation || config.window.alwaysOnTop);
  // Se a API nativa estiver indisponível, não cubra a barra de tarefas.
  const target = nativeBounds || (wantsReservation ? getWindowLayout(false).bounds : layout.bounds);
  const previous = mainWindow.getBounds();
  if (Object.keys(target).some((key) => target[key] !== previous[key])) {
    mainWindow.setBounds(target);
  }
  lastAppliedLayout = { docked: layout.docked, side: layout.side };
  showActiveView();
  refreshTrayMenu();
  sendState();
}

function buildTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="8" y="6" width="48" height="52" rx="16" fill="#0f141d"/>
      <rect x="18" y="14" width="8" height="36" rx="4" fill="#4f8cff"/>
      <rect x="30" y="14" width="16" height="8" rx="4" fill="#93a4b8"/>
      <rect x="30" y="28" width="16" height="8" rx="4" fill="#93a4b8"/>
      <rect x="30" y="42" width="12" height="8" rx="4" fill="#93a4b8"/>
    </svg>
  `.trim();

  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    .resize({ width: 16, height: 16 });
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

async function applySide(side) {
  config.window.side = side === 'left' ? 'left' : 'right';
  await saveConfig();
  syncWindowState();
}

async function toggleDocked() {
  config.window.docked = !config.window.docked;
  await saveConfig();
  syncWindowState();
}

function createTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Mostrar / Ocultar', click: toggleMainWindow },
    {
      label: 'Sempre no topo',
      type: 'checkbox',
      checked: config.window.alwaysOnTop,
      click: () => fireAndForget('tray:always-on-top', (async () => {
        config.window.alwaysOnTop = !config.window.alwaysOnTop;
        await saveConfig();
        syncWindowState();
      })())
    },
    {
      label: 'Lado da barra',
      submenu: [
        {
          label: 'Esquerda',
          type: 'radio',
          checked: config.window.side === 'left',
          click: () => fireAndForget('tray:side:left', applySide('left'))
        },
        {
          label: 'Direita',
          type: 'radio',
          checked: config.window.side === 'right',
          click: () => fireAndForget('tray:side:right', applySide('right'))
        }
      ]
    },
    {
      label: 'Fixar na borda do monitor',
      type: 'checkbox',
      checked: config.window.docked,
      click: () => fireAndForget('tray:toggle-docked', toggleDocked())
    },
    {
      label: 'Reservar espaço para outros aplicativos (Windows)',
      type: 'checkbox',
      checked: config.window.reserveSpace,
      click: () => fireAndForget('tray:toggle-reserve-space', (async () => {
        config.window.reserveSpace = !config.window.reserveSpace;
        await saveConfig();
        syncWindowState();
      })())
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('Edge Sidebar Lite');
  tray.on('click', toggleMainWindow);
  tray.setContextMenu(createTrayMenu());
}

function refreshTrayMenu() {
  if (tray) {
    tray.setContextMenu(createTrayMenu());
  }
}

async function createMainWindow() {
  const { bounds } = getWindowLayout();
  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    show: false,
    resizable: false,
    movable: true, // Somente a pequena alça da barra permite arrastar no modo flutuante.
    minimizable: false,
    maximizable: false,
    closable: true,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: getWindowBackgroundColor(),
    title: 'Edge Sidebar Lite',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.removeMenu();
  nativeAppBar = createWindowsAppBar(mainWindow, screen, () => {
    // Mensagens do shell podem chegar enquanto setBounds está em execução;
    // reagendar fora do WndProc e evitar atualizações em cascata.
    clearTimeout(shellUpdateTimer);
    shellUpdateTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && config.window.docked && mainWindow.isVisible()) {
        nativeAppBar.state.lastSignature = null;
        syncWindowState();
      }
    }, 160);
  });
  applyWindowAppearance();
  mainWindow.setAlwaysOnTop(config.window.alwaysOnTop, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(false);
  if (typeof mainWindow.setIgnoreMouseEvents === 'function') {
    mainWindow.setIgnoreMouseEvents(false);
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('show', () => syncWindowState());
  mainWindow.on('hide', () => nativeAppBar?.remove());
  mainWindow.on('closed', () => {
    clearTimeout(shellUpdateTimer);
    nativeAppBar?.dispose();
    nativeAppBar = null;
  });
  mainWindow.on('resize', layoutCurrentView);
  mainWindow.on('moved', persistFloatingPositionSoon);
  screen.on('display-metrics-changed', syncWindowState);
  screen.on('display-added', syncWindowState);
  screen.on('display-removed', syncWindowState);

  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  await showActiveView();
}

handleIpc('sidebar:get-state', () => getPublicState());

// O renderer só escolhe uma ação fixa. URLs e objetos Session nunca chegam
// ao IPC; o histórico pertence exclusivamente à view já ativa.
handleIpc('sidebar:navigate', (_event, action) => {
  if (!['back', 'forward', 'reload'].includes(action)) {
    throw new Error('Ação de navegação inválida.');
  }
  const entry = currentViewId ? viewEntries.get(currentViewId) : null;
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed() || settingsOpen || !config.window.expanded) {
    return getNavigationState();
  }
  const history = navigationAPI(wc);
  if (action === 'back' && history.canGoBack()) history.goBack();
  if (action === 'forward' && history.canGoForward()) history.goForward();
  if (action === 'reload') wc.reload();
  sendNavigationState();
  return getNavigationState();
});

handleIpc('sidebar:select-site', async (_event, siteId) => {
  if (!getSiteConfig(siteId)) {
    return getPublicState();
  }

  if (settingsOpen) {
    settingsOpen = false;
  }

  if (config.window.expanded && config.activeSiteId === siteId) {
    config.window.expanded = false;
    await saveConfig();
    syncWindowState();
    return getPublicState();
  }

  config.activeSiteId = siteId;
  config.window.expanded = true;
  await saveConfig();
  syncWindowState();
  return getPublicState();
});

handleIpc('sidebar:toggle-expanded', async () => {
  config.window.expanded = !config.window.expanded;
  await saveConfig();
  syncWindowState();
  return getPublicState();
});

handleIpc('sidebar:hide-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  return getPublicState();
});

handleIpc('sidebar:toggle-always-on-top', async () => {
  config.window.alwaysOnTop = !config.window.alwaysOnTop;
  await saveConfig();
  syncWindowState();
  return getPublicState();
});

handleIpc('sidebar:toggle-side', async () => {
  config.window.side = config.window.side === 'left' ? 'right' : 'left';
  await saveConfig();
  syncWindowState();
  return getPublicState();
});

handleIpc('sidebar:toggle-docked', async () => {
  await toggleDocked();
  return getPublicState();
});

handleIpc('sidebar:set-panel-width', async (_event, width, persist = false) => {
  const numericWidth = Number(width);
  if (!Number.isFinite(numericWidth)) throw new Error('Largura inválida.');
  config.window.panelWidth = clampPanelWidth(numericWidth);
  if (persist) {
    await saveConfig();
  }
  syncWindowState();
  return getPublicState();
});

handleIpc('sidebar:set-settings-open', async (_event, isOpen) => {
  settingsOpen = Boolean(isOpen);
  await showActiveView();
  sendState();
  return getPublicState();
});

handleIpc('sidebar:save-settings', async (_event, nextSettings = {}) => {
  const previousSites = new Map(config.sites.map((site) => [site.id, site]));
  const merged = sanitizeConfig({
    window: {
      expanded: config.window.expanded,
      alwaysOnTop: Boolean(nextSettings.window?.alwaysOnTop),
      side: nextSettings.window?.side,
      panelWidth: nextSettings.window?.panelWidth,
      docked: typeof nextSettings.window?.docked === 'boolean' ? nextSettings.window.docked : config.window.docked,
      reserveSpace: typeof nextSettings.window?.reserveSpace === 'boolean' ? nextSettings.window.reserveSpace : config.window.reserveSpace,
      floatingPosition: config.window.floatingPosition
    },
    activeSiteId: nextSettings.activeSiteId ?? config.activeSiteId,
    appearance: nextSettings.appearance ?? config.appearance,
    sites: Array.isArray(nextSettings.sites) ? nextSettings.sites.map((site) => {
      const previous = previousSites.get(site.id);
      return {
        ...site,
        faviconPath: previous?.faviconPath || ''
      };
    }) : config.sites
  });

  const nextIds = new Set(merged.sites.map((site) => site.id));
  for (const [siteId, previousSite] of previousSites.entries()) {
    if (!nextIds.has(siteId)) {
      destroyView(siteId);
      await deleteFaviconFile(previousSite.faviconPath);
    }
  }

  for (const site of merged.sites) {
    const previous = previousSites.get(site.id);
    if (previous && previous.url !== site.url) {
      destroyView(site.id);
      await deleteFaviconFile(previous.faviconPath);
      site.faviconPath = '';
    }
  }

  config = merged;
  if (!config.activeSiteId && config.sites.length > 0) {
    config.activeSiteId = config.sites[0].id;
  }
  if (config.activeSiteId && !getSiteConfig(config.activeSiteId)) {
    config.activeSiteId = config.sites[0]?.id || null;
  }

  await saveConfig();
  syncWindowState();
  return getPublicState();
});

handleIpc('sidebar:save-appearance', async (_event, nextAppearance = {}) => {
  config.appearance = sanitizeAppearance(nextAppearance);
  await saveConfig();
  syncWindowState();
  return getPublicState();
});

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
  await loadConfig();
  await createMainWindow();
  createTray();

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}).catch((error) => {
  logError('app.whenReady', error);
  app.quit();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  clearTimeout(shellUpdateTimer);
  nativeAppBar?.dispose();
  nativeAppBar = null;
});

process.on('unhandledRejection', (error) => {
  logError('unhandledRejection', error);
});
