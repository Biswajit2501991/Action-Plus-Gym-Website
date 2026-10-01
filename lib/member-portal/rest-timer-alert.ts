/** Rest-timer finish alert. Generated in the browser. No uploaded audio file. */

const SOUND_KEY = "apg.rest-timer.sound";

let audioCtx: AudioContext | null = null;
let alertToken = 0;

function audioContextCtor() {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

export function readRestTimerSoundOn() {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeRestTimerSoundOn(on: boolean) {
  try {
    sessionStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* private mode */
  }
}

/** Call from the tap that starts or resumes the timer so the finish sound is allowed. */
export function primeRestTimerAudio() {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    /* unsupported */
  }
}

export function stopRestTimerAlert() {
  alertToken += 1;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.(0);
  } catch {
    /* ignore */
  }
}

function beep(ctx: AudioContext, freq: number, start: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.42, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

async function playDoneBeeps() {
  // Let a just-paused video release the phone's sound before the beep.
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  primeRestTimerAudio();
  if (!audioCtx) return;
  try {
    if (audioCtx.state === "suspended") await audioCtx.resume();
  } catch {
    /* the phone may still be holding sound for the video */
  }
  if (audioCtx.state === "closed") return;
  const start = audioCtx.currentTime;
  beep(audioCtx, 880, start, 0.18);
  beep(audioCtx, 1174, start + 0.22, 0.28);
}

function speakDone(token: number, onDone: () => void) {
  const finish = () => {
    if (token !== alertToken) return;
    onDone();
  };
  if (typeof window === "undefined" || !window.speechSynthesis) {
    window.setTimeout(finish, 700);
    return;
  }
  window.setTimeout(() => {
    if (token !== alertToken) return;
    try {
      const utter = new SpeechSynthesisUtterance("Done");
      utter.lang = "en-US";
      utter.rate = 1;
      utter.volume = 1;
      utter.onend = finish;
      utter.onerror = finish;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      finish();
    }
  }, 420);
}

function vibrateDone() {
  try {
    navigator.vibrate?.([180, 90, 180, 90, 380]);
  } catch {
    /* iPhone browsers do not vibrate websites */
  }
}

function notifyIfAllowed() {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const hidden = document.visibilityState === "hidden";
    new Notification("Rest complete", {
      body: "Done.",
      silent: !hidden,
      tag: "apg-rest-timer",
    });
  } catch {
    /* ignore */
  }
}

/**
 * Beep, spoken “Done”, Android vibration, and a local banner if notifications are already allowed.
 * Resolves when the voice finishes, or after a short cap so a paused video can continue.
 */
export function playRestTimerDone(): Promise<void> {
  const token = ++alertToken;
  void playDoneBeeps();
  vibrateDone();
  notifyIfAllowed();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const cap = window.setTimeout(done, 2200);
    speakDone(token, () => {
      window.clearTimeout(cap);
      window.setTimeout(done, 150);
    });
  });
}
