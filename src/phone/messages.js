/*
 * Everything your phone's friends say. Pure data: Sms.js picks a line,
 * fills {placeholders} and drops it in the inbox.
 *
 * Placeholders: {game} {target} {score} {bonus} {phone} {total} {best}
 */

export const CAST = {
  dex: { name: 'Dex', number: '07700 900113' },
  mum: { name: 'Mum', number: '07700 900222' },
  kaz: { name: 'Kaz', number: '07700 900345' },
  unknown: { name: 'Unknown', number: 'Withheld' },
  bank: { name: 'The Bank', number: '0808 157 0192' },
  network: { name: 'LINICRO Net', number: '121' }
};

export const GAME_INFO = {
  snake: { name: 'Snake', scene: 'SnakeScene' },
  bounce: { name: 'Bounce', scene: 'BounceScene' },
  impact: { name: 'Space Impact', scene: 'ImpactScene' },
  bricks: { name: 'Bricks', scene: 'BricksScene' },
  blocks: { name: 'Blocks', scene: 'BlocksScene' },
  simon: { name: 'Simon', scene: 'SimonScene' }
};

// First launch, delivered in this order.
export const WELCOME = [
  { from: 'network', text: 'Welcome to LINICRO Net! Ur phone is ready. Txts are FREE 4 life. Gr8 games inside. Enjoy :-)' },
  { from: 'mum', text: 'Hello love, this is Mum. Is this how u text? Dad says press the 2 key 3 times for C. Dont stay up late playing games. Mum x' },
  { from: 'dex', text: 'oi! got ur new number. bet ur still rubbish at snake lol. ill send u dares. dont be a chicken m8' }
];

// Daily dares. One is picked per day from the date.
export const DARES = [
  { game: 'snake', target: 150, from: 'dex', bonus: 200,
    text: 'bet u cant get {target} in Snake 2day. loser buys chips :-P',
    win: 'wot?! {score} in Snake?? ok ok u win. +{bonus} pts 4 u. chips r on me' },
  { game: 'snake', target: 300, from: 'kaz', bonus: 300,
    text: 'my lil bro got {target} on Snake. u cant even beat a 9 yr old can u ;-)',
    win: '{score}!! ok ur officially cooler than my bro. +{bonus} pts luv' },
  { game: 'bounce', target: 250, from: 'dex', bonus: 200,
    text: 'Bounce dare: {target} pts. flip or die m8',
    win: 'u bounced {score}?? wat r u, a rubber ball. +{bonus} pts' },
  { game: 'impact', target: 400, from: 'kaz', bonus: 250,
    text: 'aliens r invading. need {target} in Space Impact 2 save us. no pressure x',
    win: 'earth is saved! {score} pts. ur my hero (dont tell any1). +{bonus} pts' },
  { game: 'bricks', target: 300, from: 'dex', bonus: 200,
    text: 'smash {target} in Bricks b4 midnite or ur buyin pizza',
    win: '{score} in Bricks. fine. pizza on me. +{bonus} pts' },
  { game: 'blocks', target: 500, from: 'kaz', bonus: 250,
    text: 'Blocks: {target} pts. i did it on the bus. ur turn',
    win: '{score}!!! ok ur the block queen/king now. +{bonus} pts' },
  { game: 'simon', target: 120, from: 'mum', bonus: 200,
    text: 'Dad says the beepy memory game is good 4 ur brain. Get {target} on Simon please. Mum x',
    win: 'Well done love! {score} on Simon. Dad is very proud. Here is +{bonus} pts. Mum x' },
  { game: 'impact', target: 250, from: 'dex', bonus: 150,
    text: 'quick 1: {target} in Space Impact. warm up dare. ez',
    win: '{score}. yeh yeh ez 4 u. +{bonus} pts' }
];

// Lifetime points milestones.
export const MILESTONES = [
  { at: 250, from: 'dex', text: '{total} pts already? not bad 4 a beginner' },
  { at: 1000, from: 'kaz', text: 'omg {total} pts!! ur addicted. wanna come round 4 a game l8r?' },
  { at: 2500, from: 'mum', text: 'Your brother says you have {total} points. Is that good? Have you done your homework. Mum x' },
  { at: 5000, from: 'dex', text: '{total} pts... m8 go outside lol. (respect tho)' },
  { at: 10000, from: 'kaz', text: '{total}!!! ur a legend. i told every1 at skool' },
  { at: 20000, from: 'network', text: 'LINICRO Net: Congratulations! {total} pts. U r in our TOP PLAYERS club. No prize. Sorry.' }
];

// New personal bests (one per game per day).
export const BESTS = [
  { from: 'dex', text: 'new best in {game}?? {score}! who r u and wot have u done with my m8' },
  { from: 'kaz', text: '{score} in {game}! ur on fire :-)' },
  { from: 'dex', text: 'saw ur {game} score. {score}. jammy. pure luck lol' },
  { from: 'kaz', text: 'new {game} record {score}. framing it on my wall x' }
];

// Phone unlocked (key = skin id). Fallback used for anything else.
export const UNLOCKS = {
  'solara-sunburst': { from: 'kaz', text: 'ur SOLARA came!! sunburst is SO cute. its got a Sunlight perk - bonus pts every 20s!' },
  'mintra-minty': { from: 'dex', text: 'u got the MINTRA Minty?! its lucky m8, doubles ur pts sometimes. jealous' },
  'aurum-executive': { from: 'mum', text: 'Your Dad says you have an Executive phone now. Very posh. x1.5 points but harder. Mum x' },
  'volta-neon': { from: 'unknown', text: 'the VOLTA glows. watch 4 the glitches. they pay double.' },
  'proto-clear': { from: 'unknown', text: 'u found the prototype. it was never meant 2 leave the lab. Overclock perk active.' },
  default: { from: 'network', text: 'LINICRO Net: new phone unlocked - {phone}! Press right soft key on the menu 2 swap.' }
};

export const NIGHT = [
  { from: 'mum', text: 'Its {time}!! Why are you still up?? Bed. NOW. Mum x' },
  { from: 'kaz', text: 'cant sleep either? txt me ur {game} score. night owls unite' }
];

// Codes (see Secrets.js). Sent once each.
export const CODE_MESSAGES = {
  proto: { from: 'unknown', text: 'dont ask who this is. on the menu press * then 7283. tell no1.', code: '7283' },
  mains: { from: 'kaz', text: 'battery always dying? my cousin showed me a trick: on the menu press * 2288. mains power 4 free ;-)', code: '2288' }
};

export const DARE_EXPIRED = { from: 'dex', text: 'u never did my dare yday. CHICKEN. new 1 coming...' };

// ---- Fake calls (Calls.js) ---------------------------------------------------
// Each caller: ringtone id, answered-call transcripts (2-4 lines, with a
// reward), the guilt-trip text sent after a decline, and a missed-call text.
// reward: { points: n } adds to this run's score, { double: ms } = x2 score.
export const CALLS = {
  mum: {
    ring: 'ring_mum',
    answers: [
      { lines: ['MUM: Hello? Hello? Is this thing on?', 'MUM: I\'m on the house phone, it\'s cheaper.', 'MUM: Your tea\'s in the microwave. 2 mins. Bye love!'], reward: { points: 40 }, label: 'MUM\'S TEA' },
      { lines: ['MUM: Did you get my text? I put a kiss on it.', 'YOU: Yes Mum.', 'MUM: Dad wants to know how to do the snake one. Bye x'], reward: { points: 30 }, label: 'MUM' },
      { lines: ['MUM: I\'ve put £10 credit on your phone.', 'MUM: Don\'t spend it all on ringtones.', 'MUM: Especially that frog one. Bye!'], reward: { points: 50 }, label: 'TOP-UP' }
    ],
    guilt: 'You declined my call. I can SEE that you know. Not cross, just disappointed. Mum x',
    missed: 'Rang u 3 times. Are u alive? Ring me back. Not from the house phone, Dad is on the internet. Mum x'
  },
  dex: {
    ring: 'ring_dex',
    answers: [
      { lines: ['DEX: alriiiiight!!', 'YOU: alriiiiight!', 'DEX: ...ok thats all i rang 4. laters'], reward: { points: 25 }, label: 'DEX' },
      { lines: ['DEX: m8 can u hear me? im in a tunnel', 'DEX: ...kkkshhhh...', 'DEX: ...ill txt u. its 10p a txt'], reward: { points: 20 }, label: 'TUNNEL' },
      { lines: ['DEX: did u tape the footy last nite?', 'YOU: on VHS yeah', 'DEX: LEGEND. dont tape ur mums soaps over it'], reward: { points: 35 }, label: 'VHS' }
    ],
    guilt: 'u blanked me?? m8. MATE. fine. im telling every1 ur rubbish at snake',
    missed: 'pick up ur phone!!! wot is the point of a mobile if u never answer it'
  },
  kaz: {
    ring: 'ring_kaz',
    answers: [
      { lines: ['KAZ: r u going 2 the school disco friday?', 'KAZ: wear the butterfly clips. trust me', 'KAZ: my credits running ou-'], reward: { double: 6000 }, label: 'HYPED x2' },
      { lines: ['KAZ: guess who fancies u!!', 'YOU: who??', 'KAZ: not telling ;-) byeee'], reward: { points: 30 }, label: 'GOSSIP' }
    ],
    guilt: 'rude!! i was gonna tell u a secret. not now :-(',
    missed: 'missed u! ring me back b4 9 its free after 9 x'
  },
  unknown: {
    ring: 'ring_unknown',
    answers: [
      { lines: ['???: ...', '???: the prototype is watching u play.', '???: *dial-up noises*'], reward: { double: 6000 }, label: 'SIGNAL x2' },
      { lines: ['???: is ur fridge running?', 'YOU: ...yes?', '???: better go catch it then! *click*'], reward: { points: 20 }, label: 'PRANKED' }
    ],
    guilt: 'you cant ignore me 4ever.',
    missed: 'withheld number tried to call u. twice. sleep tight.'
  },
  bank: {
    ring: 'ring_bank',
    answers: [
      { lines: ['BANK: Good evening, this is The Bank.', 'BANK: You have been selected for a Gold Card.', 'BANK: Only joking. Here are some points of interest.'], reward: { points: 60 }, label: 'INTEREST' },
      { lines: ['BANK: Your account is overdrawn by... 3p.', 'BANK: We have waived it. Do not tell anyone.', 'BANK: Have a nice day.'], reward: { points: 40 }, label: 'REFUND' }
    ],
    guilt: 'The Bank: We tried to call you about your account. Please do not ignore us. Have a nice day.',
    missed: 'The Bank: Sorry we missed you. Your call is important to us. Please hold.'
  }
};

// Weighted caller pool (Mum rings the most, of course)
export const CALLER_POOL = ['mum', 'mum', 'dex', 'dex', 'kaz', 'unknown', 'bank'];

// T9 easter eggs (Eggs.js)
export const EGG_TEXTS = {
  lol: 'LOL',
  lolFollow: 'u typed LOL into a phone menu. who r u laughing at?'
};

export default { CAST, GAME_INFO, WELCOME, DARES, MILESTONES, BESTS, UNLOCKS, NIGHT, CODE_MESSAGES, DARE_EXPIRED, CALLS, CALLER_POOL, EGG_TEXTS };
