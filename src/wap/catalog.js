/*
 * WAP download cartridges. Pure data: Wap.js decides status from it.
 *
 * Plugging in a new game (batch C): add its Phaser scene to main.js and
 * keep / edit its entry here. Status is automatic:
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
    sizeKb: 46, desc: 'Hop across the road on phone-signal bars. Lose signal, lose a life.',
    req: { type: 'points', value: 2500 }
  },
  {
    id: 'fishing', name: 'Buzz Fishing', scene: 'FishingScene', bestKey: 'vpg.fishing.best',
    sizeKb: 38, desc: 'Feel for bites through the vibrate motor. Reel in on the buzz.',
    req: { type: 'dares', value: 2 }
  },
  {
    id: 'rhythm', name: 'Ring Rhythm', scene: 'RhythmScene', bestKey: 'vpg.rhythm.best',
    sizeKb: 52, desc: 'Tap the keypad in time with your ringtones.',
    req: { type: 'code', value: 'tones', hint: 'secret WAP word (ask Kaz)' }
  },
  {
    id: 'rally', name: 'Dial-Up Rally', scene: 'RallyScene', bestKey: 'vpg.rally.best',
    sizeKb: 64, desc: 'A 2-minute race at 56k. Mind the buffering.',
    req: { type: 'points', value: 6000 }
  }
];

export default CARTRIDGES;
