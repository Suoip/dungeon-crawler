# Design plan

The plan for turning the game into an incremental dungeon crawler. It is a
living document: each section is filled in as its decisions are made, and
nothing is built until the plan is settled.

**Status:** the first full draft, under review. The hook (section 4), the
use of bones and trophies, and depths 2–5 are decided later.

## The pitch

A timed incremental dungeon crawler. Runs are very short and you start
almost helpless: one heart and a few seconds on the clock. Everything you
earn goes into a skill tree, and each run gets a little further down. There
are 5 depths of 10 sub-depths each, and a full playthrough should take about
3 to 4 hours.

The quiz is gone. The new game is pure linear progression.

## 1. References and feel

- **Closest to:** timed incrementals (such as Nodebuster). Short timed runs,
  a big skill tree, numbers that go up fast, and something to buy after
  nearly every run.
- **What sets these games apart** is the art, the music and one crucial
  mechanic of their own (see section 4).

## 2. The core loop

- **A run** starts at sub-depth 1 of a depth you choose. Any depth you have
  unlocked can be picked, so you can go back to an easier one to farm.
- **It ends** when you die or the clock runs out.
- **You keep everything** you earned in the run, either way. Every run pays
  out, so even a bad one moves you forward.
- **Between runs** you're in the underworld, where an altar opens the skill
  tree (see section 9). Then you climb the TRY AGAIN ladder for the next run.
- **Starting state:** 1 heart, so the first hit kills you. More hearts are
  bought in the tree.
- **Inside a run** there are small pickups but no lasting power. Lasting
  power comes only from the tree. Pickups might be heart drops, a time orb
  for a few extra seconds, or a burst of gold. Unlocking and improving these
  is part of the tree.

## 3. Structure

- **5 depths × 10 sub-depths = 50 rooms.**
- **A sub-depth is one room.** It reuses the existing room, wave and
  spawning code.
- **Going down:** the room's way deeper is a chained door. The last mob
  drops a key (built like the old scroll pickup, which is in git history
  before the clean-up), picking it up unchains the door,
  and walking through takes you to the next sub-depth.
- **Checkpoint per depth.** If a run ends before sub-depth 10 of a depth is
  cleared, that depth is still the deepest one unlocked, so the next run
  starts at its sub-depth 1 again. Beating sub-depth 10 unlocks the next
  depth.
- **Sub-depth 10 is a boss.** Beating it unlocks the next depth. The three
  existing bosses (dash, vomit and spawn moves, plus a rage phase) are a head
  start, and two more are needed.
- **From sub-depth 1 to 9, rooms grow in four ways:**
  - more mobs, with more HP and more waves
  - new mob types, introduced a few at a time across a depth
  - room hazards (spikes, lava and the like) deeper in a depth
  - room layouts: pillars and walls, so rooms aren't all the same open box
- **Each depth has its own theme:** its own look (tileset tint and props),
  its own mob roster and its own music. Unlocking a depth should feel like
  arriving somewhere new.

### Draft: depth 1, the crypt

Mobs: tiny zombies (chasers), skeletons (rushers: they wind up, then charge
in a line) and slugs (splitters: each splits into two tiny slugs). Chest
mimics are the surprise late in the depth.

| Sub-depth | What's new | Rooms |
|---|---|---|
| 1 | Tiny zombies, pots | One small wave, clearable in a few seconds |
| 2 | | Two waves of tiny zombies |
| 3 | Skeletons, the first pillars | Zombies with a skeleton |
| 4 | Floor spikes | Pairs of skeletons, spikes on a timer |
| 5 | Slugs | Slugs and zombies |
| 6 | Crates (a few hits), bones start dropping | All three mob types mixed |
| 7 | A chest mimic | A chest in the room that may be a mimic |
| 8 | More spikes, tighter layouts | Bigger waves of everything |
| 9 | A big sturdy breakable (many hits, lots of gold) | The hardest mix in the depth |
| 10 | **Big Zombie** | It raises tiny zombies, which fits the crypt |

## The run timer

- **Per run, and very short:** about 15–20 seconds at the start.
- **Grown through the tree.** For example:
  - flat extra time at the start of a run
  - extra time added each time you reach the next sub-depth in that run
  - more of the same kind (to be designed in section 7)
- **What this means for rooms:** the first rooms have to be clearable in a
  few seconds, with only a few weak mobs, so an early run gets through one
  or two rooms. The current rooms, with several waves of tough mobs, are far
  too long for this and will be retuned.

## 4. The hook

**Deferred.** The hook will be chosen once the fundamentals are built and
playable. No extra features until then. The candidates so far, to come back
to:

- **Echoes:** past runs play back as ghosts that fight alongside you.
- **Overtime:** when the clock runs out, hands rise and chase you while you
  fight on for double pay.
- **Fork doors:** two doors per room with visible rewards, one of them a
  cursed high-risk door.
- **Gold is time:** one currency. Kills drop seconds, and the seconds left
  over are what you spend.
- **Hittable world:** pots, bells and levers that react to your weapon.

## 5. Combat and enemies

- **The hero attacks automatically** all game. You move (and dash). The
  swings happen on their own, survivor-style, so the game is about
  positioning and dodging.
- **Swings go where you're facing.** You aim by moving, which takes some
  skill. A retreat means turning back to fight.
- **One weapon, upgraded through the tree:** damage, swing speed, reach and
  arc. More weapons can come later (the tileset has a dozen).
- **The dash is the main skill, but you start without it.** It's unlocked
  in the tree. After that it's your one button: Space or Shift on a
  keyboard, the Dash button on phones.
  - **Movement only.** A dash doesn't protect you and doesn't hurt mobs.
  - **Its length never changes.** The tree upgrades only its cooldown, and
    adds a second charge.
  - **How charges refill:** if a charge takes *n* seconds, a second charge
    takes *2n* while the first one is ready, but its progress is kept as a
    percentage. Example with n = 4 s: one charge is ready and the second is
    halfway (4 of 8 s). You dash. Now no charge is ready, so the one that
    was halfway fills at the normal rate and is ready in n/2 = 2 s. Once
    it's ready, the next one takes 2n again.
- **Growing numbers.** Damage and HP are real numbers that pop up on every
  hit. Your first swing does 1. Late in the game you hit for thousands
  against mobs with thousands of HP.
- **Mob behaviors** across the game:
  - chasers (walk at you) and rushers (wind up, then charge in a line)
  - shooters that keep their distance and fire projectiles
  - summoners (the necromancer raises skeletons) and splitters (slugs split
    into tiny slugs)
  - bombers that run up and explode, and mimics: chests that turn out to be
    monsters
- **The tileset has enough monsters** for five themed depths: tiny zombie,
  skeleton, goblin, imp, wogol, chort, orc warrior, masked orc, orc shaman,
  ice zombie, muddy, swampy, necromancer, pumpkin dude, slug, tiny slug and
  chest mimic. There are only three big sprites (big zombie, ogre and big
  demon), so two bosses will be scaled-up small mobs.
- **Draft depth themes** (only depth 1 matters for the first milestone):

  | Depth | Theme | Mobs | Boss |
  |---|---|---|---|
  | 1 | Crypt | tiny zombie, skeleton, slug | Big Zombie |
  | 2 | Goblin warrens | goblin, imp, wogol | a giant chest mimic? |
  | 3 | Orc fort | orc warrior, masked orc, orc shaman | Ogre |
  | 4 | Sunken swamp | muddy, swampy, ice zombie, necromancer | a giant necromancer? |
  | 5 | Demon pit | chort, imp, pumpkin dude | Big Demon |

## 6. The economy

- **Three currencies:**
  - **Gold** drops everywhere and buys most nodes.
  - **A depth material** is different for each depth (bones in the crypt,
    teeth in the warrens, and so on) and rarer. **It doesn't buy tree
    upgrades.** It has another use, to be designed later. It's banked from
    the first milestone on. In each depth it doesn't drop in sub-depths 1–5,
    is rare in sub-depth 6, and gets more common in every deeper one.
  - **A boss trophy.** Each boss drops it once, the first time you beat it,
    so there are exactly 5 in the game. Repeat boss kills still pay gold.
    Its use is decided later, because the first milestone ends at the first
    boss.
- **For the first milestone, gold buys every node.**
- **Collecting:** drops land on the floor, and a small magnet pulls them in
  when you're close. The tree grows the magnet's range. Anything left behind
  when you go through the door is lost, so you choose between gold and time.
- **What pays out:**
  - mob kills
  - boss kills: a big payout, including repeat kills when you farm a depth
  - breakables of different toughness: a pot breaks in one hit and drops a
    little; a crate takes a few hits; something big and sturdy takes many
    hits and drops a lot. Their HP grows with depth like the mobs' HP.
- **Heart drops** are on from the start but rarer than today (currently 2%,
  plus 1% for every kill without a drop). The tree raises the chance.
- **Time orbs** don't drop at all until they're unlocked in the tree, and
  even then they're much rarer than hearts. The tree raises the chance.

## 7. The skill tree

- **A web from the middle.** One web starts at a single node in the center
  and branches outward into five branches: weapon, hearts, time, dash and
  money. Every purchase opens up the nodes next to it.
- **Most nodes have levels**, for example Sharper blade 0/10 at +1 damage
  each, getting pricier every level. Special nodes are a one-time buy.
- **Revealed as you buy.** You see the nodes next to ones you own. Nodes
  further out show as dim outlines.
- No quiz lifelines.

### Draft nodes for the first milestone (depth 1)

Every node costs gold. Costs are set in section 8.

| Branch | Node | Levels | Effect |
|---|---|---|---|
| Center | Descend | 1 | The root. Owned from the start |
| Weapon | Sharper blade | 10 | +1 damage per level |
| Weapon | Quicker swing | 5 | Swings come 8% faster per level |
| Weapon | Longer reach | 5 | +10% reach per level |
| Weapon | Wider arc | 3 | The swing covers a wider angle |
| Hearts | Extra heart | 4 | +1 heart (up to 5) |
| Hearts | Steady nerves | 3 | Longer invincibility after a hit |
| Hearts | Lucky hearts | 5 | Hearts drop more often. Only reachable after Extra heart, because a heart only drops when you're missing one |
| Time | More time | 10 | +3 s at the start of a run |
| Time | Second wind | 5 | +2 s every time you reach the next sub-depth |
| Time | Time orbs | 1 | Unlocks time orbs: rare drops worth +1 s |
| Time | Orb finder | 5 | Time orbs drop more often |
| Time | Bigger orbs | 3 | Time orbs are worth more |
| Dash | Dash | 1 | Unlocks the dash |
| Dash | Quick feet | 5 | Dash cooldown 10% shorter per level |
| Dash | Second charge | 1 | A second dash charge (it refills at half speed, see section 5) |
| Money | Magnet | 5 | Pickups are pulled in from further away |
| Money | Greed | 10 | +10% gold per kill |
| Money | Smash | 3 | Breakables drop more gold |

That's 19 nodes and 85 levels to buy in depth 1.

## 8. Pacing

- **Every depth takes about 40 minutes**, from its first run to beating its
  boss. 5 × 40 minutes is about 3.3 hours.
- **The first run:** you die fast, clearing a room or two at most, but you
  earn enough for 1–2 cheap upgrades straight away. The whole loop makes
  sense within the first minute.
- **Costs multiply per level** by a fixed factor of about ×1.4–1.6,
  different for each node.
- **The golden rule: an efficient run always buys something.** After any
  run played well (clearing rooms as fast as the current upgrades allow, and
  collecting the gold), there's at least one node you can afford. Playing
  well never ends in a run with nothing to buy. Until the tree is fully
  bought, there must always be a reachable node whose next level costs no
  more than an efficient run earns at that point. The simulator checks this
  after every simulated run and fails if it's broken.
- **Purchase rhythm:** a good run always buys something (the rule above).
  Bigger nodes can still take a few runs of saving up, if you choose to
  save for them.
- **Walls** (where the cheap upgrades run out and the next room is too
  hard) should be short. A short wall is satisfying to break; a long one is
  where people quit.
- **A pacing simulator** tunes the numbers. It's a small Node script in
  `tools/` that reads the same data file as the game, plays the economy by
  the numbers (kills per run from damage and time, buying upgrades the way
  a player would), and reports how long depth 1 takes and where the walls
  are. After that, the numbers are fine-tuned by playing.

A rough estimate to size things by:

- 3.5 hours is about 210 minutes, or about 40 minutes per depth.
- Runs grow from about 20 seconds early on to a few minutes late in the game.
  If the average run, including time in the tree, is about 1.5 minutes, the
  whole game is about 140 runs, or 25–30 per depth.
- So the tree's costs have to stretch across that many runs. All costs and
  rewards will live in one data file so they are easy to tune.

## 9. The hub

- **The title room stays**, with its doors to PLAY, HEROES, OPTIONS and
  CREDITS. Hero choice stays as a cosmetic.
- **The underworld is the hub.** When you die, the hands drag you down into
  the underworld, as they do now.
  - **An altar** stands in the middle of the room. Interacting with it opens
    the skill tree page over the game.
  - **The two ladders stay:** TRY AGAIN starts the next run, and MENU goes
    back to the title room.
- **Every run ends in the underworld.** On a death, the hero falls over red
  and the hands drag the corpse down. When the clock runs out, the room
  freezes, a gong sounds, and the hands drag you down the same way, without
  the red.
- **The run results** are written on the underworld floor where YOU DIED
  and the stats are now: YOU DIED or OUT OF TIME, then GOLD EARNED, DEEPEST
  (for example 1-6) and KILLS, plus bones once they drop.
- **Beating a depth's boss** ends the run in the treasure room, and this
  time the gold is real: you collect the boss reward by running through it.
  A ladder then takes you down to the underworld. The next depth is
  unlocked.
- **Choosing a depth** (once there are two): a sign next to the TRY AGAIN
  ladder shows the depth, and hitting it switches to the next unlocked one,
  like the volume blocks. Not needed for the first milestone.
- **The first death unlocks the underworld.** From then on, the title room
  has a well that leads straight down to it, so you can reach the altar
  without dying first. Before that first death, there's no well and no tree.
  The first run is just you, one heart and the clock.
- **No refunds.** Purchases are permanent. You eventually buy most of the
  tree anyway, so the choice is about order.
- **Saving:** progress saves in the browser after every run and every
  purchase. The Options room gets a reset, which asks twice.

## 10. What we keep and what we cut

- **Kept:** movement, touch controls, scaling, hearts, mobs and waves,
  bosses, effects, sound and music, props, the title, Options and Credits
  rooms, settings, and the underworld (now the hub).
- **Reworked:**
  - the swing becomes automatic
  - the dash gets charges and is unlocked in the tree
  - the room flow becomes a timed run
  - the dungeon file changes from questions to depth data
  - the chained door becomes the exit you open with the key
  - the treasure room's gold becomes real, collected with no time limit
- **Removed:**
  - **The scroll band at the top.** The game picture gets about 25% more of
    the screen. The timer, gold and hearts are drawn in the game, and the
    thin hint strip above the game stays for prompts. The credits become
    signs that pop up over their plaques.
  - **All quiz code is deleted**, not switched off: the questions file,
    answer letters on doors, cursed waves, the explanation flow and the
    text-fit checks. Git history keeps it.
  - **The boss-select test room.**
- **The name** stays as a working title. It will be decided together with
  the hook (section 4).

## 11. Build order

- **First milestone:** one depth (10 sub-depths) with a small skill tree,
  tuned until the loop feels good. Depths 2–5 come after that.

The first milestone, one branch and PR per step:

1. **Clean-up:** delete the quiz code, the scroll band and the boss-select
   room. The game still runs: PLAY leads to 10 plain rooms, each with one
   chained door, and the Big Zombie in the last.
2. **Numbers and simulator:** the data file (mobs, rooms, tree nodes,
   costs, drop rates) and the pacing simulator in `tools/`. The first cost
   table comes out of it.
3. **The run:** the run timer, automatic swings, gold drops with a magnet,
   the key and chained-door exit, 10 sub-depths, the boss at 10, every run
   ending in the underworld with its results, and saving.
4. **The hub and the tree:** the altar, the skill tree page, buying nodes,
   the well in the title room and the first-death unlock.
5. **Tree effects:** the dash unlock and its charges, heart drops, time
   orbs, and every node actually doing what it says.
6. **The crypt:** skeletons, slugs, chest mimics, floor spikes, pillars,
   breakables and bones, room by room as in section 3.
7. **Treasure room loot, polish and tuning,** by playing.
