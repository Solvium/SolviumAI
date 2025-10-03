import fs from "fs";
import path from "path";
import { WORDS_BY_LENGTH, getAllowedForLength } from "./wordsByLength";
import {
  computeGuessColors,
  getUtcDailyId,
  pickDeterministic,
  normalizeWord,
  LetterColor,
} from "./utils";

const WORD_LEN = Number(process.env.WORDLE_WORD_LEN || 5);

function readWordList(file: string): string[] {
  try {
    const p = path.join(process.cwd(), "src", "lib", "wordle", "words", file);
    const raw = fs.readFileSync(p, "utf-8");
    return raw
      .split(/\r?\n/)
      .map((w) => w.trim().toUpperCase())
      .filter(Boolean)
      .filter((w) => w.length === WORD_LEN);
  } catch {
    return [];
  }
}

const solutions = readWordList("solutions.txt");
const allowed = new Set(readWordList("allowed.txt").concat(solutions));

export function getDailyId(): string {
  return getUtcDailyId();
}

function pickLengthForLevel(level: number, seedKey: string): number {
  let lens: number[] = [];
  if (level >= 1 && level <= 5) lens = [3, 4, 5];
  else if (level >= 6 && level <= 10) lens = [6, 7, 8];
  else lens = [9, 10];
  const cand = lens.filter((l) => (WORDS_BY_LENGTH[l] || []).length > 0);
  const chosen = pickDeterministic(cand.length ? cand : [5], seedKey) as number;
  return chosen;
}

export function getDailyAnswer(dailyId: string, level?: number): string {
  const secret = process.env.WORDLE_SECRET || "local-dev";
  const key = `${dailyId}:${level ?? 0}:${secret}`;
  if (solutions.length) {
    const answer = pickDeterministic(solutions, key);
    return normalizeWord(answer, WORD_LEN);
  }
  const length = pickLengthForLevel(level ?? 1, key);
  const pool = WORDS_BY_LENGTH[length] || ["REACT"];
  const answer = pickDeterministic(pool, key);
  return normalizeWord(answer, length);
}

export function isAllowedWord(word: string, len?: number): boolean {
  const n = normalizeWord(word, len ?? WORD_LEN);
  if (allowed.size) return allowed.has(n);
  return getAllowedForLength(n.length).has(n);
}

export function validateGuess(
  dailyId: string,
  guess: string,
  level?: number
): { valid: boolean; colors?: LetterColor[]; length?: number } {
  const answer = getDailyAnswer(dailyId, level);
  const g = normalizeWord(guess, answer.length);
  if (g.length !== answer.length)
    return { valid: false, length: answer.length };
  if (!isAllowedWord(g, answer.length))
    return { valid: false, length: answer.length };
  const colors = computeGuessColors(answer, g);
  return { valid: true, colors, length: answer.length };
}
