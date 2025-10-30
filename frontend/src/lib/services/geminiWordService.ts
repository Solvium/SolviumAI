/**
 * Gemini Word Service for Solvium Wordle
 *
 * This service fetches words from Google's Gemini AI API and stores them in the database.
 * It's designed to fetch words daily to avoid quota exhaustion and provide variety.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { configDotenv } from "dotenv";
configDotenv();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
console.log(process.env.GEMINI_API_KEY);

export interface WordData {
  word: string;
  meaning: string;
  examples: string[];
  synonyms: string[];
  difficulty: "easy" | "medium" | "hard";
  length: number;
}

export interface FetchWordsResponse {
  success: boolean;
  wordsCount: number;
  difficulty: string;
  error?: string;
}

/**
 * Fetch words from Gemini AI for a specific difficulty level
 */
export async function fetchWordsFromGemini(
  difficulty: "easy" | "medium" | "hard",
  count: number = 2000
): Promise<WordData[]> {
  try {
    // Define word length ranges based on difficulty
    const lengthRanges = {
      easy: "3-5 letters",
      medium: "6-8 letters",
      hard: "9-10 letters",
    };

    const prompt = `
Generate ${count} English words for a word guessing game with the following specifications:

Difficulty: ${difficulty}
Word Length: ${lengthRanges[difficulty]}
Format: Return a JSON array where each word object contains:
- word: the actual word (uppercase)
- meaning: a clear, simple definition
- examples: array of 2-3 example sentences using the word
- synonyms: array of 3-5 similar words
- difficulty: "${difficulty}"
- length: the number of letters

Requirements:
- Words should be common enough for general audience
- Avoid proper nouns, abbreviations, or very obscure words
- Ensure all words are valid English words
- Make sure examples are clear and educational
- Synonyms should be accurate and helpful

Return ONLY the JSON array, no additional text or formatting.
`;

    // Use Google Generative AI SDK
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      let words: WordData[];
      try {
        // Clean the response text (remove markdown formatting if present)
        const cleanText = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        words = JSON.parse(cleanText);
      } catch (parseError) {
        console.error("Failed to parse Gemini response:", parseError);
        console.error("Raw response:", text);
        throw new Error("Invalid JSON response from Gemini");
      }

      // Validate the response structure
      if (!Array.isArray(words)) {
        throw new Error("Response is not an array");
      }

      // Validate each word object
      const validatedWords: WordData[] = [];
      for (const word of words) {
        if (
          typeof word.word === "string" &&
          typeof word.meaning === "string" &&
          Array.isArray(word.examples) &&
          Array.isArray(word.synonyms) &&
          typeof word.difficulty === "string" &&
          typeof word.length === "number"
        ) {
          validatedWords.push({
            word: word.word.toUpperCase().trim(),
            meaning: word.meaning.trim(),
            examples: word.examples.map((ex: any) => String(ex).trim()),
            synonyms: word.synonyms.map((syn: any) => String(syn).trim()),
            difficulty: word.difficulty as "easy" | "medium" | "hard",
            length: word.length,
          });
        }
      }

      return validatedWords;
    } catch (sdkError) {
      console.error("Gemini SDK failed:", sdkError);
      throw new Error(`Gemini SDK failed: ${sdkError}`);
    }
  } catch (error) {
    console.error("Error fetching words from Gemini:", error);
    throw error;
  }
}

/**
 * Fallback function to generate hardcoded words when Gemini fails
 */
function getFallbackWords(
  difficulty: "easy" | "medium" | "hard",
  count: number
): WordData[] {
  const wordDatabase = {
    easy: [
      {
        word: "CAT",
        meaning: "a small domesticated carnivorous mammal",
        examples: ["The cat sat on the mat", "My cat loves to play"],
        synonyms: ["feline", "kitten", "kitty"],
        length: 3,
      },
      {
        word: "DOG",
        meaning: "a domesticated carnivorous mammal",
        examples: ["The dog barked loudly", "I walk my dog every day"],
        synonyms: ["canine", "puppy", "hound"],
        length: 3,
      },
      {
        word: "SUN",
        meaning: "the star around which the earth orbits",
        examples: ["The sun shines brightly", "I love sunny days"],
        synonyms: ["star", "solar", "daylight"],
        length: 3,
      },
      {
        word: "GAME",
        meaning: "a form of play or sport",
        examples: ["Let's play a game", "This game is fun"],
        synonyms: ["play", "sport", "match"],
        length: 4,
      },
      {
        word: "CODE",
        meaning: "a system of words, letters, or symbols",
        examples: ["Write the code carefully", "I love coding"],
        synonyms: ["cipher", "script", "program"],
        length: 4,
      },
      {
        word: "MIND",
        meaning: "the element of a person that enables them to think",
        examples: ["Use your mind to solve this", "Mind over matter"],
        synonyms: ["brain", "intellect", "thought"],
        length: 4,
      },
      {
        word: "REACT",
        meaning: "respond or behave in a particular way",
        examples: [
          "How did you react to the news?",
          "React quickly to changes",
        ],
        synonyms: ["respond", "behave", "respond"],
        length: 5,
      },
      {
        word: "LOGIC",
        meaning: "reasoning conducted according to strict principles",
        examples: ["Use logic to solve this puzzle", "That's logical thinking"],
        synonyms: ["reasoning", "rationality", "sense"],
        length: 5,
      },
    ],
    medium: [
      {
        word: "PUZZLE",
        meaning: "a game or toy designed to test ingenuity",
        examples: ["This puzzle is challenging", "I love doing puzzles"],
        synonyms: ["riddle", "mystery", "brainteaser"],
        length: 6,
      },
      {
        word: "TARGET",
        meaning: "a person or thing aimed at",
        examples: ["Hit the target accurately", "Set your target high"],
        synonyms: ["goal", "aim", "objective"],
        length: 6,
      },
      {
        word: "PLANET",
        meaning: "a celestial body moving in orbit",
        examples: ["Earth is a planet", "Mars is a red planet"],
        synonyms: ["world", "globe", "orb"],
        length: 6,
      },
      {
        word: "LIBRARY",
        meaning: "a building containing collections of books",
        examples: ["I went to the library", "The library has many books"],
        synonyms: ["archive", "collection", "repository"],
        length: 7,
      },
      {
        word: "PROJECT",
        meaning: "an individual or collaborative enterprise",
        examples: ["This is a big project", "Work on your project"],
        synonyms: ["task", "venture", "undertaking"],
        length: 7,
      },
      {
        word: "NETWORK",
        meaning: "a group of interconnected people or things",
        examples: ["Build your network", "The network is down"],
        synonyms: ["system", "web", "grid"],
        length: 7,
      },
      {
        word: "JOURNEY",
        meaning: "an act of traveling from one place to another",
        examples: ["The journey was long", "Life is a journey"],
        synonyms: ["trip", "voyage", "expedition"],
        length: 7,
      },
    ],
    hard: [
      {
        word: "ALGORITHM",
        meaning: "a process or set of rules to be followed",
        examples: ["This algorithm is efficient", "Learn the algorithm"],
        synonyms: ["procedure", "method", "formula"],
        length: 9,
      },
      {
        word: "DEVELOPER",
        meaning: "a person who develops software",
        examples: ["He is a software developer", "The developer fixed the bug"],
        synonyms: ["programmer", "engineer", "coder"],
        length: 9,
      },
      {
        word: "FRAMEWORK",
        meaning: "a basic structure underlying a system",
        examples: ["Use this framework", "The framework is solid"],
        synonyms: ["structure", "foundation", "skeleton"],
        length: 9,
      },
      {
        word: "INTERFACE",
        meaning: "a point where systems meet and interact",
        examples: ["The interface is user-friendly", "Design the interface"],
        synonyms: ["connection", "link", "boundary"],
        length: 9,
      },
      {
        word: "CHALLENGING",
        meaning: "testing one's abilities",
        examples: ["This task is challenging", "A challenging problem"],
        synonyms: ["difficult", "demanding", "tough"],
        length: 11,
      },
    ],
  };

  const words = wordDatabase[difficulty];
  const shuffled = words.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((word) => ({
    ...word,
    difficulty: difficulty,
  }));
}

/**
 * Store words in the database
 */
export async function storeWordsInDatabase(words: WordData[]): Promise<number> {
  try {
    let storedCount = 0;

    for (const wordData of words) {
      try {
        // Check if word already exists
        const existingWord = await prisma.word.findUnique({
          where: { word: wordData.word },
        });

        if (!existingWord) {
          await prisma.word.create({
            data: {
              word: wordData.word,
              length: wordData.length,
              difficulty: wordData.difficulty,
              meaning: wordData.meaning,
              examples: wordData.examples,
              synonyms: wordData.synonyms,
              isActive: true,
            },
          });
          storedCount++;
        }
      } catch (wordError) {
        console.error(`Error storing word ${wordData.word}:`, wordError);
        // Continue with other words even if one fails
      }
    }

    return storedCount;
  } catch (error) {
    console.error("Error storing words in database:", error);
    throw error;
  }
}

/**
 * Check if words were already fetched today for a specific difficulty
 */
export async function wasWordsFetchedToday(
  difficulty: string
): Promise<boolean> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const fetchLog = await prisma.wordFetchLog.findFirst({
      where: {
        difficulty,
        fetchDate: {
          gte: today,
          lt: tomorrow,
        },
        success: true,
      },
    });

    return !!fetchLog;
  } catch (error) {
    console.error("Error checking fetch log:", error);
    return false;
  }
}

/**
 * Log word fetching activity
 */
export async function logWordFetch(
  difficulty: string,
  wordsCount: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.wordFetchLog.create({
      data: {
        difficulty,
        wordsCount,
        success,
        errorMessage,
      },
    });
  } catch (error) {
    console.error("Error logging word fetch:", error);
  }
}

/**
 * Get available words for a user (excluding already used words)
 */
export async function getAvailableWordsForUser(
  userId: number,
  difficulty: "easy" | "medium" | "hard",
  length?: number,
  gameType: string = "wordle"
): Promise<WordData[]> {
  try {
    // Get words that the user hasn't used yet
    const usedWordIds = await prisma.wordUsage.findMany({
      where: {
        userId,
        gameType,
      },
      select: {
        wordId: true,
      },
    });

    const usedIds = usedWordIds.map((usage) => usage.wordId);

    // Build where clause
    const whereClause: any = {
      difficulty,
      isActive: true,
      id: {
        notIn: usedIds,
      },
    };

    if (length) {
      whereClause.length = length;
    }

    const words = await prisma.word.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "asc", // Use older words first
      },
    });

    return words.map((word) => ({
      word: word.word,
      meaning: word.meaning || "",
      examples: (word.examples as string[]) || [],
      synonyms: (word.synonyms as string[]) || [],
      difficulty: word.difficulty as "easy" | "medium" | "hard",
      length: word.length,
    }));
  } catch (error) {
    console.error("Error getting available words for user:", error);
    throw error;
  }
}

/**
 * Mark a word as used by a user
 */
export async function markWordAsUsed(
  userId: number,
  word: string,
  gameType: string = "wordle"
): Promise<void> {
  try {
    const wordRecord = await prisma.word.findUnique({
      where: { word },
    });

    if (wordRecord) {
      await prisma.wordUsage.upsert({
        where: {
          wordId_userId_gameType: {
            wordId: wordRecord.id,
            userId,
            gameType,
          },
        },
        update: {
          usedAt: new Date(),
        },
        create: {
          wordId: wordRecord.id,
          userId,
          gameType,
          usedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Error marking word as used:", error);
    throw error;
  }
}

/**
 * Daily word fetching process
 */
export async function performDailyWordFetch(): Promise<FetchWordsResponse[]> {
  const results: FetchWordsResponse[] = [];
  const difficulties: ("easy" | "medium" | "hard")[] = [
    "easy",
    "medium",
    "hard",
  ];
  const wordsPerDifficulty = 25; // Increased to prevent word exhaustion

  for (const difficulty of difficulties) {
    try {
      // Check if words were already fetched today
      const alreadyFetched = await wasWordsFetchedToday(difficulty);

      if (alreadyFetched) {
        console.log(`Words for ${difficulty} difficulty already fetched today`);
        results.push({
          success: true,
          wordsCount: 0,
          difficulty,
          error: "Already fetched today",
        });
        continue;
      }

      // Fetch words from Gemini
      console.log(
        `Fetching ${wordsPerDifficulty} words for ${difficulty} difficulty...`
      );
      const words = await fetchWordsFromGemini(difficulty, wordsPerDifficulty);

      // Store words in database
      const storedCount = await storeWordsInDatabase(words);

      // Log the fetch
      await logWordFetch(difficulty, storedCount, true);

      console.log(
        `Successfully stored ${storedCount} words for ${difficulty} difficulty`
      );

      results.push({
        success: true,
        wordsCount: storedCount,
        difficulty,
      });
    } catch (error) {
      console.error(`Error fetching words for ${difficulty}:`, error);

      // Log the failed fetch
      await logWordFetch(difficulty, 0, false, String(error));

      results.push({
        success: false,
        wordsCount: 0,
        difficulty,
        error: String(error),
      });
    }
  }

  return results;
}

/**
 * Get a random word for a user based on their level
 */
export async function getRandomWordForUser(
  userId: number,
  level: number,
  gameType: string = "wordle"
): Promise<WordData | null> {
  try {
    // Determine difficulty based on level
    const difficulty = level <= 5 ? "easy" : level <= 10 ? "medium" : "hard";

    // Get available words for the user
    let availableWords = await getAvailableWordsForUser(
      userId,
      difficulty,
      undefined,
      gameType
    );

    // If no words available for the requested difficulty, try fallback difficulties
    if (availableWords.length === 0) {
      console.warn(
        `No available words for user ${userId} at difficulty ${difficulty}, trying fallback...`
      );

      // Try easier difficulty first, then harder
      const fallbackDifficulties =
        difficulty === "easy"
          ? ["medium", "hard"]
          : difficulty === "medium"
          ? ["easy", "hard"]
          : ["medium", "easy"];

      for (const fallbackDifficulty of fallbackDifficulties) {
        availableWords = await getAvailableWordsForUser(
          userId,
          fallbackDifficulty as "easy" | "medium" | "hard",
          undefined,
          gameType
        );

        if (availableWords.length > 0) {
          console.log(
            `Using fallback difficulty ${fallbackDifficulty} for user ${userId}`
          );
          break;
        }
      }
    }

    // If still no words available, try to fetch more words
    if (availableWords.length === 0) {
      console.warn(
        `No words available for user ${userId} at any difficulty, attempting emergency word fetch...`
      );

      try {
        // Emergency fetch more words
        await performDailyWordFetch();

        // Try again with the original difficulty
        availableWords = await getAvailableWordsForUser(
          userId,
          difficulty,
          undefined,
          gameType
        );

        if (availableWords.length === 0) {
          console.error(
            `Still no words available after emergency fetch for user ${userId}`
          );
          return null;
        }
      } catch (fetchError) {
        console.error("Emergency word fetch failed:", fetchError);
        return null;
      }
    }

    // Select a random word
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    const selectedWord = availableWords[randomIndex];

    // Mark the word as used
    await markWordAsUsed(userId, selectedWord.word, gameType);

    return selectedWord;
  } catch (error) {
    console.error("Error getting random word for user:", error);
    throw error;
  }
}
