import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installTouchGestureGuard } from '../game-src/TouchGestureGuard.js';

const element = () => ({
  handlers: {}, style: {}, classList: { add() {}, remove() {} },
  addEventListener(type, handler, options) { this.handlers[type] = { handler, options }; },
  removeEventListener(type) { delete this.handlers[type]; },
  fire(type, event) { this.handlers[type]?.handler(event); },
  setPointerCapture() {}, getBoundingClientRect() { return { left: 0, width: 100 }; },
});
const pad = element(), knob = element();
const buttons = Object.fromEntries(['jump', 'attack', 'skill', 'guard'].map(action => [action, Object.assign(element(), { dataset: { action } })]));
pad.querySelector = () => knob;
const windowStub = Object.assign(element(), { dispatchEvent() {} });
const context = {
  Phaser: { Input: { Keyboard: { KeyCodes: { A: 65, D: 68, W: 87, J: 74, K: 75, L: 76 } } } },
  document: { querySelector: () => pad, querySelectorAll: () => Object.values(buttons) },
  window: windowStub, CustomEvent: class {},
};
vm.createContext(context);
const source = readFileSync(new URL('../game-src/InputManager.js', import.meta.url), 'utf8')
  .replace("import Phaser from 'phaser';", '').replace('export class InputManager', 'globalThis.InputManager = class InputManager');
vm.runInContext(source, context);
const keys = {};
const input = new context.InputManager({ input: { keyboard: { addKeys(mapping) {
  assert.deepEqual(Object.values(mapping), [65, 68, 87, 74, 75, 76]);
  for (const action of Object.keys(mapping)) keys[action] = { isDown: false };
  return keys;
} }, addPointer() {} } });
const pointer = (pointerId, clientX = 50) => ({ pointerId, clientX, preventDefault() {} });
input.setEnabled(true);
pad.fire('pointerdown', pointer(1, 85));
buttons.jump.fire('pointerdown', pointer(2));
buttons.attack.fire('pointerdown', pointer(3));
input.poll();
assert.equal(input.axisX(), 1);
assert.equal(input.justPressed('jump'), true);
assert.equal(input.justPressed('attack'), true);
input.poll();
assert.equal(input.justPressed('jump'), false, 'holding jump must not automatically consume a second jump');
buttons.jump.fire('pointerup', pointer(2));
buttons.jump.fire('pointerdown', pointer(2));
buttons.jump.fire('pointerup', pointer(2));
input.poll();
assert.equal(input.justPressed('jump'), true, 'a quick second tap must survive between frames');
assert.equal(input.down('attack'), true);
pad.fire('pointermove', pointer(1, 15));
input.poll();
assert.equal(input.axisX(), -1);
buttons.attack.fire('pointercancel', pointer(3));
pad.fire('lostpointercapture', pointer(1));
input.poll();
assert.equal(input.down('attack'), false);
assert.equal(input.axisX(), 0);
keys.jump.isDown = true;
input.poll();
assert.equal(input.justPressed('jump'), true);
keys.jump.isDown = false;
windowStub.fire('blur');
assert.equal(input.down('jump'), false);
buttons.skill.fire('pointerdown', pointer(4));
input.setEnabled(false);
input.poll();
assert.equal(input.justPressed('skill'), false);
input.destroy();
assert.equal(Object.keys(pad.handlers).length, 0);
for (const button of Object.values(buttons)) assert.equal(Object.keys(button.handlers).length, 0);

const surface = element();
const cleanup = installTouchGestureGuard(surface);
const gesture = (overControls = false, touches = 1, cancelable = true) => ({
  cancelable, defaultPrevented: false, touches: Array(touches).fill({}),
  target: { closest: () => overControls ? {} : null },
  preventDefault() { this.defaultPrevented = true; },
  stopPropagation() { assert.fail('game input must keep propagating'); },
});
for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) {
  const event = gesture(); surface.fire(type, event); assert.equal(event.defaultPrevented, true);
  assert.equal(surface.handlers[type].options.passive, false);
}
const pinch = gesture(true, 2); surface.fire('touchmove', pinch); assert.equal(pinch.defaultPrevented, true);
const combatTap = gesture(true); surface.fire('touchend', combatTap); assert.equal(combatTap.defaultPrevented, true);
const menuTap = gesture(); surface.fire('touchend', menuTap); assert.equal(menuTap.defaultPrevented, false);
const ordinaryMove = gesture(); surface.fire('touchmove', ordinaryMove); assert.equal(ordinaryMove.defaultPrevented, false);
const nonCancelable = gesture(true, 2, false); surface.fire('gesturechange', nonCancelable); assert.equal(nonCancelable.defaultPrevented, false);
assert.equal(surface.handlers.pointerdown, undefined, 'guard must not intercept Pointer Events');
cleanup();
assert.equal(Object.keys(surface.handlers).length, 0);

const html = readFileSync(new URL('../public/game/index.html', import.meta.url), 'utf8');
const left = html.match(/<div class="touch-left">([\s\S]*?)<div class="touch-right">/)[1];
const right = html.match(/<div class="touch-right">([\s\S]*?)<\/nav>/)[1];
assert.match(left, /id="move-stick"/);
assert.doesNotMatch(left, /data-action=/);
assert.deepEqual([...right.matchAll(/data-action="(\w+)"/g)].map(match => match[1]).sort(), ['attack', 'guard', 'jump', 'skill']);
console.log('PASS: right-side four-button layout, move + jump + attack, quick double jump, hold, keyboard, cancel/pause, Safari guard and menu clicks');
