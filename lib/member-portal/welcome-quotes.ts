/** Motivational fitness quotes for Member Portal welcome popup (no numbering). */
export const PORTAL_WELCOME_QUOTES = [
  "Your only competition is the person you were yesterday.",
  "Consistency beats motivation.",
  "Progress, not perfection.",
  "Strong today. Stronger tomorrow.",
  "Every workout counts.",
  "Discipline creates freedom.",
  "One more rep. One step closer.",
  "Sweat now. Shine later.",
  "Success starts with showing up.",
  "Don't quit. You're getting stronger.",
  "Small habits create big results.",
  "Results come to those who stay consistent.",
  "Push yourself because no one else can do it for you.",
  "The pain you feel today is the strength you'll feel tomorrow.",
  "Believe in yourself and keep moving.",
  "Excuses don't burn calories.",
  "Every day is a chance to improve.",
  "Fitness is a journey, not a destination.",
  "Great things never come from comfort zones.",
  "Stay patient. Stay consistent.",
  "Your future self will thank you.",
  "The body achieves what the mind believes.",
  "One workout at a time.",
  "Strong mind. Strong body.",
  "Don't count the days. Make the days count.",
  "Nothing changes if nothing changes.",
  "Be stronger than your strongest excuse.",
  "Champions are built through consistency.",
  "Train hard. Stay humble.",
  "Wake up with determination. Sleep with satisfaction.",
  "Health is the greatest wealth.",
  "Keep going. You're closer than you think.",
  "Success begins with self-discipline.",
  "Focus on progress, not speed.",
  "The best project you'll ever work on is yourself.",
  "Fall in love with becoming healthier.",
  "A little progress every day adds up.",
  "Fitness is earned, not given.",
  "Be proud, but never satisfied.",
  "Make your body your greatest investment.",
  "Strong habits build strong people.",
  "You don't have to be extreme, just consistent.",
  "One hour of exercise is only 4% of your day.",
  "Every drop of sweat is a step toward success.",
  "Healthy choices create a healthy life.",
  "Your limits exist only in your mind.",
  "Start where you are. Use what you have. Do what you can.",
  "Every champion was once a beginner.",
  "The hardest lift is getting off the couch.",
  "Keep showing up. The results are coming.",
] as const;

const LAST_QUOTE_KEY = "apg_portal_welcome_last_quote_v1";

function readLastWelcomeQuote(): string {
  try {
    return String(sessionStorage.getItem(LAST_QUOTE_KEY) || "");
  } catch {
    return "";
  }
}

export function rememberLastWelcomeQuote(quote: string) {
  try {
    sessionStorage.setItem(LAST_QUOTE_KEY, String(quote || ""));
  } catch {
    /* ignore */
  }
}

export function clearLastWelcomeQuote() {
  try {
    sessionStorage.removeItem(LAST_QUOTE_KEY);
  } catch {
    /* ignore */
  }
}

function secureRandomIndex(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0]! % maxExclusive;
    }
  } catch {
    /* fall through */
  }
  return Math.floor(Math.random() * maxExclusive);
}

/**
 * Pick one quote when the welcome popup opens.
 * Avoids immediately repeating the last quote shown this browser session.
 */
export function pickRandomWelcomeQuote(excludeQuote?: string): string {
  const list = [...PORTAL_WELCOME_QUOTES];
  if (!list.length) return "Keep showing up. The results are coming.";

  const exclude = String(excludeQuote || readLastWelcomeQuote() || "").trim();
  const pool = exclude ? list.filter((q) => q !== exclude) : list;
  const choices = pool.length ? pool : list;
  const index = secureRandomIndex(choices.length);
  return choices[index] ?? list[0]!;
}
