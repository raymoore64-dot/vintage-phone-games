# Game Center setup (App Store Connect)

The game talks to Game Center through a tiny local Capacitor plugin
(`plugins/capacitor-game-center`, Swift + JS: authenticate, submitScore,
showLeaderboard, showDashboard, unlockAchievement). No maintained npm plugin
supports Capacitor 8 yet: `@openforge/capacitor-game-connect` 5.0.2 still
peers on @capacitor/core ^5, and `@bavrk/capacitor-game-center` is a 0.1.0
release, so the bridge lives in the repo.

JS wrapper: `src/native/GameCenter.js` (no-op on web). IDs: `src/native/gcIds.js`.
Everything below must be typed into **App Store Connect > your app >
Services (Features) > Game Center** with *exactly* these IDs.

## When the game reports

| Event | What is sent |
|---|---|
| App start (iOS) | `authenticate` (Game Center sign-in sheet if needed) |
| Every game over | that game's leaderboard (score) + `lb.total` (lifetime points) |
| Official Daily Challenge result | `lb.daily` |
| Any time an achievement condition becomes true | that achievement, 100% (also re-sent after sign-in) |
| Menu > Leaderboards > OK | Game Center UI on the selected board |

## Leaderboards (12)

Create each as **Classic leaderboard**, Score format **Integer**, Sort **High to Low**,
Score submission type **Best Score**, range 0 to 99,999,999. Localise the
display name (English) as below.

| # | Leaderboard ID | Reference / display name | Notes |
|---|---|---|---|
| 1 | `com.studiolinicro.linicro.lb.snake` | Snake: Trail | Best score per game |
| 2 | `com.studiolinicro.linicro.lb.bounce` | Bounce: Flip | Best score per game |
| 3 | `com.studiolinicro.linicro.lb.impact` | Space Impact: Echo | Best score per game |
| 4 | `com.studiolinicro.linicro.lb.bricks` | Bricks: Chain | Best score per game |
| 5 | `com.studiolinicro.linicro.lb.blocks` | Blocks: Quake | Best score per game |
| 6 | `com.studiolinicro.linicro.lb.simon` | Simon: Reverse | Best score per game |
| 7 | `com.studiolinicro.linicro.lb.hopper` | Signal Hopper | Best score per game |
| 8 | `com.studiolinicro.linicro.lb.fishing` | Buzz Fishing | Best score per game |
| 9 | `com.studiolinicro.linicro.lb.rhythm` | Ring Rhythm | Best score per game |
| 10 | `com.studiolinicro.linicro.lb.rally` | Dial-Up Rally | Best score per game |
| 11 | `com.studiolinicro.linicro.lb.daily` | Daily Challenge | Recurring leaderboard: start any day 00:00, duration 1 day, restarts every 1 day |
| 12 | `com.studiolinicro.linicro.lb.total` | Lifetime Points | Submission type Most Recent Score works too (total only grows) |

## Achievements (15, 300 points total)

For each: Reference name = Name, Point value as listed, **Hidden** as listed,
Achievable more than once = No. Localisation (English): Title = Name,
Pre-earned description = Description, Earned description = Description,
image 512x512 PNG (export a crop of `resources/icon.png` or draw one per
achievement).

| # | Achievement ID | Name | Description | Points | Hidden |
|---|---|---|---|---|---|
| 1 | `com.studiolinicro.linicro.ach.first_game` | Hello World | Finish your first game. | 5 | No |
| 2 | `com.studiolinicro.linicro.ach.all_games` | Full Menu | Play all ten games at least once. | 25 | No |
| 3 | `com.studiolinicro.linicro.ach.phone_solara` | Bright Idea | Unlock the SOLARA Sunburst phone (500 points). | 10 | No |
| 4 | `com.studiolinicro.linicro.ach.phone_mintra` | Fresh Minty | Unlock the MINTRA Minty phone (1,500 points). | 15 | No |
| 5 | `com.studiolinicro.linicro.ach.phone_aurum` | Corner Office | Unlock the AURUM Executive phone (3,500 points). | 20 | No |
| 6 | `com.studiolinicro.linicro.ach.phone_volta` | Neon Nights | Unlock the VOLTA Neon phone (7,000 points). | 25 | No |
| 7 | `com.studiolinicro.linicro.ach.phone_proto` | Prototype | Find the secret see-through prototype phone. | 20 | Yes |
| 8 | `com.studiolinicro.linicro.ach.points_25k` | Pocket Legend | Earn 25,000 lifetime points. | 30 | No |
| 9 | `com.studiolinicro.linicro.ach.codes_all` | Code Breaker | Find every entry in the Code book. | 30 | Yes |
| 10 | `com.studiolinicro.linicro.ach.pet_adult` | All Grown Up | Raise your Pocket Pet to Adult. | 20 | No |
| 11 | `com.studiolinicro.linicro.ach.dares_10` | No Chicken | Beat 10 daily dares from your friends. | 20 | No |
| 12 | `com.studiolinicro.linicro.ach.wap_first` | Downloading... | Download your first WAP game. | 10 | No |
| 13 | `com.studiolinicro.linicro.ach.wap_all` | Full Inbox | Download all four WAP games. | 20 | No |
| 14 | `com.studiolinicro.linicro.ach.daily_first` | Daily Driver | Complete your first Daily Challenge. | 10 | No |
| 15 | `com.studiolinicro.linicro.ach.daily_streak_7` | Week Streak | Play the Daily Challenge 7 days in a row. | 40 | No |

## Xcode side

1. Target **App** > Signing & Capabilities > **+ Capability > Game Center**.
   (`ios/App/App/App.entitlements` already contains
   `com.apple.developer.game-center = true` and the build settings point at it;
   adding the capability in Xcode registers it with your App ID.)
2. App Store Connect > the app's version page > **Game Center** section: tick
   the leaderboards and achievements to ship with this version.
3. Test with a Sandbox Apple ID (Settings > Game Center on the device, or the
   sign-in sheet the app shows on launch). Scores from TestFlight / debug
   builds go to the sandbox environment.

## Testing without a Mac

On the web build `window.__vpg.gc.log()` shows every call that *would* go to
Game Center (`native: false`), `__vpg.gc.ids()` lists the IDs, and
`__vpg.gc.snapshot()` shows the values the achievement checks use.

