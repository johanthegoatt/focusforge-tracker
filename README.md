# FocusForge

A focus timer that keeps time when you switch tabs, rings when time's up, and shows where your week went.

Live: https://focusforge.johanthegoat.xyz

## What it does

- **Work in blocks.** 25 minutes of focus, a 5 minute break, and a 15 minute break after every fourth block. Change the focus length in Settings (15, 25, 45, 50 or any number up to 90).
- **Keeps time in the background.** The clock counts down to a fixed end time, so a hidden tab that the browser slows down still ends on time. If the browser unloads the tab or you close it, the timer picks up where it was when you come back.
- **Logs a block on its own.** When the time runs out the block is saved at the minute it really ended, even if the page was closed. "Finish now" saves the minutes you actually did.
- **Tells you when time's up.** A short chime, the time left in the tab title, and an optional desktop note.
- **Where the time went.** Name what you're working on and the last 7 days are totalled by name, next to today, this week and your streak.
- **Ember.** A little spark in the corner who changes face with the timer, follows your pointer, and gives a tip when you tap her.

Keys: `Space` start or pause, `F` finish now, `N` skip, `R` reset.

## How it's built

Plain HTML, CSS and ES modules, no build step.

- `src/timerMachine.js`: the timer as plain state plus functions (start, pause, sync to the clock, next interval, save and restore). No DOM, so it is tested in Node.
- `src/stats.js`: totals, streaks and the per-name breakdown. Days are counted on the local clock, so a 7am session east of UTC lands on the right day.
- `src/alerts.js`: Web Audio chime (unlocked from the Start click, as Chrome's autoplay policy needs) and the Notification API, asked for only from its own switch.
- `src/ember.js`: the mascot.
- `docs/research-notes.md`: why each change was made, with sources.

## Run

```bash
npm run dev
```

Then open http://localhost:8093.

## Test

```bash
npm test
```
