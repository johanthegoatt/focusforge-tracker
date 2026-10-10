// Time's up: a short chime and, if you turned it on, a desktop note.
//
// Browsers only let a page make sound after you click something on it, so the
// audio is unlocked from the Start button. The notification permission is
// only asked for from its own switch, never on page load.

let audio = null;

export function unlockSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audio) audio = new Ctx();
  if (audio.state === "suspended") audio.resume().catch(() => {});
}

export function chime() {
  if (!audio || audio.state !== "running") return;
  const start = audio.currentTime + 0.02;
  // Three soft notes going up: C6, E6, G6.
  [1046.5, 1318.5, 1568].forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const at = start + i * 0.18;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.65);
  });
}

export function notesSupported() {
  return "Notification" in window;
}

export function notesAllowed() {
  return notesSupported() && Notification.permission === "granted";
}

export async function askForNotes() {
  if (!notesSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showNote(title, body) {
  if (!notesAllowed() || document.visibilityState === "visible") return;
  try {
    const note = new Notification(title, { body, tag: "focusforge" });
    note.onclick = () => {
      window.focus();
      note.close();
    };
  } catch {
    // Some mobile browsers only allow notes from a service worker.
  }
}
