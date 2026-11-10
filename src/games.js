/*
 * The built-in games (always available) plus helpers that also know about
 * WAP-downloaded games. The menu, the share card and the pet use this.
 */

import CARTRIDGES from './wap/catalog.js';

export const BASE_GAMES = [
  { id: 'snake', name: 'Snake: Trail', scene: 'SnakeScene', bestKey: 'vpg.snake.best' },
  { id: 'bounce', name: 'Bounce: Flip', scene: 'BounceScene', bestKey: 'vpg.bounce.best' },
  { id: 'impact', name: 'Space Impact: Echo', scene: 'ImpactScene', bestKey: 'vpg.impact.best' },
  { id: 'bricks', name: 'Bricks: Chain', scene: 'BricksScene', bestKey: 'vpg.bricks.best' },
  { id: 'blocks', name: 'Blocks: Quake', scene: 'BlocksScene', bestKey: 'vpg.blocks.best' },
  { id: 'simon', name: 'Simon: Reverse', scene: 'SimonScene', bestKey: 'vpg.simon.best' }
];

export function gameInfo(id) {
  return BASE_GAMES.find((g) => g.id === id)
    || CARTRIDGES.find((c) => c.id === id)
    || null;
}

export function gameName(id) {
  const g = gameInfo(id);
  return g ? g.name : String(id || 'Game');
}

export function bestOf(id) {
  const g = gameInfo(id);
  if (!g || !g.bestKey) return 0;
  return Number(localStorage.getItem(g.bestKey) || 0) || 0;
}

export default BASE_GAMES;
