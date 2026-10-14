# Gridiron Cellular Warfare

A Conway's-Life tactical arcade game. Pick a football-style formation, bet play money, and watch two (or four)
armies of cells fight under Life's rules on a neon-green field, with a pit underneath that scores the overflow.
Everything is a virtual currency: no real money, no backend, saves stay on your device.

## Run it

```
npm install
npm run dev          # http://localhost:5173
npm run dev:lan      # same, reachable from your phone on the same Wi-Fi (use the LAN IP it prints)
npm run build        # static site in dist/ (relative paths, so it can be hosted from any sub-path)
npm test             # Vitest (the engine regression tests take about half a minute)
```

## How to play

1. Pick a formation (Formations tab). It previews on your half.
2. Optional: buy one shop piece, press **Place**, and tap a spot on your half (nudge it with the arrows on phones).
3. Set a bet and **Lock In**, then **Snap**. The bot's formation is revealed after you lock in; an Audible lets you switch.
4. Cells follow Life's rules; towers of chips topple into the pit. The side with more ground plus the pit bonus wins.

Modes: **Classic 1v1** (even money) and the **4-player arena** (a board twice the size, three bots, winner takes all, a win pays x3).
**Football season** (no betting): eight games, six drives each. You play your drives live: receivers are light spaceships that run at the defence, the ball is a glider you fire from the quarterback (pick a receiver with 1-4 or the arrows, press Space when the dashed line turns green; taps work too), and a run sends a glider through the line. Coverage players, spaceships and the ball all fight under Life's rules, so a defender the glider touches ends the throw. The opponent's drives are simulated against the defence you pick. Physics checks: `node scripts/football-live-sim.mjs`, `node scripts/football-live-drives.mjs`.

Tables run from Rookie to Mogul with bigger bets, fees, sharper bots and bosses that turn up at random.

## Layout

| Path | What lives there |
| --- | --- |
| `src/engine/` | Deterministic Life engine (`engine.js` 2 teams, `engineN.js` any number), geometry, formations, rating, `footballLive.js` (live football physics), `football.js` (drive rules) |
| `src/game/` | Wallet and saves, tables, bosses, anti-save-scum, tutorial |
| `src/render/` | Canvas drawing of the board, pit and chips |
| `src/components/` | Sidebar (formations, shop), tables, arena canvas, formation designer |
| `scripts/` | Balance, pricing and simulation tooling (`node scripts/<name>.mjs`) |

## Notes

- The engine is seeded and deterministic, so replays and settle-on-reload are exact.
- Saves are local and revisioned; they deter casual cheating but a server is needed to make it airtight.
- Layouts: three columns on desktop and foldables, a pinned board with bottom sheets and a dock on phones.
