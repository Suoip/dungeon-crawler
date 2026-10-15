import { GAME_WIDTH, GAME_HEIGHT, TOP, TILE } from "./config.js";
import { getSetting } from "./settings.js";

// Kaplay's shake(), unless the player turned screen shake off in Options.
export function shakeScreen(amount) {
  if (getSetting("shake")) shake(amount);
}

// Small reusable pieces for cutscenes: waiting, animating, fading, dust.

// Kaplay's wait() and tween() take a callback for "when it's done". Wrapping
// them in Promises lets cutscenes use await, so they read top to bottom:
// "fall, then land, then crack the floor".
export const sleep = (seconds) => new Promise((resolve) => wait(seconds, resolve));

export function animate(from, to, seconds, setValue, easing = easings.linear) {
  return new Promise((resolve) => tween(from, to, seconds, setValue, easing).onEnd(resolve));
}

// A black rectangle over the whole game. Changing its opacity fades the
// screen in and out.
export function addFader(startOpacity = 1) {
  return add([
    rect(GAME_WIDTH, GAME_HEIGHT),
    pos(0, 0),
    color(0, 0, 0),
    opacity(startOpacity),
    z(100), // drawn on top of everything
  ]);
}

export const fadeIn = (fader, seconds = 0.4) =>
  animate(fader.opacity, 0, seconds, (v) => (fader.opacity = v));

export const fadeOut = (fader, seconds = 0.4, to = 1) =>
  animate(fader.opacity, to, seconds, (v) => (fader.opacity = v));

// A quick full-screen flash of color, e.g. red when the knight gets hurt.
export function flashScreen(rgb, strength = 0.5, seconds = 0.5) {
  const flash = add([rect(GAME_WIDTH, GAME_HEIGHT), color(...rgb), opacity(strength), z(90)]);
  animate(strength, 0, seconds, (v) => (flash.opacity = v)).then(() => destroy(flash));
}

// Little grey squares that burst out sideways from a point and fade away.
// By default they're drawn just in front of the knight (z 11).
export function puffDust(x, y, count = 8, spread = 14, depth = 11) {
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const puff = add([
      rect(2, 2),
      pos(x + rand(-3, 3), y - rand(0, 2)),
      anchor("center"),
      color(190, 180, 200),
      opacity(0.9),
      z(depth),
    ]);
    const target = puff.pos.add(side * rand(spread / 2, spread), -rand(1, 6));
    const seconds = rand(0.3, 0.5);
    tween(puff.pos, target, seconds, (p) => (puff.pos = p), easings.easeOutQuad);
    animate(0.9, 0, seconds, (v) => (puff.opacity = v)).then(() => destroy(puff));
  }
}

// Red light over the whole room while it's cursed (after a wrong door). It's
// drawn over the floor, the hero and the mobs, but under the hearts, and
// pulses slowly.
export function addRedLight() {
  const light = add([rect(GAME_WIDTH, GAME_HEIGHT), color(150, 0, 20), opacity(0), z(45)]);
  let strength = 0;
  light.onUpdate(() => (light.opacity = strength * (0.16 + 0.05 * Math.sin(time() * 3))));
  return {
    on: () => animate(strength, 1, 0.6, (v) => (strength = v)),
    off: () => animate(strength, 0, 1, (v) => (strength = v)),
  };
}

// A short line of text that pops up over the room and fades, like "WAVE 2/3".
export async function showBanner(message, rgb = [255, 255, 255]) {
  const banner = add([
    text(message, { size: 8, font: "pixel" }),
    pos(GAME_WIDTH / 2, TOP + 3 * TILE),
    anchor("center"),
    color(...rgb),
    scale(1),
    opacity(1),
    z(60),
  ]);
  // A dark copy behind it, one pixel down, so it reads on any floor.
  const shadow = add([
    text(message, { size: 8, font: "pixel" }),
    pos(GAME_WIDTH / 2, TOP + 3 * TILE + 1),
    anchor("center"),
    color(24, 20, 37),
    opacity(1),
    z(59),
  ]);
  await animate(2, 1, 0.25, (s) => (banner.scale = vec2(s)), easings.easeOutBack);
  await sleep(0.9);
  await animate(1, 0, 0.4, (v) => (banner.opacity = shadow.opacity = v));
  destroy(banner);
  destroy(shadow);
}
