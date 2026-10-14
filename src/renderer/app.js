const elements = {
  app: document.getElementById('app'),
  panelTitle: document.getElementById('panelTitle'),
  panelHint: document.getElementById('panelHint'),
  backButton: document.getElementById('backButton'),
  forwardButton: document.getElementById('forwardButton'),
  reloadButton: document.getElementById('reloadButton'),
  navigationAddress: document.getElementById('navigationAddress'),
  statusText: document.getElementById('statusText'),
  siteButtons: document.getElementById('siteButtons'),
  resizeHandle: document.getElementById('resizeHandle'),
  toggleButton: document.getElementById('toggleButton'),
  hideButton: document.getElementById('hideButton'),
  pinButton: document.getElementById('pinButton'),
  dockButton: document.getElementById('dockButton'),
  dockedInput: document.getElementById('dockedInput'),
  reserveSpaceInput: document.getElementById('reserveSpaceInput'),
  startWithWindowsInput: document.getElementById('startWithWindowsInput'),
  startWithWindowsNote: document.getElementById('startWithWindowsNote'),
  appBarFeedback: document.getElementById('appBarFeedback'),
  switchSideButton: document.getElementById('switchSideButton'),
  settingsButton: document.getElementById('settingsButton'),
  addSiteButton: document.getElementById('addSiteButton'),
  settingsPanel: document.getElementById('settingsPanel'),
  closeSettingsButton: document.getElementById('closeSettingsButton'),
  cancelSettingsButton: document.getElementById('cancelSettingsButton'),
  settingsForm: document.getElementById('settingsForm'),
  sideInput: document.getElementById('sideInput'),
  panelWidthRange: document.getElementById('panelWidthRange'),
  panelWidthNumber: document.getElementById('panelWidthNumber'),
  panelWidthValue: document.getElementById('panelWidthValue'),
  alwaysOnTopInput: document.getElementById('alwaysOnTopInput'),
  addSiteInSettingsButton: document.getElementById('addSiteInSettingsButton'),
  settingsSites: document.getElementById('settingsSites'),
  settingsMessage: document.getElementById('settingsMessage'),
  installedVersion: document.getElementById('installedVersion'),
  updatesMessage: document.getElementById('updatesMessage'),
  checkUpdatesButton: document.getElementById('checkUpdatesButton'),
  autoCheckUpdatesInput: document.getElementById('autoCheckUpdatesInput'),
  autoDownloadUpdatesInput: document.getElementById('autoDownloadUpdatesInput'),
  installOnQuitInput: document.getElementById('installOnQuitInput'),
  newUpdateCard: document.getElementById('newUpdateCard'),
  newUpdateTitle: document.getElementById('newUpdateTitle'),
  newUpdateNotes: document.getElementById('newUpdateNotes'),
  updateSecurityNotice: document.getElementById('updateSecurityNotice'),
  updateProgressWrap: document.getElementById('updateProgressWrap'),
  updateProgress: document.getElementById('updateProgress'),
  updateProgressLabel: document.getElementById('updateProgressLabel'),
  downloadUpdateButton: document.getElementById('downloadUpdateButton'),
  installUpdateButton: document.getElementById('installUpdateButton'),
  laterUpdateButton: document.getElementById('laterUpdateButton'),
  openReleasesButton: document.getElementById('openReleasesButton')
};

let state = null;
let settingsOpen = false;
let draftSites = [];
let draggedSiteId = null;
let resizeSession = null;
let pendingWidth = null;
let resizeFrame = 0;
let updateState = null;

function describeError(error, fallback) {
  return error?.message || fallback;
}

function reportUiError(error, fallback = 'Falha na operação.') {
  const message = describeError(error, fallback);
  console.error('[edge-sidebar-lite:renderer]', error);
  elements.settingsMessage.textContent = message;
}

function runUiTask(task, fallback) {
  Promise.resolve(task).catch((error) => {
    reportUiError(error, fallback);
  });
}

function getActiveSite(sourceState = state) {
  if (!sourceState?.sites?.length) {
    return null;
  }
  return sourceState.sites.find((site) => site.id === sourceState.activeSiteId) || sourceState.sites[0] || null;
}

function fallbackSymbol(site) {
  const source = site?.label || site?.url || '•';
  const match = source.trim().match(/[A-Za-z0-9À-ÿ]/u);
  return match ? match[0].toUpperCase() : '•';
}

function siteShortLabel(site) {
  return (site.label || fallbackSymbol(site)).slice(0, 3).toUpperCase();
}

function createDraftSite() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: '',
    url: 'https://example.com/'
  };
}

function deriveNameFromUrl(rawUrl) {
  try {
    const hostname = new URL(String(rawUrl)).hostname.replace(/^www\./i, '');
    const [firstPart] = hostname.split('.');
    return firstPart ? firstPart.charAt(0).toUpperCase() + firstPart.slice(1) : 'Site';
  } catch {
    return 'Site';
  }
}

function renderUpdate(update) {
  if (!update) return;
  updateState = update;
  elements.installedVersion.textContent = `v${update.version || '—'}`;
  elements.updatesMessage.textContent = update.message || 'Verificações disponíveis.';
  elements.checkUpdatesButton.disabled = ['checking', 'downloading'].includes(update.status);
  const prefs = update.preferences || {};
  elements.autoCheckUpdatesInput.checked = prefs.autoCheck !== false;
  elements.autoDownloadUpdatesInput.checked = Boolean(prefs.autoDownload);
  elements.installOnQuitInput.checked = Boolean(prefs.installOnQuit);
  elements.autoDownloadUpdatesInput.disabled = !update.secureInstall;
  elements.installOnQuitInput.disabled = !update.secureInstall;
  const visible = Boolean(update.available || update.ready) && (update.ready || update.latestVersion !== prefs.postponedVersion);
  elements.newUpdateCard.classList.toggle('hidden', !visible);
  if (!visible) return;
  elements.newUpdateTitle.textContent = `🚀 Nova atualização disponível! Edge Sidebar Lite v${update.latestVersion}`;
  // Nunca interpretar release notes como HTML: são conteúdo externo não confiável.
  elements.newUpdateNotes.textContent = update.notes || 'Melhorias e correções. Consulte o GitHub Releases.';
  elements.downloadUpdateButton.disabled = !update.secureInstall || update.status === 'downloading' || update.ready;
  elements.downloadUpdateButton.classList.toggle('hidden', Boolean(update.ready));
  elements.installUpdateButton.classList.toggle('hidden', !update.ready);
  elements.updateProgressWrap.classList.toggle('hidden', !['downloading', 'downloaded'].includes(update.status));
  const progress = Math.max(0, Math.min(100, Number(update.progress) || 0));
  elements.updateProgress.value = progress;
  elements.updateProgressLabel.textContent = `${Math.round(progress)}%`;
  elements.updateSecurityNotice.textContent = update.secureInstall
    ? 'Instalador verificado por assinatura do publicador. Confirme antes de reiniciar.'
    : 'Download/instalação automática desativados nesta prévia: requerem instalador assinado e validação no Windows. Você pode acompanhar as Releases no GitHub.';
}

async function saveUpdatePreferences() {
  const prefs = {
    autoCheck: elements.autoCheckUpdatesInput.checked,
    autoDownload: elements.autoDownloadUpdatesInput.checked,
    installOnQuit: elements.installOnQuitInput.checked,
    postponedVersion: updateState?.preferences?.postponedVersion || ''
  };
  const saved = await window.sidebarAPI.setUpdatePreferences(prefs);
  renderUpdate(saved);
}

function renderNavigation(navigation = {}) {
  elements.backButton.disabled = !navigation.canGoBack;
  elements.forwardButton.disabled = !navigation.canGoForward;
  const loading = Boolean(navigation.isLoading);
  elements.reloadButton.classList.toggle('loading', loading);
  elements.reloadButton.title = loading ? 'Carregando (clique para recarregar)' : 'Recarregar página';
  // Não renderizar URL via innerHTML: pode conter dados controlados pelo site.
  const url = navigation.url || getActiveSite()?.url || '';
  elements.navigationAddress.title = url || 'Nenhum site aberto';
  try {
    const parsed = new URL(url);
    elements.navigationAddress.textContent = `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    elements.navigationAddress.textContent = url || 'Nenhum site aberto';
  }
}

function render(nextState) {
  state = nextState;
  const expanded = Boolean(state.window.expanded);
  const side = state.window.side === 'left' ? 'left' : 'right';
  const activeSite = getActiveSite();

  elements.app.classList.toggle('expanded', expanded);
  elements.app.classList.toggle('collapsed', !expanded);
  elements.app.classList.toggle('side-left', side === 'left');
  elements.app.classList.toggle('side-right', side === 'right');
  elements.pinButton.classList.toggle('active', Boolean(state.window.alwaysOnTop));
  elements.dockButton.classList.toggle('active', Boolean(state.window.docked));
  elements.dockButton.title = state.window.docked ? 'Soltar como janela independente' : 'Fixar na borda do monitor';
  if (state.appBar?.error) elements.dockButton.title += ` — Reserva indisponível: ${state.appBar.error}`;
  elements.app.classList.toggle('floating', !state.window.docked);

  if (expanded) {
    elements.toggleButton.textContent = side === 'left' ? '⟨' : '⟩';
  } else {
    elements.toggleButton.textContent = side === 'left' ? '⟩' : '⟨';
  }

  elements.panelTitle.textContent = activeSite?.label || 'Nenhum site';
  elements.panelHint.textContent = activeSite
    ? `Painel pronto para ${activeSite.label}.`
    : 'Use o botão + para adicionar o primeiro site.';
  elements.statusText.textContent = state.appBar?.error ? '⚠ Reserva' : (activeSite?.label || 'Sem sites');
  elements.statusText.title = state.appBar?.error || '';
  renderNavigation(state.navigation);

  renderSiteButtons(activeSite?.id || null);

  if (settingsOpen) {
    syncSettingsChrome();
  }
  renderUpdate(state.updates);
}

function renderSiteButtons(activeSiteId) {
  elements.siteButtons.replaceChildren();

  for (const site of state.sites) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-button';
    button.title = site.playingAudio ? `${site.label} — 🔊 áudio em reprodução (aba protegida)` : site.label;
    button.setAttribute('aria-label', site.playingAudio ? `${site.label}, áudio em reprodução` : site.label);
    button.classList.toggle('active', site.id === activeSiteId);

    if (site.faviconUrl) {
      const image = document.createElement('img');
      image.className = 'site-favicon';
      image.alt = '';
      image.src = site.faviconUrl;
      image.addEventListener('error', () => {
        image.remove();
        const fallback = document.createElement('span');
        fallback.className = 'site-fallback';
        fallback.textContent = fallbackSymbol(site);
        button.prepend(fallback);
      }, { once: true });
      button.appendChild(image);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'site-fallback';
      fallback.textContent = fallbackSymbol(site);
      button.appendChild(fallback);
    }

    if (site.playingAudio) {
      const audioBadge = document.createElement('span');
      audioBadge.className = 'site-audio-badge';
      audioBadge.textContent = '🔊';
      audioBadge.setAttribute('aria-hidden', 'true');
      audioBadge.title = 'Áudio em reprodução — aba preservada';
      button.appendChild(audioBadge);
    }

    const caption = document.createElement('span');
    caption.className = 'site-label-mini';
    caption.textContent = siteShortLabel(site);
    button.appendChild(caption);

    button.addEventListener('click', () => {
      elements.settingsMessage.textContent = '';
      runUiTask(window.sidebarAPI.selectSite(site.id), 'Falha ao trocar de site.');
    });

    elements.siteButtons.appendChild(button);
  }
}

function syncPanelWidthInputs(width = state.window.panelWidth) {
  const min = String(state.layout.minPanelWidth);
  const max = String(state.layout.maxPanelWidth);
  elements.panelWidthRange.min = min;
  elements.panelWidthRange.max = max;
  elements.panelWidthRange.step = '1';
  elements.panelWidthRange.value = String(width);
  elements.panelWidthNumber.min = min;
  elements.panelWidthNumber.max = max;
  elements.panelWidthNumber.step = '1';
  elements.panelWidthNumber.value = String(width);
  elements.panelWidthValue.textContent = `${width} px`;
}

function syncSettingsChrome() {
  if (!elements.alwaysOnTopInput.dataset.dirty) {
    elements.alwaysOnTopInput.checked = Boolean(state.window.alwaysOnTop);
  }
  if (!elements.dockedInput.dataset.dirty) {
    elements.dockedInput.checked = Boolean(state.window.docked);
  }
  if (!elements.reserveSpaceInput.dataset.dirty) {
    elements.reserveSpaceInput.checked = state.window.reserveSpace !== false;
  }
  if (!elements.startWithWindowsInput.dataset.dirty) {
    elements.startWithWindowsInput.checked = Boolean(state.window.startWithWindows);
  }
  elements.startWithWindowsInput.disabled = !state.autostartSupported;
  elements.startWithWindowsNote.textContent = state.autostartSupported
    ? 'Ativa a inicialização automática no login (pode ser desativada aqui).'
    : 'Disponível somente no .exe instalado no Windows.';
  elements.reserveSpaceInput.disabled = !elements.dockedInput.checked;
  const shouldReserve = elements.dockedInput.checked && elements.reserveSpaceInput.checked;
  elements.appBarFeedback.textContent = state.appBar?.error && shouldReserve
    ? `⚠ Espaço ainda não reservado: ${state.appBar.error}`
    : (shouldReserve && state.appBar?.registered ? '✓ Faixa reservada no Windows.' : '');
  if (!elements.sideInput.dataset.dirty) {
    elements.sideInput.value = state.window.side;
  }
  const widthValue = elements.panelWidthNumber.dataset.dirty ? Number(elements.panelWidthNumber.value) : state.window.panelWidth;
  syncPanelWidthInputs(widthValue);
}

function collectDraftSites() {
  const rows = [...elements.settingsSites.querySelectorAll('.site-item')];
  return rows.map((row) => ({
    id: row.dataset.siteId,
    label: row.querySelector('[data-role="label"]')?.value.trim() || '',
    url: row.querySelector('[data-role="url"]')?.value.trim() || ''
  }));
}

function renderDraftSites() {
  elements.settingsSites.replaceChildren();

  if (!draftSites.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-sites';
    empty.textContent = 'Nenhum site cadastrado.';
    elements.settingsSites.appendChild(empty);
    return;
  }

  for (const site of draftSites) {
    const item = document.createElement('div');
    item.className = 'site-item';
    item.dataset.siteId = site.id;
    item.draggable = true;

    const header = document.createElement('div');
    header.className = 'site-item-header';

    const title = document.createElement('div');
    title.className = 'site-item-title';
    const badge = document.createElement('span');
    badge.className = 'site-badge';
    badge.textContent = fallbackSymbol(site);
    const badgeText = document.createElement('strong');
    badgeText.textContent = site.label || deriveNameFromUrl(site.url) || 'Novo site';
    title.append(badge, badgeText);

    const actions = document.createElement('div');
    actions.className = 'site-item-actions';

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '≡';
    dragHandle.title = 'Arrastar para reordenar';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-button';
    removeButton.textContent = '✕';
    removeButton.title = 'Remover site';
    removeButton.addEventListener('click', () => {
      draftSites = collectDraftSites().filter((entry) => entry.id !== site.id);
      renderDraftSites();
    });

    actions.append(dragHandle, removeButton);
    header.append(title, actions);

    const labelField = document.createElement('label');
    labelField.className = 'field-label';
    labelField.textContent = 'Nome';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = site.label || '';
    labelInput.maxLength = 48;
    labelInput.dataset.role = 'label';

    const urlField = document.createElement('label');
    urlField.className = 'field-label';
    urlField.textContent = 'URL HTTPS';
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.value = site.url || 'https://example.com/';
    urlInput.placeholder = 'https://example.com/';
    urlInput.dataset.role = 'url';

    labelInput.addEventListener('input', () => {
      badgeText.textContent = labelInput.value.trim() || deriveNameFromUrl(urlInput.value) || 'Novo site';
      badge.textContent = fallbackSymbol({ label: labelInput.value, url: urlInput.value });
    });

    urlInput.addEventListener('input', () => {
      if (!labelInput.value.trim()) {
        badgeText.textContent = deriveNameFromUrl(urlInput.value) || 'Novo site';
      }
      badge.textContent = fallbackSymbol({ label: labelInput.value, url: urlInput.value });
    });

    item.addEventListener('dragstart', () => {
      draggedSiteId = site.id;
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      draggedSiteId = null;
      item.classList.remove('dragging');
      [...elements.settingsSites.querySelectorAll('.site-item')].forEach((node) => node.classList.remove('drag-target'));
    });

    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (draggedSiteId && draggedSiteId !== site.id) {
        item.classList.add('drag-target');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-target');
    });

    item.addEventListener('drop', (event) => {
      event.preventDefault();
      item.classList.remove('drag-target');
      if (!draggedSiteId || draggedSiteId === site.id) {
        return;
      }

      const current = collectDraftSites();
      const fromIndex = current.findIndex((entry) => entry.id === draggedSiteId);
      const toIndex = current.findIndex((entry) => entry.id === site.id);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }

      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);
      draftSites = current;
      renderDraftSites();
    });

    item.append(header, labelField, labelInput, urlField, urlInput);
    elements.settingsSites.appendChild(item);
  }
}

async function openSettings({ addSite = false } = {}) {
  const wasOpen = settingsOpen;
  settingsOpen = true;
  elements.settingsPanel.classList.remove('hidden');
  elements.settingsPanel.setAttribute('aria-hidden', 'false');
  elements.settingsMessage.textContent = '';

  draftSites = wasOpen
    ? collectDraftSites()
    : state.sites.map((site) => ({ id: site.id, label: site.label, url: site.url }));
  if (addSite) {
    draftSites.push(createDraftSite());
  }

  delete elements.alwaysOnTopInput.dataset.dirty;
  delete elements.dockedInput.dataset.dirty;
  delete elements.reserveSpaceInput.dataset.dirty;
  delete elements.startWithWindowsInput.dataset.dirty;
  delete elements.sideInput.dataset.dirty;
  delete elements.panelWidthNumber.dataset.dirty;
  syncSettingsChrome();
  renderDraftSites();
  await window.sidebarAPI.setSettingsOpen(true);

  if (addSite) {
    const rows = [...elements.settingsSites.querySelectorAll('.site-item')];
    rows.at(-1)?.querySelector('[data-role="url"]')?.focus();
  }
}

async function closeSettings() {
  settingsOpen = false;
  elements.settingsPanel.classList.add('hidden');
  elements.settingsPanel.setAttribute('aria-hidden', 'true');
  elements.settingsMessage.textContent = '';
  draftSites = [];
  await window.sidebarAPI.setSettingsOpen(false);
}

function validateSites(sites) {
  for (const site of sites) {
    try {
      const parsed = new URL(site.url);
      if (parsed.protocol !== 'https:') {
        throw new Error('Somente URLs HTTPS são permitidas.');
      }
    } catch {
      throw new Error(`URL inválida: ${site.url || 'vazia'}`);
    }
  }
}

async function saveSettings(event) {
  event.preventDefault();
  try {
    const sites = collectDraftSites();
    validateSites(sites);
    // Não permita que um número antigo/inválido bloqueie todo o formulário.
    const min = state.layout.minPanelWidth;
    const max = state.layout.maxPanelWidth;
    const typed = Number(elements.panelWidthNumber.value);
    const width = Number.isFinite(typed) && typed > 0
      ? Math.min(max, Math.max(min, Math.round(typed)))
      : state.window.panelWidth;
    elements.settingsMessage.textContent = 'Salvando...';
    const activeSiteStillExists = sites.some((site) => site.id === state.activeSiteId);
    await window.sidebarAPI.saveSettings({
      window: {
        alwaysOnTop: elements.alwaysOnTopInput.checked,
        docked: elements.dockedInput.checked,
        reserveSpace: elements.reserveSpaceInput.checked,
        startWithWindows: elements.startWithWindowsInput.checked,
        side: elements.sideInput.value,
        panelWidth: width
      },
      activeSiteId: activeSiteStillExists ? state.activeSiteId : (sites[0]?.id || null),
      sites
    });
    await closeSettings();
  } catch (error) {
    reportUiError(error, 'Falha ao salvar.');
  }
}

function beginResize(event) {
  if (!state?.window?.expanded) {
    return;
  }

  resizeSession = {
    startScreenX: event.screenX,
    startWidth: state.window.panelWidth
  };
  document.body.classList.add('resizing');
  event.preventDefault();
}

function queuePanelResize(width, persist) {
  const nextWidth = Math.round(width);

  if (persist) {
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = 0;
      pendingWidth = null;
    }
    runUiTask(window.sidebarAPI.setPanelWidth(nextWidth, true), 'Falha ao redimensionar o painel.');
    return;
  }

  pendingWidth = nextWidth;
  if (resizeFrame) {
    return;
  }

  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    const widthToApply = pendingWidth;
    pendingWidth = null;
    runUiTask(window.sidebarAPI.setPanelWidth(widthToApply, false), 'Falha ao redimensionar o painel.');
  });
}

function handleResizeMove(event) {
  if (!resizeSession) {
    return;
  }

  const delta = state.window.side === 'left'
    ? event.screenX - resizeSession.startScreenX
    : resizeSession.startScreenX - event.screenX;
  queuePanelResize(resizeSession.startWidth + delta, false);
}

function finishResize(event) {
  if (!resizeSession) {
    return;
  }

  const delta = state.window.side === 'left'
    ? event.screenX - resizeSession.startScreenX
    : resizeSession.startScreenX - event.screenX;
  queuePanelResize(resizeSession.startWidth + delta, true);
  resizeSession = null;
  document.body.classList.remove('resizing');
}

async function initialize() {
  const initialState = await window.sidebarAPI.getState();
  render(initialState);

  window.sidebarAPI.onStateUpdated((nextState) => {
    render(nextState);
  });
  window.sidebarAPI.onUpdatesState((update) => renderUpdate(update));
  window.sidebarAPI.onNavigationUpdated((navigation) => {
    // Atualiza só a barra de navegação; não recria ícones a cada evento de site.
    if (state) state.navigation = navigation;
    renderNavigation(navigation);
  });

  elements.backButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.navigate('back'), 'Falha ao voltar página.');
  });
  elements.forwardButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.navigate('forward'), 'Falha ao avançar página.');
  });
  elements.reloadButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.navigate('reload'), 'Falha ao recarregar página.');
  });

  elements.toggleButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.toggleExpanded(), 'Falha ao alternar o painel.');
  });

  elements.hideButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.hideWindow(), 'Falha ao ocultar a barra.');
  });

  elements.dockButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.toggleDocked(), 'Falha ao fixar/soltar a janela.');
  });

  elements.pinButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.toggleAlwaysOnTop(), 'Falha ao alternar o modo sempre no topo.');
  });

  elements.switchSideButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.toggleSide(), 'Falha ao alterar o lado da barra.');
  });

  elements.settingsButton.addEventListener('click', () => {
    runUiTask((async () => {
      if (!state.window.expanded) {
        await window.sidebarAPI.toggleExpanded();
      }
      await openSettings();
    })(), 'Falha ao abrir as configurações.');
  });

  const openSettingsForNewSite = () => {
    runUiTask((async () => {
      if (!state.window.expanded) {
        await window.sidebarAPI.toggleExpanded();
      }
      await openSettings({ addSite: true });
    })(), 'Falha ao adicionar novo site.');
  };

  elements.addSiteButton.addEventListener('click', openSettingsForNewSite);
  elements.addSiteInSettingsButton.addEventListener('click', () => {
    draftSites = collectDraftSites();
    draftSites.push(createDraftSite());
    renderDraftSites();
    elements.settingsSites.querySelector('.site-item:last-child [data-role="url"]')?.focus();
  });

  elements.closeSettingsButton.addEventListener('click', () => {
    runUiTask(closeSettings(), 'Falha ao fechar as configurações.');
  });
  elements.cancelSettingsButton.addEventListener('click', () => {
    runUiTask(closeSettings(), 'Falha ao fechar as configurações.');
  });
  elements.settingsForm.addEventListener('submit', saveSettings);

  elements.checkUpdatesButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.checkUpdates().then(renderUpdate), 'Falha ao procurar atualização.');
  });
  for (const input of [elements.autoCheckUpdatesInput, elements.autoDownloadUpdatesInput, elements.installOnQuitInput]) {
    input.addEventListener('change', () => runUiTask(saveUpdatePreferences(), 'Falha ao salvar as preferências de atualização.'));
  }
  elements.downloadUpdateButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.downloadUpdate().then(renderUpdate), 'Download indisponível.');
  });
  elements.installUpdateButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.installUpdate().then(renderUpdate), 'Falha ao instalar a atualização.');
  });
  elements.laterUpdateButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.postponeUpdate().then(renderUpdate), 'Falha ao adiar atualização.');
    elements.newUpdateCard.classList.add('hidden');
  });
  elements.openReleasesButton.addEventListener('click', () => {
    runUiTask(window.sidebarAPI.openReleases(), 'Não foi possível abrir o GitHub Releases.');
  });

  elements.resizeHandle.addEventListener('mousedown', beginResize);
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', finishResize);

  elements.alwaysOnTopInput.addEventListener('change', (event) => { event.target.dataset.dirty = 'true'; });
  elements.dockedInput.addEventListener('change', (event) => {
    event.target.dataset.dirty = 'true';
    elements.reserveSpaceInput.disabled = !event.target.checked;
  });
  elements.reserveSpaceInput.addEventListener('change', (event) => { event.target.dataset.dirty = 'true'; });
  elements.startWithWindowsInput.addEventListener('change', (event) => { event.target.dataset.dirty = 'true'; });
  elements.sideInput.addEventListener('change', (event) => { event.target.dataset.dirty = 'true'; });
  elements.panelWidthRange.addEventListener('input', () => {
    elements.panelWidthNumber.dataset.dirty = 'true';
    elements.panelWidthNumber.value = elements.panelWidthRange.value;
    elements.panelWidthValue.textContent = `${elements.panelWidthRange.value} px`;
  });
  elements.panelWidthNumber.addEventListener('input', () => {
    elements.panelWidthNumber.dataset.dirty = 'true';
    const value = Number(elements.panelWidthNumber.value);
    if (Number.isFinite(value) && value > 0) {
      const min = Number(elements.panelWidthNumber.min);
      const max = Number(elements.panelWidthNumber.max);
      const clamped = Math.min(Math.max(value, min), max);
      elements.panelWidthRange.value = String(clamped);
      elements.panelWidthValue.textContent = `${Math.round(clamped)} px`;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsOpen) {
      runUiTask(closeSettings(), 'Falha ao fechar as configurações.');
    }
  });
}

initialize().catch((error) => {
  reportUiError(error, 'Falha na inicialização.');
});
