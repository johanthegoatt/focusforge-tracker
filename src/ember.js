// Ember, the little spark who keeps you company. Her face follows the timer
// (sleepy before your first session, calm and quiet while you focus, worried
// when paused, happy on a break), her eyes follow your pointer or whatever you
// tap, and a tap gives a tip that fits the moment. While you focus she only
// speaks when you tap her. Everything she says goes through a live region so
// screen readers hear it too.

const TIPS = {
  first: [
    "Hi, I'm Ember! Type what you're working on, then press Start.",
    "One block is 25 minutes of one thing. Then a 5 minute break.",
    "Phone face down helps more than you'd think."
  ],
  ready: [
    "Name the next thing, then press Start.",
    "After four blocks you get a long break.",
    "Try the 50 minute setting for deep work, in Settings."
  ],
  focusing: [
    "Shh, you're doing great. One thing at a time.",
    "Thought of something else to do? Jot it down and come back.",
    "You can switch tabs. I'll ring when the time's up."
  ],
  paused: [
    "Paused. Press Keep going when you're back.",
    "Had to stop for good? Finish now logs what you did."
  ],
  breakReady: [
    "Press Start for your break. Step away from the screen.",
    "Breaks count too. Rested brains focus longer."
  ],
  resting: [
    "Stretch, drink some water, look at something far away.",
    "No peeking at email. That's work wearing a disguise."
  ]
};

export function createEmber({ tipFor = () => "ready", onWake = () => {} } = {}) {
  const btn = document.getElementById("ember");
  const bubble = document.getElementById("ember-bubble");
  const dock = document.getElementById("ember-dock");
  const hide = document.getElementById("ember-hide");
  const noop = { mood() {}, say() {}, cheer() {} };
  if (!btn) return noop;

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let baseMood = "sleepy";
  let flashTimer = 0;
  let bubbleTimer = 0;
  let flashing = false;
  let taps = [];
  const tipIndex = {};

  function setFace(mood) {
    btn.dataset.mood = mood;
  }

  function say(text, ms = 7000) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth; // restart the pop animation
    bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.textContent = ""; }, ms);
  }

  function flash(mood, ms = 1500) {
    setFace(mood);
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashing = false;
      setFace(baseMood);
    }, ms);
  }

  function play(cls) {
    if (still.matches) return;
    btn.classList.remove("hop", "spin");
    void btn.offsetWidth;
    btn.classList.add(cls);
  }
  btn.addEventListener("animationend", () => btn.classList.remove("hop", "spin"));

  function sparks() {
    if (still.matches) return;
    const r = btn.getBoundingClientRect();
    for (let i = 0; i < 14; i += 1) {
      const s = document.createElement("span");
      s.className = "spark";
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 60;
      s.style.left = `${r.left + r.width / 2}px`;
      s.style.top = `${r.top + r.height * 0.4}px`;
      s.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      s.style.setProperty("--dy", `${Math.sin(angle) * dist - 40}px`);
      document.body.append(s);
      s.addEventListener("animationend", () => s.remove());
    }
  }

  function nextTip() {
    const key = tipFor();
    const list = TIPS[key] || TIPS.ready;
    const i = tipIndex[key] || 0;
    tipIndex[key] = (i + 1) % list.length;
    return list[i];
  }

  btn.addEventListener("click", () => {
    if (dock.classList.contains("tucked")) {
      dock.classList.remove("tucked");
      remember(false);
      say("I'm back! Tap me any time for a tip.");
      play("hop");
      return;
    }
    const now = Date.now();
    taps = taps.filter((t) => now - t < 1600);
    taps.push(now);
    if (taps.length >= 5) {
      taps = [];
      play("spin");
      flash("wow", 1300);
      sparks();
      say("Whoa, I'm all fired up now!");
      return;
    }
    play("hop");
    if (baseMood === "sleepy") {
      flash("happy", 1600);
      onWake();
    }
    say(nextTip());
  });

  hide.addEventListener("click", () => {
    dock.classList.add("tucked");
    bubble.textContent = "";
    remember(true);
  });

  function remember(tucked) {
    try {
      localStorage.setItem("focusforge:emberTucked", tucked ? "1" : "");
    } catch {
      // Storage blocked: she just shows up again next time.
    }
  }
  try {
    if (localStorage.getItem("focusforge:emberTucked") === "1") dock.classList.add("tucked");
  } catch {
    // ignore
  }

  // Eyes follow the pointer, a few pixels at most.
  const pupils = btn.querySelectorAll(".e-pupil");
  let target = null;
  let frame = 0;
  function look() {
    frame = 0;
    if (!target) return;
    const r = btn.getBoundingClientRect();
    const dx = target.x - (r.left + r.width / 2);
    const dy = target.y - (r.top + r.height * 0.6);
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / 220);
    const x = (dx / d) * 2.6 * reach;
    const y = (dy / d) * 3 * reach;
    for (const p of pupils) p.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`;
  }
  function lookAt(x, y) {
    target = { x, y };
    if (!frame) frame = requestAnimationFrame(look);
  }
  window.addEventListener("pointermove", (ev) => lookAt(ev.clientX, ev.clientY), { passive: true });
  // On a phone there is no hover, so she looks at whatever you tap or type in.
  document.addEventListener("focusin", (ev) => {
    if (ev.target === btn || !ev.target.getBoundingClientRect) return;
    const r = ev.target.getBoundingClientRect();
    lookAt(r.left + r.width / 2, r.top + r.height / 2);
  });

  // Blink now and then, unless asleep or deep in focus.
  (function blink() {
    setTimeout(() => {
      if (baseMood !== "sleepy" && baseMood !== "focus" && !document.hidden && !still.matches) {
        btn.classList.add("blink");
        setTimeout(() => btn.classList.remove("blink"), 140);
      }
      blink();
    }, 2600 + Math.random() * 3200);
  })();

  return {
    mood(mood) {
      baseMood = mood;
      if (!flashing) setFace(mood);
    },
    say,
    cheer(text) {
      play("hop");
      flash("wow", 1400);
      sparks();
      if (text) say(text, 9000);
    }
  };
}
