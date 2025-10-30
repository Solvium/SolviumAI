/**
 * Dictionary Service for Solvium Wordle
 *
 * This service provides word validation and meaning lookup.
 * Note: en-dictionary is not compatible with browser environment, so we use a simplified approach.
 */

// Browser-compatible word validation and meaning service

// Comprehensive word database for browser use
const WORD_DATABASE = {
  // Common English words with meanings
  words: {
    // 3-letter words
    cat: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a small domesticated carnivorous mammal",
          examples: ["The cat sat on the mat"],
        },
      ],
      synonyms: ["feline", "kitten"],
    },
    dog: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a domesticated carnivorous mammal",
          examples: ["The dog barked loudly"],
        },
      ],
      synonyms: ["canine", "puppy"],
    },
    sun: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "the star around which the earth orbits",
          examples: ["The sun shines brightly"],
        },
      ],
      synonyms: ["star", "solar"],
    },
    map: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a diagrammatic representation of an area",
          examples: ["I need a map to navigate"],
        },
      ],
      synonyms: ["chart", "plan"],
    },
    fox: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a carnivorous mammal with a pointed muzzle",
          examples: ["The fox ran through the forest"],
        },
      ],
      synonyms: ["vixen", "reynard"],
    },

    // 4-letter words
    game: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a form of play or sport",
          examples: ["Let's play a game"],
        },
      ],
      synonyms: ["play", "sport"],
    },
    code: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a system of words, letters, or symbols",
          examples: ["Write the code carefully"],
        },
      ],
      synonyms: ["cipher", "script"],
    },
    mind: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "the element of a person that enables them to think",
          examples: ["Use your mind to solve this"],
        },
      ],
      synonyms: ["brain", "intellect"],
    },
    word: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a single distinct meaningful element of speech",
          examples: ["What does this word mean?"],
        },
      ],
      synonyms: ["term", "expression"],
    },
    play: {
      meanings: [
        {
          partOfSpeech: "verb",
          definition: "engage in activity for enjoyment",
          examples: ["Children love to play"],
        },
      ],
      synonyms: ["game", "sport"],
    },

    // 5-letter words
    react: {
      meanings: [
        {
          partOfSpeech: "verb",
          definition: "respond or behave in a particular way",
          examples: ["How did you react to the news?"],
        },
      ],
      synonyms: ["respond", "behave"],
    },
    logic: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "reasoning conducted according to strict principles",
          examples: ["Use logic to solve this puzzle"],
        },
      ],
      synonyms: ["reasoning", "rationality"],
    },
    brain: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "an organ of soft nervous tissue",
          examples: ["The brain controls the body"],
        },
      ],
      synonyms: ["mind", "intellect"],
    },
    smart: {
      meanings: [
        {
          partOfSpeech: "adjective",
          definition: "having or showing quick intelligence",
          examples: ["She is very smart"],
        },
      ],
      synonyms: ["intelligent", "clever"],
    },
    learn: {
      meanings: [
        {
          partOfSpeech: "verb",
          definition: "gain knowledge or skills",
          examples: ["I want to learn programming"],
        },
      ],
      synonyms: ["study", "acquire"],
    },

    // 6-letter words
    puzzle: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a game or toy designed to test ingenuity",
          examples: ["This puzzle is challenging"],
        },
      ],
      synonyms: ["riddle", "mystery"],
    },
    target: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a person or thing aimed at",
          examples: ["Hit the target accurately"],
        },
      ],
      synonyms: ["goal", "aim"],
    },
    planet: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a celestial body moving in orbit",
          examples: ["Earth is a planet"],
        },
      ],
      synonyms: ["world", "globe"],
    },
    garden: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a piece of ground for growing plants",
          examples: ["The garden is beautiful"],
        },
      ],
      synonyms: ["yard", "plot"],
    },
    forest: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a large area covered chiefly with trees",
          examples: ["The forest is dense"],
        },
      ],
      synonyms: ["woods", "jungle"],
    },

    // 7-letter words
    library: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a building containing collections of books",
          examples: ["I went to the library"],
        },
      ],
      synonyms: ["archive", "collection"],
    },
    project: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "an individual or collaborative enterprise",
          examples: ["This is a big project"],
        },
      ],
      synonyms: ["task", "venture"],
    },
    network: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a group of interconnected people or things",
          examples: ["Build your network"],
        },
      ],
      synonyms: ["system", "web"],
    },
    journey: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "an act of traveling from one place to another",
          examples: ["The journey was long"],
        },
      ],
      synonyms: ["trip", "voyage"],
    },
    mystery: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "something that is difficult to understand",
          examples: ["This is a mystery"],
        },
      ],
      synonyms: ["puzzle", "enigma"],
    },

    // 8-letter words
    language: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "the method of human communication",
          examples: ["English is a language"],
        },
      ],
      synonyms: ["tongue", "speech"],
    },
    software: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "programs and other operating information",
          examples: ["Install the software"],
        },
      ],
      synonyms: ["programs", "applications"],
    },
    mountain: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a large natural elevation of the earth's surface",
          examples: ["The mountain is high"],
        },
      ],
      synonyms: ["peak", "summit"],
    },
    adventure: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "an unusual and exciting experience",
          examples: ["Life is an adventure"],
        },
      ],
      synonyms: ["expedition", "quest"],
    },
    creative: {
      meanings: [
        {
          partOfSpeech: "adjective",
          definition: "relating to or involving imagination",
          examples: ["She is very creative"],
        },
      ],
      synonyms: ["artistic", "imaginative"],
    },

    // 9-letter words
    algorithm: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a process or set of rules to be followed",
          examples: ["This algorithm is efficient"],
        },
      ],
      synonyms: ["procedure", "method"],
    },
    knowledge: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "facts, information, and skills acquired",
          examples: ["Knowledge is power"],
        },
      ],
      synonyms: ["wisdom", "understanding"],
    },
    interface: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a point where systems meet and interact",
          examples: ["The interface is user-friendly"],
        },
      ],
      synonyms: ["connection", "link"],
    },
    challenge: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a task or situation that tests abilities",
          examples: ["This is a challenge"],
        },
      ],
      synonyms: ["test", "difficulty"],
    },
    beautiful: {
      meanings: [
        {
          partOfSpeech: "adjective",
          definition: "pleasing the senses or mind aesthetically",
          examples: ["The sunset is beautiful"],
        },
      ],
      synonyms: ["lovely", "gorgeous"],
    },

    // 10-letter words
    developer: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a person who develops software",
          examples: ["He is a software developer"],
        },
      ],
      synonyms: ["programmer", "engineer"],
    },
    framework: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "a basic structure underlying a system",
          examples: ["Use this framework"],
        },
      ],
      synonyms: ["structure", "foundation"],
    },
    understand: {
      meanings: [
        {
          partOfSpeech: "verb",
          definition: "perceive the intended meaning of",
          examples: ["I understand the concept"],
        },
      ],
      synonyms: ["comprehend", "grasp"],
    },
    importance: {
      meanings: [
        {
          partOfSpeech: "noun",
          definition: "the state of being important",
          examples: ["The importance is clear"],
        },
      ],
      synonyms: ["significance", "value"],
    },
    challenging: {
      meanings: [
        {
          partOfSpeech: "adjective",
          definition: "testing one's abilities",
          examples: ["This task is challenging"],
        },
      ],
      synonyms: ["difficult", "demanding"],
    },
  },
};

/**
 * Browser-compatible dictionary service
 */
export class BrowserDictionary {
  private words: Map<string, any> = new Map();

  constructor() {
    // Initialize word database
    Object.entries(WORD_DATABASE.words).forEach(([word, data]) => {
      this.words.set(word.toLowerCase(), data);
    });
  }

  async wordsStartingWith(prefix: string): Promise<string[]> {
    const results: string[] = [];
    for (const [word] of this.words) {
      if (word.startsWith(prefix.toLowerCase())) {
        results.push(word.toUpperCase());
      }
    }
    return results;
  }

  async wordsEndingWith(suffix: string): Promise<string[]> {
    const results: string[] = [];
    for (const [word] of this.words) {
      if (word.endsWith(suffix.toLowerCase())) {
        results.push(word.toUpperCase());
      }
    }
    return results;
  }

  async wordsIncluding(substring: string): Promise<string[]> {
    const results: string[] = [];
    for (const [word] of this.words) {
      if (word.includes(substring.toLowerCase())) {
        results.push(word.toUpperCase());
      }
    }
    return results;
  }

  async wordsWithCharsIn(characters: string): Promise<Map<string, any>> {
    const results = new Map();
    const charSet = new Set(characters.toLowerCase());

    for (const [word, data] of this.words) {
      const wordChars = new Set(word.toLowerCase());
      if (Array.from(wordChars).every((char) => charSet.has(char))) {
        results.set(word.toUpperCase(), data);
      }
    }
    return results;
  }

  async searchFor(words: string[]): Promise<Map<string, any>> {
    const results = new Map();
    for (const word of words) {
      const data = this.words.get(word.toLowerCase());
      if (data) {
        results.set(word.toLowerCase(), new Map([["noun", data]]));
      }
    }
    return results;
  }

  async searchSimpleFor(words: string[]): Promise<Map<string, any>> {
    const results = new Map();
    for (const word of words) {
      const data = this.words.get(word.toLowerCase());
      if (data) {
        results.set(word.toLowerCase(), new Map([["noun", data]]));
      }
    }
    return results;
  }
}

// Global browser dictionary instance
let browserDictionary: BrowserDictionary | null = null;

/**
 * Initialize the browser dictionary service
 */
export async function initializeDictionary(): Promise<BrowserDictionary> {
  if (browserDictionary) {
    return browserDictionary;
  }

  try {
    console.log("Initializing browser dictionary service...");
    browserDictionary = new BrowserDictionary();
    console.log("Browser dictionary service initialized successfully");
    return browserDictionary;
  } catch (error) {
    console.error("Failed to initialize browser dictionary service:", error);
    throw new Error("Dictionary initialization failed");
  }
}

/**
 * Get the dictionary instance (initialize if needed)
 */
export async function getDictionary(): Promise<BrowserDictionary> {
  if (!browserDictionary) {
    return await initializeDictionary();
  }
  return browserDictionary;
}

/**
 * Check if a word exists in the dictionary
 */
export async function isValidWord(word: string): Promise<boolean> {
  try {
    const dictionary = await getDictionary();
    const result = await dictionary.searchFor([word.toLowerCase()]);
    return result.has(word.toLowerCase());
  } catch (error) {
    console.error("Error checking word validity:", error);
    return false;
  }
}

/**
 * Get word meaning and information
 */
export async function getWordMeaning(word: string): Promise<WordInfo | null> {
  try {
    const dictionary = await getDictionary();
    const result = await dictionary.searchSimpleFor([word.toLowerCase()]);

    if (!result.has(word.toLowerCase())) {
      return null;
    }

    const wordData = result.get(word.toLowerCase());
    if (!wordData) return null;

    const meanings: WordMeaning[] = [];
    const synonyms: string[] = [];

    // Extract meanings from different parts of speech
    for (const [pos, data] of wordData) {
      if (data && typeof data === "object" && "meanings" in data) {
        // Handle our browser dictionary format
        if (data.meanings && Array.isArray(data.meanings)) {
          meanings.push(...data.meanings);
        }

        // Extract synonyms
        if (data.synonyms && Array.isArray(data.synonyms)) {
          synonyms.push(...data.synonyms);
        }
      }
    }

    return {
      word: word.toLowerCase(),
      meanings,
      synonyms: [...new Set(synonyms)], // Remove duplicates
      isValid: true,
    };
  } catch (error) {
    console.error("Error getting word meaning:", error);
    return null;
  }
}

/**
 * Get a random word of specified length using dictionary patterns
 */
export async function getRandomWord(length: number): Promise<string | null> {
  try {
    const dictionary = await getDictionary();

    // Try to get words using different patterns based on length
    let words: string[] = [];

    if (length <= 4) {
      // Short words - use common prefixes
      const prefixes = ["un", "re", "pre", "dis", "mis", "over", "under"];
      for (const prefix of prefixes) {
        const prefixWords = await dictionary.wordsStartingWith(prefix);
        words.push(...prefixWords.filter((w) => w.length === length));
      }
    } else if (length <= 6) {
      // Medium words - use common patterns
      const patterns = ["th", "er", "an", "in", "on", "at", "or", "ar", "en"];
      for (const pattern of patterns) {
        const patternWords = await dictionary.wordsIncluding(pattern);
        words.push(...patternWords.filter((w) => w.length === length));
      }
    } else {
      // Long words - use less common patterns
      const patterns = ["tion", "sion", "ment", "ness", "able", "ible"];
      for (const pattern of patterns) {
        const patternWords = await dictionary.wordsIncluding(pattern);
        words.push(...patternWords.filter((w) => w.length === length));
      }
    }

    // Remove duplicates and filter by exact length
    const uniqueWords = [...new Set(words)].filter((w) => w.length === length);

    if (uniqueWords.length === 0) {
      // Fallback to hardcoded words
      return getFallbackWord(length);
    }

    // Return random word
    const randomIndex = Math.floor(Math.random() * uniqueWords.length);
    return uniqueWords[randomIndex].toUpperCase();
  } catch (error) {
    console.error("Error getting random word:", error);
    return getFallbackWord(length);
  }
}

/**
 * Get fallback word from hardcoded list
 */
function getFallbackWord(length: number): string | null {
  const commonWords = [
    "apple",
    "house",
    "water",
    "world",
    "happy",
    "music",
    "light",
    "green",
    "black",
    "white",
    "small",
    "large",
    "great",
    "first",
    "right",
    "think",
    "place",
    "after",
    "where",
    "again",
    "never",
    "under",
    "while",
    "might",
    "every",
    "could",
    "would",
    "should",
    "people",
    "through",
    "before",
    "around",
    "really",
    "something",
    "different",
    "important",
    "another",
    "because",
    "without",
    "nothing",
    "everything",
    "anything",
    "someone",
    "everyone",
    "anyone",
    "someone",
    "everyone",
    "anyone",
    "someone",
  ];

  const wordsOfLength = commonWords.filter((word) => word.length === length);
  if (wordsOfLength.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * wordsOfLength.length);
  return wordsOfLength[randomIndex].toUpperCase();
}

/**
 * Get words that start with a specific prefix
 */
export async function getWordsStartingWith(prefix: string): Promise<string[]> {
  try {
    const dictionary = await getDictionary();
    const result = await dictionary.wordsStartingWith(prefix.toLowerCase());
    return result.map((word) => word.toUpperCase());
  } catch (error) {
    console.error("Error getting words starting with:", error);
    return [];
  }
}

/**
 * Get words that end with a specific suffix
 */
export async function getWordsEndingWith(suffix: string): Promise<string[]> {
  try {
    const dictionary = await getDictionary();
    const result = await dictionary.wordsEndingWith(suffix.toLowerCase());
    return result.map((word) => word.toUpperCase());
  } catch (error) {
    console.error("Error getting words ending with:", error);
    return [];
  }
}

/**
 * Get words that contain a specific substring
 */
export async function getWordsContaining(substring: string): Promise<string[]> {
  try {
    const dictionary = await getDictionary();
    const result = await dictionary.wordsIncluding(substring.toLowerCase());
    return result.map((word) => word.toUpperCase());
  } catch (error) {
    console.error("Error getting words containing:", error);
    return [];
  }
}

/**
 * Get words that can be formed with given characters
 */
export async function getWordsWithCharacters(
  characters: string
): Promise<string[]> {
  try {
    const dictionary = await getDictionary();
    const result = await dictionary.wordsWithCharsIn(characters.toLowerCase());
    const words: string[] = [];

    for (const [word] of result) {
      words.push((word as string).toUpperCase());
    }

    return words;
  } catch (error) {
    console.error("Error getting words with characters:", error);
    return [];
  }
}

/**
 * Get word difficulty level based on length and complexity
 */
export function getWordDifficulty(word: string): "easy" | "medium" | "hard" {
  const length = word.length;
  const hasUncommonLetters = /[qwxz]/i.test(word);
  const hasDoubleLetters = /(.)\1/.test(word);

  if (length <= 4) return "easy";
  if (length <= 6 && !hasUncommonLetters) return "medium";
  if (length >= 8 || hasUncommonLetters || hasDoubleLetters) return "hard";

  return "medium";
}

/**
 * Get word hints based on meaning
 */
export async function getWordHints(word: string): Promise<WordHint[]> {
  const wordInfo = await getWordMeaning(word);
  if (!wordInfo) return [];

  const hints: WordHint[] = [];

  // Add definition hints
  wordInfo.meanings.forEach((meaning) => {
    hints.push({
      type: "definition",
      content: meaning.definition,
      difficulty: "medium",
    });
  });

  // Add synonym hints
  if (wordInfo.synonyms.length > 0) {
    hints.push({
      type: "synonym",
      content: wordInfo.synonyms[0],
      difficulty: "easy",
    });
  }

  // Add part of speech hints
  const partsOfSpeech = [
    ...new Set(wordInfo.meanings.map((m) => m.partOfSpeech)),
  ];
  if (partsOfSpeech.length > 0) {
    hints.push({
      type: "partOfSpeech",
      content: partsOfSpeech.join(", "),
      difficulty: "easy",
    });
  }

  return hints;
}

// Type definitions
export interface WordInfo {
  word: string;
  meanings: WordMeaning[];
  synonyms: string[];
  isValid: boolean;
}

export interface WordMeaning {
  partOfSpeech: string;
  definition: string;
  examples: string[];
}

export interface WordHint {
  type: "definition" | "synonym" | "partOfSpeech" | "example";
  content: string;
  difficulty: "easy" | "medium" | "hard";
}

// Export types for use in components
export type {
  WordInfo as WordInfoType,
  WordMeaning as WordMeaningType,
  WordHint as WordHintType,
};
