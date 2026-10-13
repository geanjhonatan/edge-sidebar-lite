'use strict';

// Windows Application Desktop Toolbar integration: this registers the *actual*
// Electron HWND as an AppBar. Merely positioning a BrowserWindow at the screen
// edge does not change the Windows work area.
// All calls are confined to the trusted Electron main process.
const CALLBACK_MESSAGE = 0xb271; // WM_APP custom appbar notification
const ABN_POSCHANGED = 1;
const ABM_NEW = 0;
const ABM_REMOVE = 1;
const ABM_QUERYPOS = 2;
const ABM_SETPOS = 3;
const ABE_LEFT = 0;
const ABE_RIGHT = 2;

function createWindowsAppBar(win, screen, onPositionChanged = () => {}) {
  const state = {
    supported: process.platform === 'win32',
    registered: false,
    error: '',
    lastSignature: null,
    lastBounds: null
  };
  let messageHooked = false;
  let ffi = null;

  function loadNative() {
    if (ffi) return ffi;
    if (process.platform !== 'win32') throw new Error('Reserva de espaço disponível apenas no Windows.');
    let koffi;
    try {
      koffi = require('koffi');
    } catch {
      throw new Error('Dependência nativa koffi ausente. Feche a Sidebar e execute npm install.');
    }
    const RECT = koffi.struct('SidebarAppBarRECT', {
      left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t'
    });
    const HWND = koffi.pointer('SidebarAppBarHWND', koffi.opaque());
    const APPBARDATA = koffi.struct('SidebarAPPBARDATA', {
      cbSize: 'uint32_t',
      hWnd: HWND,
      uCallbackMessage: 'uint32_t',
      uEdge: 'uint32_t',
      rc: RECT,
      lParam: 'intptr_t'
    });
    const shell = koffi.load('shell32.dll');
    const SHAppBarMessage = shell.func('__stdcall', 'SHAppBarMessage', 'uintptr_t', [
      'uint32_t', koffi.inout(koffi.pointer(APPBARDATA))
    ]);
    ffi = { koffi, APPBARDATA, SHAppBarMessage };
    return ffi;
  }

  function makeData(side, rect) {
    const { koffi, APPBARDATA } = loadNative();
    const handle = win.getNativeWindowHandle();
    // Electron's HWND is a little-endian pointer value, not a pointer to the
    // returned Buffer itself. Avoid truncating 64-bit handles through Number.
    const hwnd = handle.length === 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
    return {
      cbSize: koffi.sizeof(APPBARDATA),
      hWnd: hwnd,
      uCallbackMessage: CALLBACK_MESSAGE,
      uEdge: side === 'left' ? ABE_LEFT : ABE_RIGHT,
      rc: rect || { left: 0, top: 0, right: 0, bottom: 0 },
      lParam: 0
    };
  }

  function hookNotifications() {
    if (messageHooked || typeof win.hookWindowMessage !== 'function') return;
    win.hookWindowMessage(CALLBACK_MESSAGE, (wParam) => {
      // ABN_POSCHANGED is sent after the taskbar or another appbar moves.
      if (state.registered && wParam.readUInt32LE(0) === ABN_POSCHANGED) {
        onPositionChanged();
      }
    });
    messageHooked = true;
  }

  function remove() {
    if (!state.registered) return;
    try {
      const { SHAppBarMessage } = loadNative();
      SHAppBarMessage(ABM_REMOVE, makeData('left'));
    } catch (error) {
      state.error = error.message;
    } finally {
      state.registered = false;
      state.lastSignature = null;
      state.lastBounds = null;
    }
  }

  function update({ display, side, width, force = false }) {
    if (process.platform !== 'win32') return null;
    try {
      const { SHAppBarMessage } = loadNative();
      hookNotifications();
      // screen.bounds is the monitor's FULL rectangle. screen.workArea is
      // already affected by our own appbar and must never be fed back here.
      // Keep the full monitor WIDTH for edge placement, but honor the taskbar
      // top/bottom (workArea.y and workArea.height). Our own left/right appbar
      // changes workArea.width only, which we intentionally ignore here.
      const requestedDip = {
        ...display.bounds,
        y: display.workArea.y,
        height: display.workArea.height
      };
      const physical = screen.dipToScreenRect(win, requestedDip);
      const pxWidth = Math.max(1, Math.round(width * (display.scaleFactor || 1)));
      const signature = [display.id, side, pxWidth, physical.x, physical.y, physical.width, physical.height].join(':');
      if (!force && state.registered && signature === state.lastSignature) {
        return state.lastBounds;
      }
      if (!state.registered) {
        const registration = SHAppBarMessage(ABM_NEW, makeData(side));
        if (!registration) throw new Error('O Windows recusou registrar a barra como AppBar.');
        state.registered = true;
      }
      const physicalRight = physical.x + physical.width;
      const data = makeData(side, {
        left: side === 'left' ? physical.x : physicalRight - pxWidth,
        top: physical.y,
        right: side === 'left' ? physical.x + pxWidth : physicalRight,
        bottom: physical.y + physical.height
      });
      if (!SHAppBarMessage(ABM_QUERYPOS, data)) {
        throw new Error('ABM_QUERYPOS não retornou uma posição válida.');
      }
      if (side === 'left') {
        data.rc.right = data.rc.left + pxWidth;
      } else {
        data.rc.left = data.rc.right - pxWidth;
      }
      if (!SHAppBarMessage(ABM_SETPOS, data)) {
        throw new Error('ABM_SETPOS não conseguiu reservar a área.');
      }
      const result = screen.screenToDipRect(win, {
        x: data.rc.left,
        y: data.rc.top,
        width: data.rc.right - data.rc.left,
        height: data.rc.bottom - data.rc.top
      });
      if (result.width <= 0 || result.height <= 0) {
        throw new Error('O Windows retornou uma geometria inválida.');
      }
      state.error = '';
      state.lastSignature = signature;
      state.lastBounds = result;
      return result;
    } catch (error) {
      state.error = error.message;
      remove();
      return null;
    }
  }

  function dispose() {
    remove();
    if (messageHooked && typeof win.unhookWindowMessage === 'function' && !win.isDestroyed()) {
      win.unhookWindowMessage(CALLBACK_MESSAGE);
    }
    messageHooked = false;
  }

  return { state, update, remove, dispose };
}

module.exports = { createWindowsAppBar };
