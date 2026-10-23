import { BALANCE } from "./balance.js";
import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { getGamePixel } from "./display.js";
import { playSound } from "./sound.js";
import { drawShadowText } from "./hud.js";

// The demon pit's pacts, its gimmick (balance.js depths' `pacts`, DESIGN.md
// section 3). As he lands in each of its rooms, the room waits, and the pit
// offers three cards; he picks one before the fight starts (the clock
// doesn't run meanwhile). Each card is a curse, mild, harsh or brutal:
//   weaker   he does less damage
//   slower   he walks (and dashes) slower
//   tougher  monsters have more health (the boss too)
//   harder   monsters' hits cost more hearts
// and pays for it: the gold monsters drop is worth more from then on, more
// for a harsher curse. The cards stack for the rest of the run. Silver
// tongue, the pit's special upgrade, gives him more choice: a 4th card,
// then a reroll in every room, then one card in every room that's always
// mild.
//
// What the cards add up to is the run's `pact`: { damage, speed, hp } (what
// those are multiplied by), { touch, special } (hearts added to a monster's
// touch and to a special attack) and `gold` (what dropped gold is
// multiplied by).

export const KINDS = ["weaker", "slower", "tougher", "harder"];
const TIERS = ["mild", "harsh", "brutal"];
const TIER_COLOR = { mild: [99, 199, 77], harsh: [247, 150, 23], brutal: [230, 60, 50] };
const pct = (share) => `${Math.round(share * 100)}%`;

// The run's pact so far (none yet: all ones and zeros).
export const pactOf = (run) => (run.pact ??= { damage: 1, speed: 1, hp: 1, touch: 0, special: 0, gold: 1 });

// What a card says: [lines of what it costs him], and what it pays.
function cardText({ kind, tier }, rules) {
  const s = rules[kind][tier];
  const cost = {
    weaker: [`-${pct(s)}`, "DAMAGE"],
    slower: [`-${pct(s)}`, "SPEED"],
    tougher: [`+${pct(s)}`, "MONSTER", "HEALTH"],
    harder: [s[1] ? "ALL HITS" : "TOUCHES", `+${s[0]} HEART${s[0] > 1 ? "S" : ""}`],
  }[kind];
  return { cost, pay: `+${pct(rules.gold[tier])} GOLD` };
}

// Takes a card: its curse and its gold join the run's pact.
export function takeCard(run, { kind, tier }) {
  const rules = BALANCE.depths[run.depth - 1].pacts;
  const pact = pactOf(run);
  const s = rules[kind][tier];
  if (kind === "weaker") {
    pact.damage *= 1 - s;
    run.stats.damage *= 1 - s;
  }
  if (kind === "slower") pact.speed *= 1 - s;
  if (kind === "tougher") pact.hp *= 1 + s;
  if (kind === "harder") {
    pact.touch += s[0];
    pact.special += s[1];
  }
  pact.gold += rules.gold[tier];
  (run.cards ??= []).push({ kind, tier });
}

// The cards on offer: different kinds, each at a random strength (with
// Silver tongue 3, one of them always mild).
function deal(rules, count, safe) {
  const kinds = KINDS.slice().sort(() => Math.random() - 0.5).slice(0, count);
  const weights = TIERS.map((t) => rules.tierWeights[t]);
  const total = weights.reduce((a, b) => a + b, 0);
  const pickTier = () => {
    let roll = rand(0, total);
    for (const [i, w] of weights.entries()) if ((roll -= w) <= 0) return TIERS[i];
    return TIERS.at(-1);
  };
  const cards = kinds.map((kind) => ({ kind, tier: pickTier() }));
  if (safe) cards[randi(0, cards.length)].tier = "mild";
  return cards;
}

// The pit offers its cards; resolves once he has taken one. 1-4 (or a
// click) picks, R (or clicking the line under them) rerolls if he can.
export function offerPact(run, stats) {
  const rules = BALANCE.depths[run.depth - 1].pacts;
  if (!rules) return Promise.resolve();
  const level = stats.silverTongue;
  const count = level >= 1 ? 4 : 3;
  let rerolls = level >= 2 ? 1 : 0;
  let cards = deal(rules, count, level >= 3);
  const w = count === 3 ? 92 : 74, gap = count === 3 ? 8 : 4, h = 112, top = 46;
  const left = (GAME_WIDTH - (count * w + (count - 1) * gap)) / 2;
  const boxOf = (i) => ({ x: left + i * (w + gap), y: top, w, h });
  const rerollBox = { x: GAME_WIDTH / 2 - 60, y: top + h + 6, w: 120, h: 12 };
  const inside = (p, b) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
  const pointer = () => mousePos().scale(1 / getGamePixel());
  const born = time();
  playSound("pactOffer");

  return new Promise((resolve) => {
    const handles = [];
    const overlay = add([pos(0, 0), z(95)]);
    const done = (card) => {
      takeCard(run, card);
      playSound("pactTake");
      handles.forEach((h) => h.cancel());
      destroy(overlay);
      resolve(card);
    };
    const reroll = () => {
      if (rerolls < 1) return;
      rerolls--;
      cards = deal(rules, count, level >= 3);
      playSound("pactOffer");
    };
    for (let i = 0; i < count; i++) handles.push(onKeyPress(String(i + 1), () => done(cards[i])));
    handles.push(onKeyPress("r", reroll));
    handles.push(onMousePress("left", () => {
      const p = pointer();
      const i = cards.findIndex((_, i) => inside(p, boxOf(i)));
      if (i >= 0) return done(cards[i]);
      if (rerolls > 0 && inside(p, rerollBox)) reroll();
    }));

    overlay.onDraw(() => {
      const appear = Math.min(1, (time() - born) / 0.25);
      drawRect({ pos: vec2(0, 0), width: GAME_WIDTH, height: GAME_HEIGHT, color: rgb(16, 8, 14), opacity: 0.78 * appear });
      drawShadowText("THE PIT OFFERS A PACT", vec2(GAME_WIDTH / 2, 22), 8, [255, 205, 70], "center", appear);
      const pact = pactOf(run);
      drawShadowText(`PICK A CURSE. GOLD SO FAR X${pact.gold.toFixed(1)}`, vec2(GAME_WIDTH / 2, 34), 8, [200, 190, 210], "center", appear);
      const hovered = cards.findIndex((_, i) => inside(pointer(), boxOf(i)));
      cards.forEach((card, i) => drawCard(card, rules, boxOf(i), i, i === hovered, appear));
      if (rerolls > 0) {
        const lit = inside(pointer(), rerollBox);
        drawShadowText("R: NEW CARDS (1 LEFT)", vec2(GAME_WIDTH / 2, rerollBox.y + 6), 8, lit ? [255, 255, 255] : [170, 160, 190], "center", appear);
      }
    });
  });
}

// One card: its strength on top (in its color), the curse's mark, what it
// costs, what it pays in gold, and its key.
function drawCard(card, rules, { x, y, w, h }, i, hovered, appear) {
  const color = TIER_COLOR[card.tier];
  const lift = hovered ? -3 : 0;
  y += lift;
  drawRect({ pos: vec2(x - 1, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37), opacity: appear });
  drawRect({ pos: vec2(x, y), width: w, height: h, color: rgb(...color), opacity: appear });
  drawRect({ pos: vec2(x + 2, y + 2), width: w - 4, height: h - 4, color: hovered ? rgb(58, 34, 46) : rgb(42, 24, 34), opacity: appear });
  const mid = x + w / 2;
  drawShadowText(card.tier.toUpperCase(), vec2(mid, y + 10), 8, color, "center", appear);
  drawMark(card.kind, vec2(mid, y + 30), appear);
  const { cost, pay } = cardText(card, rules);
  wrap(cost, w - 6).forEach((line, n) => drawShadowText(line, vec2(mid, y + 47 + n * 10), 8, [240, 230, 220], "center", appear));
  const paid = wrap([pay], w - 6);
  paid.forEach((line, n) => drawShadowText(line, vec2(mid, y + 93 - (paid.length - 1) * 10 + n * 10), 8, [255, 205, 70], "center", appear));
  drawShadowText(String(i + 1), vec2(mid, y + h - 8), 8, [150, 140, 160], "center", appear);
}

// A line too wide for a card (the narrower ones, with a 4th card) goes on
// two, split at its last space.
function wrap(lines, width) {
  const fits = (line) => formatText({ text: line, size: 8, font: "pixel" }).width <= width;
  return lines.flatMap((line) => {
    const space = line.lastIndexOf(" ");
    return fits(line) || space < 0 ? [line] : [line.slice(0, space), line.slice(space + 1)];
  });
}

// Each curse's mark, drawn around `at` ([x, y, w, h, color] rects): a broken
// sword, a heavy ball and chain, a horned skull, a cracked heart.
const MARKS = {
  weaker: [[-1, -10, 2, 8, [200, 200, 210]], [1, -1, 2, 7, [200, 200, 210]], [-4, -2, 8, 2, [150, 110, 70]], [-1, 0, 2, 7, [120, 90, 60]]],
  slower: [[-6, -4, 3, 2, [150, 150, 160]], [-3, -2, 3, 2, [150, 150, 160]], [0, -1, 2, 2, [150, 150, 160]], [1, 0, 8, 8, [90, 90, 100]], [2, 1, 3, 2, [160, 160, 170]]],
  tougher: [[-6, -9, 2, 4, [230, 220, 200]], [4, -9, 2, 4, [230, 220, 200]], [-5, -6, 10, 9, [230, 220, 200]], [-3, -3, 2, 2, [200, 40, 40]], [1, -3, 2, 2, [200, 40, 40]], [-3, 3, 6, 3, [230, 220, 200]], [-1, 3, 1, 2, [60, 40, 50]], [1, 3, 1, 2, [60, 40, 50]]],
  harder: [[-7, -8, 6, 5, [210, 50, 50]], [1, -8, 6, 5, [210, 50, 50]], [-7, -4, 14, 5, [210, 50, 50]], [-5, 1, 10, 3, [210, 50, 50]], [-2, 4, 4, 2, [210, 50, 50]], [0, -6, 1, 3, [40, 20, 30]], [-1, -3, 1, 3, [40, 20, 30]], [0, 0, 1, 3, [40, 20, 30]]],
};
function drawMark(kind, at, appear) {
  for (const [x, y, w, h] of MARKS[kind]) drawRect({ pos: at.add(x - 1, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37), opacity: appear });
  for (const [x, y, w, h, c] of MARKS[kind]) drawRect({ pos: at.add(x, y), width: w, height: h, color: rgb(...c), opacity: appear });
}
