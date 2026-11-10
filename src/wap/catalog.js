/*
 * WAP download cartridges. Pure data: Wap.js decides status from it.
 *
 * All four cartridges have scenes registered in main.js (batch C).
 * To add another: register its Phaser scene in main.js and add an entry here. Status is automatic:
 *   'soon'       — no scene with that key is registered yet ("Coming soon")
 *   'locked'     — scene exists, requirement not met
 *   'ready'      — requirement met, can be downloaded
 *   'installed'  — downloaded; shown in the main Games menu
 *
 * req types: { type: 'points', value }   lifetime points
 *            { type: 'dares', value }    daily dares beaten
 *            { type: 'code', value, hint } a Code book entry id is found
 *
 * bestKey is the localStorage key the game uses for its best score (the
 * menu and share card read it). sizeKb drives the fake download.
 */

export const CARTRIDGES = [
  {
    id: 'hopper', name: 'Signal Hopper', scene: 'HopperScene', bestKey: 'vpg.hopper.best',
    sizeKb: 46, desc: 'Hop a text through static and data streams to the tower. Mind your signal.',
    req: { type: 'points', value: 2500 }
  },
  {
    id: 'fishing', name: 'Buzz Fishing', scene: 'FishingScene', bestKey: 'vpg.fishing.best',
    sizeKb: 38, desc: 'Find fish by the buzz, strike on the bite, reel against the tension.',
    req: { type: 'dares', value: 2 }
  },
  {
    id: 'rhythm', name: 'Ring Rhythm', scene: 'RhythmScene', bestKey: 'vpg.rhythm.best',
    sizeKb: 52, desc: 'Tap 3 keypad lanes in time with the ringtone you pick.',
    req: { type: 'code', value: 'tones', hint: 'secret WAP word (ask Kaz)' }
  },
  {
    id: 'rally', name: 'Dial-Up Rally', scene: 'RallyScene', bestKey: 'vpg.rally.best',
    sizeKb: 64, desc: 'A 2-minute race at 56k. Grab bandwidth to load the road ahead.',
    req: { type: 'points', value: 6000 }
  }
];

export default CARTRIDGES;
