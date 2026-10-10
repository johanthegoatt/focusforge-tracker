# Research notes

Each change to FocusForge starts from a real complaint, a guideline or a documented browser behaviour. One line per change on why it was made.

## 2026-10-07

- **Count down to an end time instead of counting ticks.** Chrome throttles timers in hidden tabs to about once a second, and after 5 minutes hidden to once a minute ("intensive throttling", Chrome 88). A timer that subtracts one second per `setInterval` callback falls behind and a 25 minute session can run far longer than 25 minutes. The timer now stores when the session ends and reads the clock on every tick and when the tab becomes visible again.
  - https://developer.chrome.com/blog/timer-throttling-in-chrome-88
  - https://hackernoon.com/the-hidden-bug-breaking-most-javascript-timers

## 2026-10-10

- **Keep the timer through a reload, and log a finished session on its own.** Chrome's Memory Saver and tab discarding unload background tabs and reload them when you come back, and no event fires first, so anything only in memory is gone. A 25 minute session left in a background tab was being lost twice over: the countdown reset, and the session was never logged because logging waited for a "Complete Session" click. The timer now saves its mode, end time and count whenever it changes and when the tab is hidden (Chrome's advice: save as state changes and on `visibilitychange`, not in `beforeunload`). On load it keeps counting against the saved end time, and a focus block that ran out while you were away is logged at the time it actually ended.
  - https://developer.chrome.com/blog/memory-and-energy-saver-mode
  - https://developer.chrome.com/blog/tab-discarding/
- **Tell you when time's up.** The timer ended in silence, so in another tab you only found out by checking. It now plays a short chime, shows the time left in the tab title while it runs, and can pop up a desktop note. Chrome blocks sound until you have clicked on the page (autoplay policy, applied to Web Audio since Chrome 71), so the sound is unlocked from the Start button. The note permission is only asked for from its own switch: Mozilla found fewer than 3% of permission prompts shown on page load were accepted, and Firefox 72 and Safari only allow the prompt after a click.
  - https://developer.chrome.com/blog/autoplay
  - https://hacks.mozilla.org/2019/11/upcoming-notification-permission-changes-in-firefox-72/
- **Name what each session was for, and see where the week went.** The site listed tagged history and "where the time went", but sessions only stored minutes. Cirillo's Pomodoro Technique has you note each pomodoro against an activity so the record can be reviewed later, and a total with no breakdown cannot answer "how much of this week went to email?". Each session now carries an optional name (with your recent names offered as you type), and a "Where the time went" list totals the last 7 days by name.
  - https://www.francescocirillo.com/products/the-pomodoro-technique
- **Count days on your own clock.** Streaks and day totals used `toISOString()`, which is UTC. In Manila (UTC+8) a session before 8am counted as the day before, so two days of work could read as one. Days now use the local offset, a streak no longer reads 0 before the first session of the day, and "last 7 days" covers all of the 7th day back instead of starting at the current time of day.
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
