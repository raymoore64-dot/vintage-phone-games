/*
 * Game Center IDs. These strings must match App Store Connect exactly
 * (Features > Game Center). docs/GAMECENTER.md lists the same table with
 * names, descriptions and points to type in.
 */

export const PREFIX = 'com.studiolinicro.vintagephonegames';

export const GAME_IDS = ['snake', 'bounce', 'impact', 'bricks', 'blocks', 'simon', 'hopper', 'fishing', 'rhythm', 'rally'];

/** Leaderboards: classic, "best score", high-to-low, integer. */
export const LEADERBOARDS = {
  snake: { id: `${PREFIX}.lb.snake`, name: 'Snake: Trail' },
  bounce: { id: `${PREFIX}.lb.bounce`, name: 'Bounce: Flip' },
  impact: { id: `${PREFIX}.lb.impact`, name: 'Space Impact: Echo' },
  bricks: { id: `${PREFIX}.lb.bricks`, name: 'Bricks: Chain' },
  blocks: { id: `${PREFIX}.lb.blocks`, name: 'Blocks: Quake' },
  simon: { id: `${PREFIX}.lb.simon`, name: 'Simon: Reverse' },
  hopper: { id: `${PREFIX}.lb.hopper`, name: 'Signal Hopper' },
  fishing: { id: `${PREFIX}.lb.fishing`, name: 'Buzz Fishing' },
  rhythm: { id: `${PREFIX}.lb.rhythm`, name: 'Ring Rhythm' },
  rally: { id: `${PREFIX}.lb.rally`, name: 'Dial-Up Rally' },
  daily: { id: `${PREFIX}.lb.daily`, name: 'Daily Challenge', recurring: 'daily', note: 'Recurring leaderboard, 1-day duration, resets 00:00 UTC' },
  total: { id: `${PREFIX}.lb.total`, name: 'Lifetime Points', note: 'Most recent score (total only grows)' }
};

export const lbId = (key) => (LEADERBOARDS[key] ? LEADERBOARDS[key].id : null);

/**
 * Achievements. `points` sum to 300 (App Store Connect allows up to 1000).
 * `check(s)` gets a snapshot from GameCenter.snapshot() and returns
 * true once earned. `hidden` = secret until earned.
 */
export const ACHIEVEMENTS = [
  { key: 'first_game', name: 'Hello World', desc: 'Finish your first game.', points: 5,
    check: (s) => s.plays >= 1 },
  { key: 'all_games', name: 'Full Menu', desc: 'Play all ten games at least once.', points: 25,
    check: (s) => s.gamesPlayed >= 10 },
  { key: 'phone_solara', name: 'Bright Idea', desc: 'Unlock the SOLARA Sunburst phone (500 points).', points: 10,
    check: (s) => s.total >= 500 },
  { key: 'phone_mintra', name: 'Fresh Minty', desc: 'Unlock the MINTRA Minty phone (1,500 points).', points: 15,
    check: (s) => s.total >= 1500 },
  { key: 'phone_aurum', name: 'Corner Office', desc: 'Unlock the AURUM Executive phone (3,500 points).', points: 20,
    check: (s) => s.total >= 3500 },
  { key: 'phone_volta', name: 'Neon Nights', desc: 'Unlock the VOLTA Neon phone (7,000 points).', points: 25,
    check: (s) => s.total >= 7000 },
  { key: 'phone_proto', name: 'Prototype', desc: 'Find the secret see-through prototype phone.', points: 20, hidden: true,
    check: (s) => s.proto },
  { key: 'points_25k', name: 'Pocket Legend', desc: 'Earn 25,000 lifetime points.', points: 30,
    check: (s) => s.total >= 25000 },
  { key: 'codes_all', name: 'Code Breaker', desc: 'Find every entry in the Code book.', points: 30, hidden: true,
    check: (s) => s.codesFound >= s.codesTotal && s.codesTotal > 0 },
  { key: 'pet_adult', name: 'All Grown Up', desc: 'Raise your Pocket Pet to Adult.', points: 20,
    check: (s) => s.petStage >= 3 },
  { key: 'dares_10', name: 'No Chicken', desc: 'Beat 10 daily dares from your friends.', points: 20,
    check: (s) => s.dares >= 10 },
  { key: 'wap_first', name: 'Downloading...', desc: 'Download your first WAP game.', points: 10,
    check: (s) => s.wapDownloaded >= 1 },
  { key: 'wap_all', name: 'Full Inbox', desc: 'Download all four WAP games.', points: 20,
    check: (s) => s.wapDownloaded >= 4 },
  { key: 'daily_first', name: 'Daily Driver', desc: 'Complete your first Daily Challenge.', points: 10,
    check: (s) => s.dailyDone >= 1 },
  { key: 'daily_streak_7', name: 'Week Streak', desc: 'Play the Daily Challenge 7 days in a row.', points: 40,
    check: (s) => s.bestStreak >= 7 }
].map((a) => ({ ...a, id: `${PREFIX}.ach.${a.key}` }));

export const achId = (key) => {
  const a = ACHIEVEMENTS.find((x) => x.key === key);
  return a ? a.id : null;
};

export default { PREFIX, GAME_IDS, LEADERBOARDS, ACHIEVEMENTS, lbId, achId };
