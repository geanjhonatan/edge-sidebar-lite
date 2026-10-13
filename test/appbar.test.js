'use strict';
// Unit test for the AppBar bridge. Native Windows behavior must still be tested
// on Windows 10, with DPI, taskbar and maximized applications.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'windows-appbar.js'), 'utf8');
const calls = [];
const koffi = {
  opaque: () => 'opaque',
  pointer: (name) => name,
  struct: (name, members) => ({ name, members }),
  inout: (x) => x,
  sizeof: () => 48,
  load: () => ({
    func: () => (operation, data) => {
      calls.push({ operation, side: data.uEdge, rect: { ...data.rc } });
      if (operation === 2) {
        // Simulate another appbar taking 10 pixels at the edge.
        if (data.uEdge === 0) { data.rc.left += 10; data.rc.right += 10; }
        else { data.rc.left -= 10; data.rc.right -= 10; }
      }
      return 1n;
    }
  })
};
const mod = { exports: {} };
vm.runInNewContext(source, {
  module: mod,
  require: (id) => { if (id === 'koffi') return koffi; throw Error(id); },
  process: { platform: 'win32' },
  Buffer
});
let callback;
let numNotifications = 0;
const window = {
  getNativeWindowHandle() {
    const b = Buffer.alloc(8); b.writeBigUInt64LE(0x1122334455n); return b;
  },
  hookWindowMessage(id, handler) { assert.equal(id, 0xb271); callback = handler; },
  unhookWindowMessage(id) { assert.equal(id, 0xb271); },
  isDestroyed: () => false
};
const screen = {
  dipToScreenRect: (_window, rect) => ({ ...rect }),
  screenToDipRect: (_window, rect) => ({ ...rect })
};
const bridge = mod.exports.createWindowsAppBar(window, screen, () => numNotifications++);
const display = { id: 5, scaleFactor: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const right = bridge.update({ display, side: 'right', width: 488 });
assert.equal(bridge.state.registered, true);
assert.equal(right.width, 488);
assert.equal(right.height, 1040, 'Do not overlap Windows taskbar');
assert.equal(right.x, 1422, 'Shell may shift requested edge');
assert.deepEqual(calls.map((v) => v.operation), [0, 2, 3]);
assert.equal(calls[0].side, 2);
bridge.update({ display, side: 'right', width: 488 });
assert.equal(calls.length, 3, 'Unchanged geometry should not re-register');
const left = bridge.update({ display, side: 'left', width: 320 });
assert.equal(left.x, 10);
assert.equal(left.width, 320);
assert.equal(calls.length, 5);
callback(Buffer.from([1, 0, 0, 0]));
assert.equal(numNotifications, 1);
bridge.remove();
assert.equal(bridge.state.registered, false);
assert.equal(calls.at(-1).operation, 1);
bridge.dispose();

const missing = { exports: {} };
vm.runInNewContext(source, {
  module: missing,
  require: () => { throw Error('not installed'); },
  process: { platform: 'win32' }, Buffer
});
const fallback = missing.exports.createWindowsAppBar(window, screen);
assert.equal(fallback.update({ display, side: 'right', width: 488 }), null);
assert.match(fallback.state.error, /npm install/);
console.log('OK: AppBar nativo simulado, mudança de lado, geometria, limpeza e fallback seguro.');
