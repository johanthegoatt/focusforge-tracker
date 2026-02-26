# FocusForge Tracker

## Description
FocusForge Tracker is a local web Pomodoro tracker that records completed sessions and computes consistency analytics.

## Features
- Focus timer with adjustable session duration
- Session completion logging to local storage
- Summary analytics: total sessions, total minutes, streak days, and 7-day totals
- Recent session history panel
- Persistent minute preference between visits
- Keyboard shortcuts (`Space`, `R`, `Enter`) for faster workflow
- Dedicated timer state machine module for predictable behavior
- Lightweight browser UI with no backend requirement
- Stats and timer modules covered by automated tests

## Run
```bash
cd focusforge-tracker
npm run dev
```
Open `http://127.0.0.1:8093/focusforge-tracker/index.html`.

## Test
```bash
cd focusforge-tracker
npm test
```

## Project Structure
```text
focusforge-tracker/
  index.html
  styles.css
  app.js
  src/
    stats.js
    storage.js
    timerMachine.js
  tests/
    stats.test.js
    timerMachine.test.js
  package.json
  README.md
```
