// Testes de geometria/IPC com substitutos mínimos de Electron.
// Não substituem um teste gráfico na máquina Windows.
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sidebar-test-'));
const config = path.join(temp, 'config.json');
fs.writeFileSync(config, JSON.stringify({
  window: { side: 'right', docked: false, expanded: true, panelWidth: 1736 },
  sites: [
    { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
    { id: 'whatsapp', label: 'WhatsApp', url: 'https://web.whatsapp.com/' }
  ],
  activeSiteId: 'chatgpt'
}));

let windowInstance;
const sentMessages = [];
const ipc = new Map();
const screen = new EventEmitter();
const display = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
screen.getPrimaryDisplay = () => display;
screen.getDisplayMatching = () => display;
const sessionMap = new Map();
const session = {
  fromPartition(partition) {
    if (!sessionMap.has(partition)) {
      sessionMap.set(partition, {
        setPermissionRequestHandler() {},
        setPermissionCheckHandler() {},
        setDisplayMediaRequestHandler() {}
      });
    }
    return sessionMap.get(partition);
  }
};
class MockWindow extends EventEmitter {
  constructor(bounds) {
    super();
    windowInstance = this;
    this.bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    this.webContents = new EventEmitter();
    this.webContents.send = (channel, payload) => sentMessages.push({ channel, payload });
    this.children = [];
    this.contentView = {
      addChildView: (view) => { if (!this.children.includes(view)) this.children.push(view); },
      removeChildView: (view) => { this.children = this.children.filter((item) => item !== view); }
    };
    this.visible = false;
  }
  removeMenu() {}
  setBackgroundColor() {}
  setOpacity() {}
  setAlwaysOnTop() {}
  setVisibleOnAllWorkspaces() {}
  setIgnoreMouseEvents() {}
  getBounds() { return { ...this.bounds }; }
  getContentBounds() { return { ...this.bounds }; }
  setBounds(next) {
    const prev = this.bounds;
    this.bounds = { ...next };
    if (next.width !== prev.width || next.height !== prev.height) this.emit('resize');
    if (next.x !== prev.x || next.y !== prev.y) this.emit('moved');
  }
  isDestroyed() { return false; }
  show() { this.visible = true; this.emit('show'); }
  hide() { this.visible = false; }
  isVisible() { return this.visible; }
  focus() {}
  async loadFile() { this.emit('ready-to-show'); }
}
class MockView {
  constructor(opts) {
    this.options = opts;
    this.webContents = new EventEmitter();
    this.webContents.isDestroyed = () => false;
    this.webContents.destroy = () => {};
    this.webContents.setWindowOpenHandler = () => {};
    const wc = this.webContents;
    wc.entries = [];
    wc.index = -1;
    wc.reloadCount = 0;
    wc.getURL = () => wc.entries[wc.index] || '';
    wc.isLoading = () => false;
    wc.canGoBack = () => wc.index > 0;
    wc.canGoForward = () => wc.index < wc.entries.length - 1;
    wc.goBack = () => { if (wc.canGoBack()) { wc.index -= 1; wc.emit('did-navigate', {}, wc.getURL()); } };
    wc.goForward = () => { if (wc.canGoForward()) { wc.index += 1; wc.emit('did-navigate', {}, wc.getURL()); } };
    wc.reload = () => { wc.reloadCount++; wc.emit('did-finish-load'); };
    wc.loadURL = async (url) => {
      wc.entries.splice(wc.index + 1);
      wc.entries.push(url);
      wc.index = wc.entries.length - 1;
      wc.emit('did-navigate', {}, url);
    };
    this.bounds = null;
  }
  setBounds(bounds) { this.bounds = bounds; }
}
class MockTray extends EventEmitter {
  setContextMenu() {}
  setToolTip() {}
}
const fakeImage = { resize() { return this; }, isEmpty() { return false; }, toPNG() { return Buffer.from('PNG'); } };
const app = new EventEmitter();
app.getPath = () => temp;
app.whenReady = () => Promise.resolve();
app.requestSingleInstanceLock = () => true;
app.quit = () => {};
const electron = {
  app, BrowserWindow: MockWindow,
  Menu: { buildFromTemplate: (items) => items }, Tray: MockTray, WebContentsView: MockView,
  ipcMain: { handle: (key, fn) => ipc.set(key, fn) }, nativeImage: {
    createFromDataURL: () => fakeImage,
    createFromBuffer: () => fakeImage
  }, screen, session
};
const sourcePath = path.join(__dirname, '..', 'src', 'main.js');
const capturedErrors = [];
const sandbox = {
  require: (name) => name === 'electron' ? electron : (name === './windows-appbar' ? require(path.join(__dirname, '..', 'src', 'windows-appbar.js')) : require(name)),
  __dirname: path.dirname(sourcePath),
  Buffer, URL, console: { ...console, error: (...args) => capturedErrors.push(args.join(" ")) }, setTimeout, clearTimeout,
  process: { on() {} },
  fetch: async () => ({ ok: false })
};
vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8') + '\nglobalThis.__sidebarTest = { getPublicState };', sandbox);

async function waitForReady() {
  for (let i=0; i<30 && !windowInstance; i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(windowInstance, 'BrowserWindow criada');
  for (let i=0; i<5; i++) await Promise.resolve();
}
async function invoke(channel, ...args) {
  const handler = ipc.get(channel);
  assert.ok(handler, `IPC ${channel}`);
  return handler({ sender: windowInstance.webContents }, ...args);
}

(async () => {
  try {
    await waitForReady();
    const readState = () => sandbox.__sidebarTest.getPublicState();
    assert.equal(readState().window.panelWidth, 420, 'corrigir largura antiga 1736');
    assert.deepEqual(windowInstance.bounds, { x: 1416, y: 16, width: 488, height: 720 });
    assert.equal(windowInstance.children.length, 1);
    assert.equal(windowInstance.children[0].bounds.width, 420);
    assert.equal(windowInstance.children[0].bounds.y, 46, 'reservar espaço clicável para a navegação');
    assert.equal(windowInstance.children[0].bounds.height, 674);

    // Navegação da própria view (não compartilha histórico entre sites).
    const chatWc = windowInstance.children[0].webContents;
    assert.equal(readState().navigation.canGoBack, false);
    await chatWc.loadURL('https://chatgpt.com/c/primeira');
    assert.equal(readState().navigation.canGoBack, true);
    assert.equal(readState().navigation.canGoForward, false);
    assert.equal(readState().navigation.url, 'https://chatgpt.com/c/primeira');
    await invoke('sidebar:navigate', 'back');
    assert.equal(chatWc.getURL(), 'https://chatgpt.com/');
    assert.equal(readState().navigation.canGoForward, true);
    await invoke('sidebar:navigate', 'forward');
    assert.equal(chatWc.getURL(), 'https://chatgpt.com/c/primeira');
    await invoke('sidebar:navigate', 'reload');
    assert.equal(chatWc.reloadCount, 1);
    await assert.rejects(invoke('sidebar:navigate', 'javascript:alert(1)'), /inválida/i);
    assert.ok(sentMessages.some(({ channel }) => channel === 'sidebar:navigation-updated'));

    await invoke('sidebar:set-panel-width', 600, true);
    assert.equal(windowInstance.bounds.width, 668);
    assert.equal(windowInstance.bounds.x + windowInstance.bounds.width, 1904, 'preservar borda direita ao redimensionar');
    assert.equal(windowInstance.children[0].bounds.width, 600);

    await invoke('sidebar:toggle-expanded');
    assert.equal(windowInstance.bounds.width, 60);
    assert.equal(windowInstance.bounds.x + windowInstance.bounds.width, 1904);
    assert.equal(windowInstance.children.length, 0, 'view não deve cobrir barra recolhida');
    await invoke('sidebar:toggle-expanded');
    assert.equal(windowInstance.bounds.width, 668);
    assert.equal(windowInstance.children.length, 1);

    await invoke('sidebar:set-settings-open', true);
    assert.equal(windowInstance.children.length, 0, 'configurações sem view nativa por cima');
    assert.equal(readState().navigation.canGoBack, false, 'ocultar histórico durante configurações');
    await invoke('sidebar:set-settings-open', false);
    assert.equal(windowInstance.children.length, 1);

    await invoke('sidebar:select-site', 'whatsapp');
    assert.equal(windowInstance.children.length, 1);
    assert.equal(readState().activeSiteId, 'whatsapp');
    assert.equal(readState().navigation.canGoBack, false, 'outro site não herda histórico do ChatGPT');
    // Navegação de views inativas não pode alterar o painel atual.
    const countBeforeInactive = sentMessages.filter(({ channel }) => channel === 'sidebar:navigation-updated').length;
    await chatWc.loadURL('https://chatgpt.com/c/inativa');
    assert.equal(sentMessages.filter(({ channel }) => channel === 'sidebar:navigation-updated').length, countBeforeInactive);

    await invoke('sidebar:toggle-side');
    assert.equal(windowInstance.bounds.x, 16);
    assert.equal(windowInstance.children[0].bounds.x, 68, 'WebContentsView à direita da barra esquerda');

    await invoke('sidebar:toggle-docked');
    assert.equal(windowInstance.bounds.y, 0);
    assert.equal(windowInstance.bounds.height, 1040);
    assert.equal(readState().window.docked, true);
    await invoke('sidebar:toggle-docked');
    assert.equal(windowInstance.bounds.height, 720);

    // Simula um arraste pelo topo da janela flutuante e nova largura.
    windowInstance.setBounds({ x: 270, y: 100, width: windowInstance.bounds.width, height: 720 });
    await invoke('sidebar:set-panel-width', 630, true);
    assert.equal(windowInstance.bounds.x, 270, 'lado esquerdo mantém ponto de arraste');
    assert.equal(windowInstance.bounds.y, 100, 'altura da janela flutuante permanece após largura mudar');

    const sites = Array.from({ length: 20 }, (_, i) => ({ id: `test-${i}`, label: `Site ${i}`, url: `https://example.com/${i}` }));
    await invoke('sidebar:save-settings', { window: { panelWidth: 540, docked: false, side: 'left', alwaysOnTop: false }, sites, activeSiteId: sites[0].id });
    assert.equal(readState().sites.length, 20, 'sem limite artificial de atalhos');
    assert.equal(readState().window.panelWidth, 540);
    assert.equal(windowInstance.bounds.width, 608);

    await assert.rejects(
      ipc.get('sidebar:hide-window')({ sender: { fake: true } }),
      /não autorizada/i,
      'IPC não deve aceitar chamadas de outros WebContents'
    );
    assert.ok(capturedErrors.some((line) => line.includes('Origem IPC')), 'tentativa de IPC inválida foi registrada');
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
    assert.match(html, /id="dockedInput"/);
    assert.match(html, /id="reserveSpaceInput"/);
    assert.match(html, /step="1"/);
    for (const id of ['backButton', 'forwardButton', 'reloadButton', 'navigationAddress']) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
    await new Promise((resolve) => setTimeout(resolve, 450)); // aguarda gravação debounced da posição
    console.log('OK: navegação voltar/avançar/recarregar, histórico isolado, toolbar, layout e 20 sites.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
