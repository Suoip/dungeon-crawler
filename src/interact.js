import { setPrompt, hidePrompt } from "./panel.js";

// Doors, levers, heroes and the ladder all work the same way: stand next to
// one, and the panel offers it; press E (or tap the button) to use
// it. This handles that for any list of "things", each an object with:
//   zone        an invisible area in front of it; standing in it = "I'm here"
//   prompt      what the panel button says, e.g. ["Open door ", badge], or a
//               function returning that (for prompts that change, like a lever's)
//   use()       what happens. It can be async (a cutscene). If it resolves to
//               true, the player has left the room, so everything stays locked.
//   highlight   optional function(isActive), called every frame, to show which
//               thing you'd use
//
// It starts switched off (while the knight is falling in, say); call
// enable() once the player can move.
export function setupInteractions(player, things, hint) {
  let enabled = false;
  let busy = false;    // true while something is being used
  let active = null;   // the thing the player is standing at

  async function useActive() {
    if (!enabled || busy || !active) return;
    busy = true;
    hidePrompt();
    const leftRoom = await active.use();
    if (leftRoom) return;
    busy = false;
    active = null;
    setPrompt(null, useActive, hint()); // the next frame works out what's nearby again
  }

  onKeyPress("e", useActive); // (Space is for attacking, see combat.js)

  onUpdate(() => {
    if (!enabled || busy) return;
    const here = things.find((thing) => player.isColliding(thing.zone)) ?? null;
    for (const thing of things) thing.highlight?.(thing === here);

    // Only touch the panel when what you're standing at changes, not 60
    // times a second.
    if (here !== active) {
      active = here;
      const prompt = typeof here?.prompt === "function" ? here.prompt() : here?.prompt;
      setPrompt(prompt, useActive, hint());
    }
  });

  return {
    enable() {
      enabled = true;
      active = null;
      setPrompt(null, useActive, hint());
    },
    // Something changed (like the doors unlocking): redo the prompt or hint.
    refresh() {
      active = undefined; // "unknown", so the next frame updates the panel
    },
  };
}
