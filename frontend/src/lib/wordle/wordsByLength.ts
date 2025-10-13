// Minimal default English-like sets per length, UPPERCASE, 3–10 letters
export const WORDS_BY_LENGTH: Record<number, string[]> = {
  3: ["CAT", "DOG", "SUN", "MAP", "FOX", "CAR"],
  4: ["GAME", "CODE", "MIND", "WORD", "PLAY", "NODE"],
  5: ["REACT", "LOGIC", "BRAIN", "CODES", "SMART", "LEARN"],
  6: ["PUZZLE", "TOKEN", "NEARLY", "TARGET", "PLANET"],
  7: ["LIBRARY", "PROJECT", "COMPASS", "NETWORK"],
  8: ["LANGUAGE", "SOFTWARE", "PLAYABLE", "ALGORITHM".slice(0, 8)],
  9: ["ALGORITHM", "KNOWLEDGE", "INTERFACE"],
  10: ["DEVELOPER", "FRAMEWORK", "PROCESSOR"],
};

export function getAllowedForLength(len: number): Set<string> {
  const base = WORDS_BY_LENGTH[len] || [];
  return new Set(base);
}
