/**
 * Gemini Word Fetcher for Solvium Wordle
 *
 * This module provides functionality to fetch words from the database
 * that were previously fetched from Gemini AI. It handles word rotation
 * and ensures users don't get repeated words.
 */

// fs and path removed - using API endpoint for validation instead
import dictionary from "../dictionary.json";

export interface WordInfo {
  word: string;
  meanings: Array<{
    partOfSpeech: string;
    definition: string;
    examples: string[];
  }>;
  synonyms: string[];
  isValid: boolean;
}

export interface WordData {
  word: string;
  length: number;
  difficulty: "easy" | "medium" | "hard";
  meaning?: string;
  examples?: string[];
  synonyms?: string[];
}

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get word length based on level
 */
export function getWordLengthForLevel(level: number): number {
  if (level <= 5) {
    // Easy: 3-5 letters
    return Math.floor(Math.random() * 3) + 3;
  } else if (level <= 10) {
    // Medium: 6-8 letters
    return Math.floor(Math.random() * 3) + 6;
  } else {
    // Hard: 9-10 letters
    return Math.floor(Math.random() * 2) + 9;
  }
}

/**
 * Get difficulty based on level
 */
export function getDifficultyForLevel(
  level: number
): "easy" | "medium" | "hard" {
  if (level <= 5) return "easy";
  if (level <= 10) return "medium";
  return "hard";
}

/**
 * Fetch a word from the API with caching
 */
async function fetchFromAPI(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  // Don't cache word selection requests to ensure fresh words
  if (url.includes("/api/words/get-word")) {
    // Skip caching for word selection
  } else {
    const cacheKey = `${url}-${JSON.stringify(options)}`;
    const cached = apiCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Cache the response (except for word selection)
    if (!url.includes("/api/words/get-word")) {
      const cacheKey = `${url}-${JSON.stringify(options)}`;
      apiCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  } catch (error) {
    console.error("API fetch error:", error);
    throw error;
  }
}

/**
 * Get a word for the Wordle game from the database
 */
export async function getDailyWord(
  dailyId: string,
  level: number,
  userId?: number
): Promise<string | null> {
  try {
    console.log(
      `🎯 Getting daily word for user ${userId}, level ${level}, dailyId: ${dailyId}`
    );

    // If we have a userId, use the new Gemini-based system
    if (userId) {
      const response = await fetchFromAPI("/api/words/get-word", {
        method: "POST",
        body: JSON.stringify({
          userId,
          level,
          gameType: "wordle",
        }),
      });

      if (response.success) {
        console.log(
          `✅ Got word from database: "${response.word}" (${response.length} letters, ${response.difficulty})`
        );
        return response.word;
      } else {
        console.error("Failed to get word from database:", response.message);
        throw new Error(`Database word fetch failed: ${response.message}`);
      }
    }

    // No userId provided - this should not happen in production
    throw new Error("No userId provided - cannot fetch word from database");
  } catch (error) {
    console.error("Error getting daily word:", error);
    throw error;
  }
}

// Cache for dictionary words
let dictionaryWords: Set<string> | null = null;

/**
 * Load dictionary from the imported JSON file
 */
function loadDictionary(): Set<string> {
  if (dictionaryWords) return dictionaryWords;

  try {
    console.log("📚 Loading dictionary for frontend validation...");
    console.log(
      "📚 Dictionary JSON loaded:",
      Object.keys(dictionary).length,
      "prefixes"
    );

    // Flatten all word arrays from the prefix-based structure
    const allWords = Object.values(
      dictionary as Record<string, string[]>
    ).flat();
    console.log("📚 Total words after flattening:", allWords.length);

    dictionaryWords = new Set(allWords.map((w) => w.toUpperCase()));
    console.log(
      `📚 Dictionary Set created: ${dictionaryWords.size} unique words`
    );

    return dictionaryWords;
  } catch (error) {
    console.error("Failed to load dictionary:", error);
    // Fallback to basic validation if dictionary fails to load
    dictionaryWords = new Set();
    return dictionaryWords;
  }
}

/**
 * Frontend validation - check against actual dictionary
 */
export async function validateWordFrontend(word: string): Promise<boolean> {
  const upperWord = word.toUpperCase();

  // Basic validation rules first
  if (!upperWord || upperWord.length < 3 || upperWord.length > 10) {
    return false;
  }

  // Only allow letters
  if (!/^[A-Z]+$/.test(upperWord)) {
    return false;
  }

  // Load dictionary and check if word exists
  const words = loadDictionary();
  const exists = words.has(upperWord);

  console.log(
    `🔍 Frontend validation: "${upperWord}" ${
      exists ? "EXISTS" : "NOT FOUND"
    } in dictionary`
  );
  return exists;
}

/**
 * Backend validation using API endpoint
 */
export async function validateWordBackend(word: string): Promise<boolean> {
  try {
    console.log(`🔍 Backend validating word: "${word}"`);
    const response = await fetchFromAPI(
      `/api/words/check?word=${encodeURIComponent(word)}`
    );
    const isValid = !!response.success;
    console.log(
      `✅ Backend validation result: "${word}" is ${
        isValid ? "VALID" : "INVALID"
      }`
    );
    return isValid;
  } catch (error) {
    console.error("Error validating word:", error);
    throw new Error(`Word validation failed: ${error}`);
  }
}

/**
 * Full validation: frontend dictionary check first, then backend
 */
export async function validateWord(word: string): Promise<boolean> {
  // Backend validation only - frontend validation should be done separately
  return await validateWordBackend(word);
}

/**
 * Get word meaning from the database
 */
export async function getWordInfo(word: string): Promise<WordInfo | null> {
  try {
    const response = await fetchFromAPI(
      `/api/words/meaning?word=${encodeURIComponent(word)}`
    );

    if (response.success) {
      return {
        word: response.word,
        meanings: [
          {
            partOfSpeech: "noun", // Default, could be enhanced
            definition: response.meaning || "No definition available",
            examples: response.examples || [],
          },
        ],
        synonyms: response.synonyms || [],
        isValid: true,
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting word info:", error);
    return null;
  }
}

/**
 * Get hardcoded word as fallback
 */
function getHardcodedWord(level: number): string {
  const difficulty = getDifficultyForLevel(level);
  const words = getHardcodedWords({ difficulty, count: 1 });
  return words[0] || "PUZZLE";
}

/**
 * Get hardcoded words for fallback
 */
export function getHardcodedWords(options: {
  length?: number;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
}): string[] {
  const { length, difficulty, count = 1 } = options;

  const allWords = {
    easy: [
      "CAT",
      "DOG",
      "SUN",
      "MAP",
      "FOX",
      "GAME",
      "CODE",
      "MIND",
      "WORD",
      "PLAY",
      "REACT",
      "LOGIC",
      "BRAIN",
      "SMART",
      "LEARN",
      "HOUSE",
      "WATER",
      "WORLD",
      "HAPPY",
      "MUSIC",
    ],
    medium: [
      "PUZZLE",
      "TARGET",
      "PLANET",
      "GARDEN",
      "FOREST",
      "LIBRARY",
      "PROJECT",
      "NETWORK",
      "JOURNEY",
      "MYSTERY",
      "CHALLENGE",
      "BEAUTIFUL",
      "IMPORTANT",
      "DIFFERENT",
      "EVERYTHING",
      "SOMETHING",
      "UNDERSTAND",
      "KNOWLEDGE",
    ],
    hard: [
      "ALGORITHM",
      "DEVELOPER",
      "FRAMEWORK",
      "INTERFACE",
      "CHALLENGING",
      "IMPORTANCE",
      "UNDERSTAND",
      "KNOWLEDGE",
      "BEAUTIFUL",
      "CREATIVE",
      "ADVENTURE",
      "MOUNTAIN",
      "SOFTWARE",
      "LANGUAGE",
      "MYSTERY",
      "JOURNEY",
    ],
  };

  let words: string[] = [];

  if (difficulty) {
    words = allWords[difficulty];
  } else {
    words = [...allWords.easy, ...allWords.medium, ...allWords.hard];
  }

  // Filter by length if specified
  if (length) {
    words = words.filter((word) => word.length === length);
  }

  // Shuffle and return requested count
  const shuffled = words.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get random word from dictionary (legacy function for compatibility)
 */
export async function getRandomWordFromDictionary(
  length: number,
  difficulty: "easy" | "medium" | "hard"
): Promise<string | null> {
  try {
    // Try to get from hardcoded words first
    const words = getHardcodedWords({ length, difficulty, count: 10 });
    if (words.length > 0) {
      const randomIndex = Math.floor(Math.random() * words.length);
      return words[randomIndex];
    }

    return null;
  } catch (error) {
    console.warn("Failed to get random word from dictionary:", error);
    return getHardcodedWords({ length, difficulty, count: 1 })[0] || null;
  }
}

/**
 * Fetch random words (legacy function for compatibility)
 */
export async function fetchRandomWords(options: {
  length?: number;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
}): Promise<string[]> {
  const { length, difficulty, count = 1 } = options;
  return getHardcodedWords({ length, difficulty, count });
}

/**
 * Get word statistics
 */
export async function getWordStats(): Promise<{
  totalWords: number;
  wordsByDifficulty: Record<string, number>;
  wordsByLength: Record<number, number>;
}> {
  try {
    // This would ideally fetch from the database
    // For now, return hardcoded stats
    return {
      totalWords: 50,
      wordsByDifficulty: {
        easy: 20,
        medium: 20,
        hard: 10,
      },
      wordsByLength: {
        3: 5,
        4: 5,
        5: 10,
        6: 10,
        7: 10,
        8: 5,
        9: 3,
        10: 2,
      },
    };
  } catch (error) {
    console.error("Error getting word stats:", error);
    return {
      totalWords: 0,
      wordsByDifficulty: {},
      wordsByLength: {},
    };
  }
}
