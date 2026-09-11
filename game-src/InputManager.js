import Phaser from 'phaser';

const ACTIONS = ['left', 'right', 'jump', 'attack', 'skill', 'guard'];

/**
 * One input surface for keyboard and multi-touch controls.
 * Combat code only reads actions from this class, so PC and iOS execute the
 * exact same movement / combat state machine.
 */
export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;
    this.touchDown = Object.fromEntries(ACTIONS.map((action) => [action, new Set()]));
    this.pendingTouchPress = new Set();
    this.current = Object.fromEntries(ACTIONS.map((action) => [action, false]));
    this.previous = Object.fromEntries(ACTIONS.map((action) => [action, false]));
    this.pressed = Object.fromEntries(ACTIONS.map((action) => [action, false]));
    this.released = Object.fromEntries(ACTIONS.map((action) => [action, false]));

    this.keys = scene.input.keyboard?.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      skill: Phaser.Input.Keyboard.KeyCodes.K,
      guard: Phaser.Input.Keyboard.KeyCodes.L,
    }) ?? {};

    scene.input.addPointer(8);
    this.boundButtons = [];
    this.bindTouchButtons();
    this.bindJoystick();
    this.onBlur = () => this.clear();
    window.addEventListener('blur', this.onBlur);
  }

  bindJoystick() {
    const pad = document.querySelector('#move-stick');
    if (!pad) return;
    const knob = pad.querySelector('.stick-knob');
    let pointer = null;
    const reset = () => {
      if (pointer !== null) {
        this.touchDown.left.delete(pointer);
        this.touchDown.right.delete(pointer);
      }
      pointer = null;
      knob.style.transform = '';
      pad.classList.remove('pressed');
    };
    const move = (event) => {
      if (event.pointerId !== pointer || !this.enabled) return;
      event.preventDefault();
      const rect = pad.getBoundingClientRect();
      const radius = rect.width * 0.32;
      const dx = Math.max(-radius, Math.min(radius, event.clientX - rect.left - rect.width / 2));
      this.touchDown.left.delete(pointer);
      this.touchDown.right.delete(pointer);
      if (Math.abs(dx) > radius * 0.18) this.touchDown[dx < 0 ? 'left' : 'right'].add(pointer);
      knob.style.transform = `translateX(${dx}px)`;
    };
    const down = (event) => {
      if (!this.enabled || pointer !== null) return;
      pointer = event.pointerId;
      pad.setPointerCapture(pointer);
      pad.classList.add('pressed');
      move(event);
      window.dispatchEvent(new CustomEvent('friend-fighters-unlock-audio'));
    };
    const up = (event) => { if (event.pointerId === pointer) reset(); };
    const bindings = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up };
    Object.entries(bindings).forEach(([type, handler]) => pad.addEventListener(type, handler, { passive: false }));
    this.resetJoystick = reset;
    this.unbindJoystick = () => Object.entries(bindings).forEach(([type, handler]) => pad.removeEventListener(type, handler));
  }

  bindTouchButtons() {
    document.querySelectorAll('#touch-controls [data-action]').forEach((button) => {
      const sourceAction = button.dataset.action;
      const action = sourceAction === 'dodge' ? 'guard' : sourceAction;
      if (!ACTIONS.includes(action)) return;

      const down = (event) => {
        if (!this.enabled) return;
        event.preventDefault();
        this.touchDown[action].add(event.pointerId);
        this.pendingTouchPress.add(action);
        button.classList.add('pressed');
        button.setPointerCapture?.(event.pointerId);
        window.dispatchEvent(new CustomEvent('friend-fighters-unlock-audio'));
      };
      const up = (event) => {
        this.touchDown[action].delete(event.pointerId);
        if (this.touchDown[action].size === 0) button.classList.remove('pressed');
      };

      button.addEventListener('pointerdown', down, { passive: false });
      button.addEventListener('pointerup', up, { passive: false });
      button.addEventListener('pointercancel', up, { passive: false });
      button.addEventListener('lostpointercapture', up, { passive: false });
      this.boundButtons.push({ button, down, up });
    });
  }

  poll() {
    for (const action of ACTIONS) {
      const keyboardDown = Boolean(this.keys[action]?.isDown);
      // Preserve a short tap even if pointerdown/up both occur between frames.
      const next = this.enabled && (keyboardDown || this.touchDown[action].size > 0 || this.pendingTouchPress.has(action));
      this.pressed[action] = this.enabled && (this.pendingTouchPress.has(action) || (next && !this.current[action]));
      this.released[action] = !next && this.current[action];
      this.previous[action] = this.current[action];
      this.current[action] = next;
    }
    this.pendingTouchPress.clear();
  }

  down(action) {
    return Boolean(this.current[action]);
  }

  justPressed(action) {
    return Boolean(this.pressed[action]);
  }

  justReleased(action) {
    return Boolean(this.released[action]);
  }

  axisX() {
    return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
  }

  clear() {
    this.resetJoystick?.();
    this.pendingTouchPress.clear();
    for (const action of ACTIONS) {
      this.touchDown[action].clear();
      this.current[action] = false;
      this.previous[action] = false;
      this.pressed[action] = false;
      this.released[action] = false;
    }
    this.boundButtons.forEach(({ button }) => button.classList.remove('pressed'));
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  destroy() {
    this.clear();
    this.unbindJoystick?.();
    window.removeEventListener('blur', this.onBlur);
    this.boundButtons.forEach(({ button, down, up }) => {
      button.removeEventListener('pointerdown', down);
      button.removeEventListener('pointerup', up);
      button.removeEventListener('pointercancel', up);
      button.removeEventListener('lostpointercapture', up);
    });
  }
}
