export type LetterColor = "exact" | "present" | "absent";

export function getUtcDailyId(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function simpleHash(input: string): number {
  // Non-crypto hash sufficient for deterministic seeding
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

export function seededRandom(seed: number) {
  // Mulberry32 PRNG
  let t = seed + 0x6d2b79f5;
  return function rand() {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickDeterministic<T>(items: T[], seedStr: string): T {
  const rand = seededRandom(simpleHash(seedStr));
  const idx = Math.floor(rand() * items.length);
  return items[idx];
}

export function normalizeWord(word: string, len: number): string {
  return word.trim().toUpperCase().slice(0, len);
}

export function computeGuessColors(
  answer: string,
  guess: string
): LetterColor[] {
  const res: LetterColor[] = Array(guess.length).fill("absent");
  const a = answer.split("");
  const g = guess.split("");

  // Frequency of letters in answer
  const freq: Record<string, number> = {};
  for (let i = 0; i < a.length; i++) {
    const ch = a[i];
    freq[ch] = (freq[ch] ?? 0) + 1;
  }

  // First pass: exact matches
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      res[i] = "exact";
      freq[g[i]] -= 1;
    }
  }

  // Second pass: present matches (respect remaining frequency)
  for (let i = 0; i < g.length; i++) {
    if (res[i] === "exact") continue;
    const ch = g[i];
    if ((freq[ch] ?? 0) > 0) {
      res[i] = "present";
      freq[ch] -= 1;
    }
  }

  return res;
}
