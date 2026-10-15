import { LETTERS } from "./config.js";

// Loads a dungeon file (questions and answers) from the server.
export async function loadDungeon(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't load dungeon ${url} (${response.status})`);
  const dungeon = await response.json();

  dungeon.rooms.forEach((room, i) => {
    const answers = 1 + room.wrong.length;
    if (answers < 2 || answers > LETTERS.length) {
      throw new Error(`Room ${i + 1} has ${answers} answers; it needs 2 to ${LETTERS.length}.`);
    }
  });
  return dungeon;
}

// Fisher-Yates shuffle: walk backwards through the list, swapping each item
// with a random one at or before it. Every order is equally likely, which
// isn't true of the popular `sort(() => Math.random() - 0.5)` trick.
function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A run is one attempt at the dungeon. Questions come in a new order every
// run, and so do the answers behind the doors, so nobody can memorize
// "the answer is always the left door".
export function newRun(dungeon) {
  const rooms = shuffle(dungeon.rooms).map((room) => {
    const answers = shuffle([
      { text: room.correct, correct: true },
      ...room.wrong.map((text) => ({ text, correct: false })),
    ]);
    return { question: room.question, explanation: room.explanation, answers };
  });

  return { dungeon, rooms, index: 0 };
}
