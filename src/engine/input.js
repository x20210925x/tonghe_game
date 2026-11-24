// Keyboard, mouse (pointer lock or drag), touch and gamepad merged into one intent per frame.
const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
  'Space',
  'KeyE',
  'KeyF',
  'Escape',
  'KeyJ',
  'KeyL',
  'Tab',
  'AltLeft',
  'AltRight',
]);

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();
    this.look = { x: 0, y: 0 };
    this.stick = { x: 0, y: 0 };
    this.hold = { x: 0, z: 0 };
    this.touchRun = false;
    this.enabled = false;
    this.locked = false;
    this.drag = null;
    this.stickId = null;
    this.padButtons = [];
    this.listeners = [];
    this.onUnlock = null;
    this.bind();
  }
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.listeners.push([target, type, fn, opts]);
  }
  bind() {
    const canvas = this.canvas;
    this.on(window, 'keydown', (e) => {
      if (!this.enabled || e.metaKey || e.ctrlKey) return;
      if (!MOVE_KEYS.has(e.code)) return;
      e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    this.on(window, 'keyup', (e) => {
      this.keys.delete(e.code);
      // A lone Alt release would otherwise hand focus to the browser menu on Windows.
      if (this.enabled && (e.code === 'AltLeft' || e.code === 'AltRight')) e.preventDefault();
    });
    this.on(window, 'blur', () => this.keys.clear());
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(canvas, 'pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse' && !this.locked && this.settings.pointerLock !== false) {
        const request = canvas.requestPointerLock?.({ unadjustedMovement: false });
        if (request?.catch) request.catch(() => {});
      }
      if (this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType };
      canvas.setPointerCapture?.(e.pointerId);
    });
    this.on(canvas, 'pointermove', (e) => {
      if (!this.enabled) return;
      if (this.locked) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
        return;
      }
      if (this.drag?.id !== e.pointerId) return;
      const k = this.drag.type === 'touch' ? 1.35 : 1;
      this.look.x += (e.clientX - this.drag.x) * k;
      this.look.y += (e.clientY - this.drag.y) * k;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    });
    const release = (e) => {
      if (this.drag?.id === e.pointerId) this.drag = null;
    };
    this.on(canvas, 'pointerup', release);
    this.on(canvas, 'pointercancel', release);
    this.on(canvas, 'lostpointercapture', release);
    this.on(document, 'pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.enabled) this.onUnlock?.();
    });
  }
  // Touch controls live in the HUD; the game wires them through these helpers.
  bindStick(pad, knob) {
    const move = (e) => {
      const r = pad.getBoundingClientRect();
      let x = (e.clientX - r.left - r.width / 2) / (r.width * 0.36),
        y = (e.clientY - r.top - r.height / 2) / (r.height * 0.36);
      const m = Math.max(1, Math.hypot(x, y));
      x /= m;
      y /= m;
      this.stick.x = x;
      this.stick.y = y;
      knob.style.transform = `translate(${x * 30}px,${y * 30}px)`;
    };
    this.on(pad, 'pointerdown', (e) => {
      if (this.stickId != null) return;
      this.stickId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      move(e);
    });
    this.on(pad, 'pointermove', (e) => {
      if (this.stickId === e.pointerId) move(e);
    });
    this.on(pad, 'lostpointercapture', () => {
      this.stickId = null;
      this.stick.x = this.stick.y = 0;
      knob.style.transform = '';
    });
  }
  bindHold(button, axis, value) {
    const set = (v) => (this.hold[axis] = v);
    this.on(button, 'pointerdown', (e) => {
      button.setPointerCapture(e.pointerId);
      set(value);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.on(button, type, () => {
        if (this.hold[axis] === value) set(0);
      });
  }
  tap(code) {
    if (this.enabled) this.pressed.add(code);
  }
  lock() {
    if (this.locked || this.settings.pointerLock === false) return;
    try {
      const r = this.canvas.requestPointerLock?.();
      if (r?.catch) r.catch(() => {});
    } catch {
      /* Pointer lock unavailable: drag to look still works. */
    }
  }
  unlock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }
  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.look.x = this.look.y = 0;
    this.stick.x = this.stick.y = 0;
    this.hold.x = this.hold.z = 0;
    this.drag = null;
  }
  // Collect everything that happened since the last frame.
  read(dt) {
    const k = this.keys;
    const axis = (neg, pos) => Number(k.has(pos)) - Number(k.has(neg));
    let x = axis('KeyA', 'KeyD') + this.stick.x + this.hold.x,
      z = axis('KeyW', 'KeyS') + this.stick.y + this.hold.z;
    let lookX = this.look.x,
      lookY = this.look.y;
    this.look.x = this.look.y = 0;
    const turn = axis('ArrowRight', 'ArrowLeft'),
      tilt = axis('ArrowDown', 'ArrowUp');
    lookX -= turn * 560 * dt;
    lookY -= tilt * 380 * dt;
    let run = k.has('ShiftLeft') || k.has('ShiftRight') || this.touchRun;
    const pressed = new Set(this.pressed);
    this.pressed.clear();
    const pad = navigator.getGamepads?.()[0];
    if (pad) {
      const dead = (v) => (Math.abs(v) < 0.16 ? 0 : v);
      x += dead(pad.axes[0] || 0);
      z += dead(pad.axes[1] || 0);
      lookX += dead(pad.axes[2] || 0) * 900 * dt;
      lookY += dead(pad.axes[3] || 0) * 620 * dt;
      const buttons = pad.buttons.map((b) => b.pressed);
      const edge = (i, code) => {
        if (buttons[i] && !this.padButtons[i]) pressed.add(code);
      };
      edge(0, 'Space');
      edge(2, 'KeyE');
      edge(1, 'KeyE');
      edge(9, 'Escape');
      edge(3, 'KeyL');
      if (buttons[10] || buttons[5]) run = true;
      this.padButtons = buttons;
    }
    const sens = this.settings.sensitivity * 0.0036;
    return {
      x: Math.max(-1, Math.min(1, x)),
      z: Math.max(-1, Math.min(1, z)),
      lookX: lookX * sens,
      lookY: lookY * sens * (this.settings.invertY ? -1 : 1),
      run,
      jump: pressed.has('Space'),
      up: k.has('Space'),
      freeLook: k.has('AltLeft') || k.has('AltRight'),
      down: k.has('ShiftLeft') || k.has('ShiftRight'),
      interact: pressed.has('KeyE') || pressed.has('KeyF'),
      pause: pressed.has('Escape'),
      journal: pressed.has('KeyJ') || pressed.has('Tab'),
      lamp: pressed.has('KeyL'),
    };
  }
}
