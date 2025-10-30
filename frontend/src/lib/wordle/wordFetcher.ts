/**
 * Word Fetcher Package for Solvium Wordle
 *
 * This package provides functionality to fetch random words from various sources
 * for the Wordle game, supporting different difficulty levels and word lengths.
 * Now integrated with en-dictionary for word validation and meanings.
 */

import {
  getRandomWord,
  isValidWord,
  getWordMeaning,
  WordInfo,
} from "./dictionaryService";

export interface WordSource {
  name: string;
  url: string;
  format: "json" | "text" | "csv";
  description: string;
}

export interface WordList {
  words: string[];
  source: string;
  length: number;
  difficulty: "easy" | "medium" | "hard";
  lastUpdated: Date;
}

export interface WordFetchOptions {
  length?: number;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
  source?: string;
}

// Predefined word sources
export const WORD_SOURCES: Record<string, WordSource> = {
  "api-ninjas": {
    name: "API Ninjas Words",
    url: "https://api.api-ninjas.com/v1/randomword",
    format: "json",
    description: "Random words from API Ninjas",
  },
  wordnik: {
    name: "Wordnik API",
    url: "https://api.wordnik.com/v4/words.json/randomWords",
    format: "json",
    description: "Random words from Wordnik dictionary",
  },
  "local-fallback": {
    name: "Local Fallback",
    url: "/api/wordle/words",
    format: "json",
    description: "Local word lists as fallback",
  },
};

// Cache for fetched words
const wordCache = new Map<string, WordList>();

/**
 * Fetch random words from external API
 */
export async function fetchRandomWords(
  options: WordFetchOptions = {}
): Promise<string[]> {
  const {
    length = 5,
    difficulty = "medium",
    count = 1,
    source = "api-ninjas",
  } = options;

  const cacheKey = `${source}-${length}-${difficulty}-${count}`;

  // Check cache first
  if (wordCache.has(cacheKey)) {
    const cached = wordCache.get(cacheKey)!;
    const now = new Date();
    const cacheAge = now.getTime() - cached.lastUpdated.getTime();

    // Cache valid for 1 hour
    if (cacheAge < 60 * 60 * 1000) {
      return cached.words.slice(0, count);
    }
  }

  try {
    const words = await fetchFromSource(source, { length, difficulty, count });

    // Cache the result
    wordCache.set(cacheKey, {
      words,
      source,
      length,
      difficulty,
      lastUpdated: new Date(),
    });

    return words;
  } catch (error) {
    console.warn(`Failed to fetch from ${source}, using fallback:`, error);
    return getHardcodedWords({ length, difficulty, count });
  }
}

/**
 * Fetch words from specific source
 */
async function fetchFromSource(
  source: string,
  options: WordFetchOptions
): Promise<string[]> {
  const sourceConfig = WORD_SOURCES[source];
  if (!sourceConfig) {
    throw new Error(`Unknown word source: ${source}`);
  }

  switch (source) {
    case "api-ninjas":
      return fetchFromApiNinjas(options);
    case "wordnik":
      return fetchFromWordnik(options);
    case "local-fallback":
      return fetchFromLocal(options);
    default:
      throw new Error(`Unsupported source: ${source}`);
  }
}

/**
 * Fetch from API Ninjas
 */
async function fetchFromApiNinjas(
  options: WordFetchOptions
): Promise<string[]> {
  const { count = 1 } = options;
  const words: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const response = await fetch("https://api.api-ninjas.com/v1/randomword", {
        headers: {
          "X-Api-Key": process.env.NEXT_PUBLIC_API_NINJAS_KEY || "",
        },
      });

      if (!response.ok) {
        throw new Error(`API Ninjas error: ${response.status}`);
      }

      const data = await response.json();
      if (data.word) {
        words.push(data.word.toUpperCase());
      }
    } catch (error) {
      console.warn("API Ninjas fetch failed:", error);
      break;
    }
  }

  return words;
}

/**
 * Fetch from Wordnik API
 */
async function fetchFromWordnik(options: WordFetchOptions): Promise<string[]> {
  const { length = 5, count = 1 } = options;

  try {
    const response = await fetch(
      `https://api.wordnik.com/v4/words.json/randomWords?minLength=${length}&maxLength=${length}&limit=${count}&api_key=${
        process.env.NEXT_PUBLIC_WORDNIK_KEY || ""
      }`
    );

    if (!response.ok) {
      throw new Error(`Wordnik error: ${response.status}`);
    }

    const data = await response.json();
    return data.map((item: any) => item.word.toUpperCase());
  } catch (error) {
    console.warn("Wordnik fetch failed:", error);
    return [];
  }
}

/**
 * Fetch from local fallback
 */
async function fetchFromLocal(options: WordFetchOptions): Promise<string[]> {
  const { length = 5, difficulty = "medium", count = 1 } = options;

  try {
    const response = await fetch("/api/wordle/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ length, difficulty, count }),
    });

    if (!response.ok) {
      throw new Error(`Local API error: ${response.status}`);
    }

    const data = await response.json();
    return data.words || [];
  } catch (error) {
    console.warn("Local fetch failed:", error);
    return getHardcodedWords({ length, difficulty, count });
  }
}

/**
 * Get hardcoded fallback words
 */
function getHardcodedWords(options: WordFetchOptions): string[] {
  const { length = 5, difficulty = "medium", count = 1 } = options;

  const wordLists = {
    3: ["CAT", "DOG", "SUN", "MAP", "FOX", "CAR", "BAT", "BED", "BIG", "BOX"],
    4: [
      "GAME",
      "CODE",
      "MIND",
      "WORD",
      "PLAY",
      "NODE",
      "BIRD",
      "FISH",
      "TREE",
      "MOON",
    ],
    5: [
      "REACT",
      "LOGIC",
      "BRAIN",
      "CODES",
      "SMART",
      "LEARN",
      "WORLD",
      "EARTH",
      "OCEAN",
      "RIVER",
    ],
    6: [
      "PUZZLE",
      "TOKEN",
      "NEARLY",
      "TARGET",
      "PLANET",
      "GARDEN",
      "FOREST",
      "CASTLE",
      "BRIDGE",
      "TEMPLE",
    ],
    7: [
      "LIBRARY",
      "PROJECT",
      "COMPASS",
      "NETWORK",
      "JOURNEY",
      "MYSTERY",
      "FREEDOM",
      "VICTORY",
      "COURAGE",
      "WISDOM",
    ],
    8: [
      "LANGUAGE",
      "SOFTWARE",
      "PLAYABLE",
      "ALGORITHM",
      "MOUNTAIN",
      "ADVENTURE",
      "DISCOVER",
      "CREATIVE",
      "BEAUTIFUL",
      "WONDERFUL",
    ],
    9: [
      "ALGORITHM",
      "KNOWLEDGE",
      "INTERFACE",
      "CHALLENGE",
      "ADVENTURE",
      "BEAUTIFUL",
      "WONDERFUL",
      "IMPORTANT",
      "NECESSARY",
      "DIFFERENT",
    ],
    10: [
      "DEVELOPER",
      "FRAMEWORK",
      "PROCESSOR",
      "UNDERSTAND",
      "IMPORTANCE",
      "BEAUTIFULLY",
      "WONDERFULLY",
      "DIFFERENTLY",
      "NECESSARILY",
      "CHALLENGING",
    ],
  };

  const words = wordLists[length as keyof typeof wordLists] || wordLists[5];
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, count);
}

/**
 * Get daily word for specific date and level using dictionary service
 */
export async function getDailyWord(
  dailyId: string,
  level: number
): Promise<string> {
  const difficulty = level <= 5 ? "easy" : level <= 10 ? "medium" : "hard";
  const length = getWordLengthForLevel(level);

  // Try to get from cache first
  const cacheKey = `daily-${dailyId}-${level}`;
  if (wordCache.has(cacheKey)) {
    const cached = wordCache.get(cacheKey)!;
    return cached.words[0];
  }

  // Use dictionary service to get a random word of the specified length
  let word = await getRandomWordFromDictionary(length, difficulty);

  // Fallback to hardcoded words if dictionary service fails
  if (!word) {
    word = getHardcodedWords({ length, difficulty, count: 1 })[0];
  }

  // Cache the daily word
  wordCache.set(cacheKey, {
    words: [word],
    source: "dictionary",
    length,
    difficulty,
    lastUpdated: new Date(),
  });

  return word;
}

/**
 * Validate word using dictionary service
 */
export async function validateWord(word: string): Promise<boolean> {
  try {
    return await isValidWord(word);
  } catch (error) {
    console.warn("Dictionary validation failed, using fallback:", error);
    // Fallback to hardcoded word list
    const hardcodedWords = Object.values(
      getHardcodedWords({ count: 1000 })
    ).flat();
    return hardcodedWords.includes(word.toUpperCase());
  }
}

/**
 * Get random word from dictionary service based on length and difficulty
 */
export async function getRandomWordFromDictionary(
  length: number,
  difficulty: "easy" | "medium" | "hard"
): Promise<string | null> {
  try {
    const { getWordsStartingWith, getWordsEndingWith, getWordsContaining } =
      await import("./dictionaryService");

    // Get words based on difficulty patterns
    let words: string[] = [];

    if (difficulty === "easy") {
      // Easy words: common prefixes and suffixes
      const prefixes = ["un", "re", "pre", "dis", "mis"];
      const suffixes = ["ing", "ed", "er", "ly", "tion"];

      for (const prefix of prefixes) {
        const prefixWords = await getWordsStartingWith(prefix);
        words.push(...prefixWords.filter((w) => w.length === length));
      }

      for (const suffix of suffixes) {
        const suffixWords = await getWordsEndingWith(suffix);
        words.push(...suffixWords.filter((w) => w.length === length));
      }
    } else if (difficulty === "medium") {
      // Medium words: common letter combinations
      const patterns = ["th", "er", "an", "in", "on", "at", "or", "ar"];

      for (const pattern of patterns) {
        const patternWords = await getWordsContaining(pattern);
        words.push(...patternWords.filter((w) => w.length === length));
      }
    } else {
      // Hard words: less common patterns
      const patterns = ["qu", "x", "z", "j", "k"];

      for (const pattern of patterns) {
        const patternWords = await getWordsContaining(pattern);
        words.push(...patternWords.filter((w) => w.length === length));
      }
    }

    // Remove duplicates and filter by length
    const uniqueWords = [...new Set(words)].filter((w) => w.length === length);

    if (uniqueWords.length === 0) {
      // Fallback to hardcoded words
      return getHardcodedWords({ length, difficulty, count: 1 })[0];
    }

    // Return random word
    const randomIndex = Math.floor(Math.random() * uniqueWords.length);
    return uniqueWords[randomIndex];
  } catch (error) {
    console.warn("Failed to get random word from dictionary:", error);
    return getHardcodedWords({ length, difficulty, count: 1 })[0];
  }
}

/**
 * Get word meaning and information
 */
export async function getWordInfo(word: string): Promise<WordInfo | null> {
  try {
    return await getWordMeaning(word);
  } catch (error) {
    console.warn("Failed to get word meaning:", error);
    return null;
  }
}

/**
 * Get word length based on level
 */
function getWordLengthForLevel(level: number): number {
  if (level >= 1 && level <= 5) {
    const lengths = [3, 4, 5];
    return lengths[Math.floor(Math.random() * lengths.length)];
  } else if (level >= 6 && level <= 10) {
    const lengths = [6, 7, 8];
    return lengths[Math.floor(Math.random() * lengths.length)];
  } else {
    const lengths = [9, 10];
    return lengths[Math.floor(Math.random() * lengths.length)];
  }
}

/**
 * Clear word cache
 */
export function clearWordCache(): void {
  wordCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: wordCache.size,
    keys: Array.from(wordCache.keys()),
  };
}
