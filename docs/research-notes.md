# Research notes

Each change to FocusForge starts from a real complaint, a guideline or a documented browser behaviour. One line per change on why it was made.

## 2026-10-07

- **Count down to an end time instead of counting ticks.** Chrome throttles timers in hidden tabs to about once a second, and after 5 minutes hidden to once a minute ("intensive throttling", Chrome 88). A timer that subtracts one second per `setInterval` callback falls behind and a 25 minute session can run far longer than 25 minutes. The timer now stores when the session ends and reads the clock on every tick and when the tab becomes visible again.
  - https://developer.chrome.com/blog/timer-throttling-in-chrome-88
  - https://hackernoon.com/the-hidden-bug-breaking-most-javascript-timers
