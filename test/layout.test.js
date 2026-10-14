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
const linkDialogs = [];
const nativeMenus = [];
const externalOpens = [];
const browserOpens = [];
let nextDialogChoice = null;
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
    this.webContents.setWindowOpenHandler = (handler) => { this.webContents.windowOpenHandler = handler; };
    const wc = this.webContents;
    wc.entries = [];
    wc.index = -1;
    wc.reloadCount = 0;
    wc.getURL = () => wc.entries[wc.index] || '';
    wc.isLoading = () => false;
    wc.audible = false;
    wc.isCurrentlyAudible = () => wc.audible;
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
  Menu: { buildFromTemplate: (items) => ({ popup: () => nativeMenus.push(items) }) }, Tray: MockTray, WebContentsView: MockView,
  ipcMain: { handle: (key, fn) => ipc.set(key, fn) }, nativeImage: {
    createFromDataURL: () => fakeImage,
    createFromBuffer: () => fakeImage
  }, screen, session,
  dialog: { showMessageBox: async (_window, opts) => { linkDialogs.push(opts); const choice = nextDialogChoice ?? opts.cancelId; nextDialogChoice = null; return { response: choice }; } },
  shell: { openExternal: async (url) => { externalOpens.push(url); } },
  clipboard: { writeText() {} }
};
const sourcePath = path.join(__dirname, '..', 'src', 'main.js');
const capturedErrors = [];
const sandbox = {
  require: (name) => name === 'electron' ? electron : (name === './windows-appbar' ? require(path.join(__dirname, '..', 'src', 'windows-appbar.js')) : (name === './browser-links' ? { ...require(path.join(__dirname, '..', 'src', 'browser-links.js')), detectedBrowsers: () => [{ name: 'Vivaldi', executable: 'C:\\fake\\vivaldi.exe' }], launchBrowser: async (browser, url) => browserOpens.push([browser.name, url]) } : (name === './config-store' ? require(path.join(__dirname, '..', 'src', 'config-store.js')) : (name === './update-service' ? require(path.join(__dirname, '..', 'src', 'update-service.js')) : (name === './update-security.json' ? require(path.join(__dirname, '..', 'src', 'update-security.json')) : require(name)))))),
  __dirname: path.dirname(sourcePath),
  Buffer, URL, console: { ...console, error: (...args) => capturedErrors.push(args.join(" ")) }, setTimeout, clearTimeout, setImmediate,
  process: { on() {} },
  fetch: async () => ({ ok: false })
};
vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8') + '\nglobalThis.__sidebarTest = { getPublicState, viewEntries, trimViewCache };', sandbox);

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
    assert.equal(readState().window.panelWidth, 1572, 'largura excedente limitada à área disponível');
    assert.equal(readState().layout.maxPanelWidth, 1572, 'limite baseado no monitor, maior que 780px');
    assert.equal(readState().updates.version, '0.4.0-beta.1');
    assert.equal(readState().updates.secureInstall, false, 'sem assinatura não autoriza baixar/instalar');
    await assert.rejects(invoke('sidebar:updates-download'), /bloqueado/i);
    const prefs = await invoke('sidebar:updates-set-preferences', { autoCheck: false, installOnQuit: true });
    assert.equal(prefs.preferences.autoCheck, false);
    assert.equal(readState().updates.preferences.autoCheck, false);
    assert.equal(readState().updates.preferences.installOnQuit, true);
    const savedPrefFile = JSON.parse(fs.readFileSync(path.join(temp, 'config.json'), 'utf8'));
    assert.equal(savedPrefFile.updates.autoCheck, false);

    assert.deepEqual(windowInstance.bounds, { x: 264, y: 16, width: 1640, height: 720 });
    assert.equal(windowInstance.children.length, 1);
    assert.equal(windowInstance.children[0].bounds.width, 1572);
    assert.equal(windowInstance.children[0].bounds.y, 46, 'reservar espaço clicável para a navegação');
    assert.equal(windowInstance.children[0].bounds.height, 674);

    // Links _blank não somem: abre seletor nativo, não cria janela arbitrária.
    const newWindow = windowInstance.children[0].webContents.windowOpenHandler;
    assert.equal(newWindow({ url: 'https://github.com/openai/' }).action, 'deny');
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(linkDialogs.length, 1);
    assert.match(linkDialogs[0].message, /Onde você quer abrir/);
    assert.ok(linkDialogs[0].buttons.includes('Navegador padrão'));
    nextDialogChoice = 2; // Seleciona Vivaldi quando o usuário aprova um link.
    newWindow({ url: 'https://example.com/selecionado' });
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.deepEqual(browserOpens.at(-1), ['Vivaldi', 'https://example.com/selecionado']);
    assert.equal(newWindow({ url: 'javascript:alert(1)' }).action, 'deny');
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(linkDialogs.length, 2, 'protocolo inseguro não abre seletor');

    // Menu de contexto nativo dos sites, sem liberar URLs inseguras.
    const embedded = windowInstance.children[0].webContents;
    embedded.emit('context-menu', {}, { linkURL: 'https://github.com/example', selectionText: '' });
    assert.ok(nativeMenus.length > 0, 'menu de contexto da view apareceu');
    assert.ok(nativeMenus.at(-1).some((item) => item.label === 'Copiar endereço do link'));
    embedded.emit('context-menu', {}, { linkURL: 'javascript:alert(1)', selectionText: 'teste' });
    assert.equal(nativeMenus.at(-1).some((item) => item.label === 'Abrir link aqui'), false);
    // O login Google One Tap não deve abrir uma página branca incorporada.
    let prevented = false;
    embedded.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://accounts.google.com/gsi/select');
    assert.equal(prevented, true, 'bloqueia a navegação OAuth incompatível');
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.ok(linkDialogs.some((item) => item.message?.includes('Login do Google')));
    // Botão direito também na UI da Sidebar.
    windowInstance.webContents.emit('context-menu', {}, {});
    assert.ok(nativeMenus.at(-1).some((item) => item.label === 'Configurações'));

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

    await invoke('sidebar:set-panel-width', 1200, true);
    assert.equal(windowInstance.bounds.width, 1268);
    assert.equal(windowInstance.bounds.x + windowInstance.bounds.width, 1904, 'preservar borda direita ao redimensionar');
    assert.equal(windowInstance.children[0].bounds.width, 1200);
    assert.equal(readState().window.panelWidth, 1200, 'permitir valores > 780px');

    await invoke('sidebar:toggle-expanded');
    assert.equal(windowInstance.bounds.width, 60);
    assert.equal(windowInstance.bounds.x + windowInstance.bounds.width, 1904);
    assert.equal(windowInstance.children.length, 0, 'view não deve cobrir barra recolhida');
    await invoke('sidebar:toggle-expanded');
    assert.equal(windowInstance.bounds.width, 1268);
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

    // Audio must survive LRU eviction even after switching to many sites.
    await invoke('sidebar:select-site', 'test-1');
    const music = sandbox.__sidebarTest.viewEntries.get('test-1').view.webContents;
    music.audible = true;
    music.emit('audio-state-changed', { audible: true });
    assert.equal(readState().sites.find((s) => s.id === 'test-1').playingAudio, true,
      'indicador 🔊 ativado ao detectar áudio');
    for (const id of ['test-2', 'test-3', 'test-4', 'test-5', 'test-6', 'test-7']) {
      await invoke('sidebar:select-site', id);
    }
    assert.ok(sandbox.__sidebarTest.viewEntries.has('test-1'),
      'aba tocando música não pode ser destruída pelo limite de 3');
    assert.ok(sandbox.__sidebarTest.viewEntries.size <= 4,
      'máximo de três abas normais além da protegida');
    music.audible = false;
    music.emit('audio-state-changed', { audible: false });
    assert.ok(sandbox.__sidebarTest.viewEntries.has('test-1'),
      'pausa breve mantém aba por 10s para buffering');
    const audioEntry = sandbox.__sidebarTest.viewEntries.get('test-1');
    clearTimeout(audioEntry.audioReleaseTimer);
    audioEntry.audioReleaseTimer = null;
    audioEntry.audioProtectedUntil = 0; // simula término de tolerância sem aguardar 10s
    sandbox.__sidebarTest.trimViewCache();
    assert.ok(!sandbox.__sidebarTest.viewEntries.has('test-1'),
      'aba sem áudio volta a concorrer ao descarte LRU');
    const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    assert.match(renderer, /site-audio-badge/, 'renderer mostra indicador de áudio');

    await assert.rejects(
      ipc.get('sidebar:hide-window')({ sender: { fake: true } }),
      /não autorizada/i,
      'IPC não deve aceitar chamadas de outros WebContents'
    );
    assert.ok(capturedErrors.some((line) => line.includes('Origem IPC')), 'tentativa de IPC inválida foi registrada');
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
    assert.match(html, /id="dockedInput"/);
    assert.match(html, /id="reserveSpaceInput"/);
    assert.match(html, /id="startWithWindowsInput"/);
    assert.match(html, /step="1"/);
    for (const id of ['backButton', 'forwardButton', 'reloadButton', 'navigationAddress']) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
    await new Promise((resolve) => setTimeout(resolve, 450)); // aguarda gravação debounced da posição
    console.log('OK: menus nativos, Google externo, painel 1200px, navegação e 20 sites.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
