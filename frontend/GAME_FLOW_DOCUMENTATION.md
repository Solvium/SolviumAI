# 🎮 **COMPLETE GAME FLOW DOCUMENTATION**

## 📋 **OVERVIEW**

This document provides a comprehensive breakdown of the entire Wordle game flow, from user authentication to game completion, including all data storage, API interactions, and system functionality.

---

## 🔐 **1. USER AUTHENTICATION & PROFILE SETUP**

### **1.1 Telegram Authentication Flow**

```
User opens Telegram WebApp → Telegram sends initData → Backend processes → User created/updated
```

**API Endpoint**: `POST /api/auth/telegram`

**Data Flow**:

1. **Frontend**: Extracts Telegram WebApp data (`initData`)
2. **Backend**: Processes user data from Telegram
3. **Database**: Creates or updates user record

**Data Extracted from Telegram**:

```typescript
{
  telegramId: string,        // Unique Telegram user ID
  username: string,          // Telegram username
  firstName: string,         // First name
  lastName: string,          // Last name
  avatarUrl: string,         // Profile photo URL
}
```

**Database Storage** (`User` table):

```sql
INSERT INTO User (
  username, name, chatId, avatar_url,
  totalSOLV, totalPoints, experience_points, weeklyPoints,
  level, difficulty, gamesPlayed, gamesWon,
  createdAt, updatedAt
) VALUES (
  'ajemark0110', 'Ajemark', '123456789', 'https://t.me/photo.jpg',
  0, 0, 0, 0,
  1, 1, 0, 0,
  NOW(), NOW()
);
```

**Response to Frontend**:

```typescript
{
  success: true,
  user: {
    id: "1",
    username: "ajemark0110",
    avatar_url: "https://t.me/photo.jpg",
    totalSOLV: 0,
    level: 1,
    // ... other user data
  },
  accessToken: "jwt_token",
  refreshToken: "refresh_token"
}
```

### **1.2 Google Authentication Flow**

**API Endpoint**: `POST /api/auth/google/access`

**Similar flow to Telegram but with Google OAuth data**

---

## 🎯 **2. GAME INITIALIZATION**

### **2.1 User Profile Loading**

**API Endpoint**: `GET /api/user/profile`

**Data Retrieved**:

```typescript
{
  user: {
    id: "1",
    username: "ajemark0110",
    totalSOLV: 3397,
    experience_points: 62,
    level: 1,
    level_progress: {
      current_level: 1,
      next_level_points: 100,
      progress_percentage: 62,
      points_to_next: 38,
      level_title: "Beginner"
    },
    gamesPlayed: 31,
    gamesWon: 31,
    recent_activities: [...]
  }
}
```

### **2.2 Game Configuration Loading**

**Frontend**: Loads game configuration from context

```typescript
const gameConfig = {
  level: 1,
  difficulty: "Easy",
  hintsPerDay: { Easy: 3, Medium: 2, Hard: 1 },
  winPoints: { Easy: 100, Medium: 120, Hard: 150 },
  hintCost: { Easy: 50, Medium: 60, Hard: 75 },
  // ... other config
};
```

---

## 🎲 **3. WORD SELECTION & FETCHING**

### **3.1 Daily Word Fetching (Background Process)**

**API Endpoint**: `POST /api/words/fetch-daily`

**Process**:

1. **Check if words already fetched today**
2. **If not, fetch from Gemini AI**
3. **Store words in database**

**Gemini AI Integration**:

```typescript
// Fetch words with meanings, examples, synonyms
const prompt = `
Generate 50 ${difficulty} words for a word game:
- Each word should be ${length} letters
- Include meaning, 3 examples, 4 synonyms
- Format as JSON array
`;

const response = await genAI.generateContent(prompt);
```

**Database Storage** (`Word` table):

```sql
INSERT INTO Word (
  word, length, difficulty, meaning, examples, synonyms, isActive
) VALUES (
  'RELAXED', 7, 'medium',
  'Free from tension and anxiety; calm.',
  '["She felt relaxed after the massage", "The atmosphere was relaxed", "He looked relaxed and confident"]',
  '["calm", "peaceful", "serene", "tranquil"]',
  true
);
```

### **3.2 User Word Selection**

**API Endpoint**: `POST /api/words/get-word`

**Process**:

1. **Get user's used words** (to avoid repetition)
2. **Select random unused word** for user's level
3. **Mark word as used** for this user
4. **Return word data**

**Database Queries**:

```sql
-- Get user's used words
SELECT w.word FROM WordUsage wu
JOIN Word w ON wu.wordId = w.id
WHERE wu.userId = 1 AND wu.gameType = 'wordle';

-- Select random unused word
SELECT * FROM Word
WHERE difficulty = 'medium' AND isActive = true
AND word NOT IN (used_words_list)
ORDER BY RANDOM() LIMIT 1;

-- Mark word as used
INSERT INTO WordUsage (userId, wordId, gameType, usedAt)
VALUES (1, 123, 'wordle', NOW());
```

**Response**:

```typescript
{
  word: "RELAXED",
  length: 7,
  difficulty: "medium",
  meaning: "Free from tension and anxiety; calm.",
  examples: ["She felt relaxed after the massage", ...],
  synonyms: ["calm", "peaceful", "serene", "tranquil"]
}
```

---

## 🎮 **4. GAME PLAY FLOW**

### **4.1 Game State Management**

**Frontend State**:

```typescript
const [gameState, setGameState] = useState({
  targetWord: "RELAXED",
  currentGuess: "",
  guesses: [],
  gameStarted: true,
  gameOver: false,
  gameWon: false,
  hintUsed: false,
  timeRemaining: 300, // 5 minutes
  level: 1,
  difficulty: "Easy",
});
```

### **4.2 Guess Validation**

**Frontend Validation**:

```typescript
const validateGuess = (guess: string, targetWord: string) => {
  const colors = [];
  const targetArray = targetWord.split("");
  const guessArray = guess.split("");

  // Check for exact matches (green)
  for (let i = 0; i < guessArray.length; i++) {
    if (guessArray[i] === targetArray[i]) {
      colors[i] = "green";
      targetArray[i] = null; // Mark as used
    }
  }

  // Check for present letters (yellow)
  for (let i = 0; i < guessArray.length; i++) {
    if (colors[i] !== "green") {
      const index = targetArray.indexOf(guessArray[i]);
      if (index !== -1) {
        colors[i] = "yellow";
        targetArray[index] = null;
      } else {
        colors[i] = "gray";
      }
    }
  }

  return colors;
};
```

### **4.3 Hint System**

**API Endpoint**: `GET /api/words/meaning?word=RELAXED`

**Process**:

1. **Check daily hint limit** (3 for Easy, 2 for Medium, 1 for Hard)
2. **Deduct hint cost** from user's SOLV
3. **Return word meaning**

**Database Updates**:

```sql
-- Update user's daily hint usage
UPDATE User SET
  dailyHintUsage = dailyHintUsage + 1,
  totalSOLV = totalSOLV - 50
WHERE id = 1;

-- Log hint usage
INSERT INTO UserActivity (userId, activity_type, points_earned, metadata)
VALUES (1, 'HINT_USED', 0, '{"word": "RELAXED", "cost": 50}');
```

### **4.4 Timer System**

**Frontend Timer**:

```typescript
useEffect(() => {
  if (gameStarted && !gameOver) {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }
}, [gameStarted, gameOver]);
```

---

## 🏆 **5. GAME COMPLETION**

### **5.1 Win Condition**

**Frontend Check**:

```typescript
const checkWinCondition = (guess: string, targetWord: string) => {
  return guess === targetWord;
};

if (checkWinCondition(currentGuess, targetWord)) {
  setGameWon(true);
  setGameOver(true);
  setShowGameOverModal(true);

  // Calculate rewards
  const rewards = calculateRewards(guesses.length, hintUsed, timeRemaining);

  // Update user state
  setUserSOLV((prev) => prev + rewards.totalSOLV);

  // Save to database
  saveGameCompletion();
}
```

### **5.2 Reward Calculation**

**Frontend Logic**:

```typescript
const calculateRewards = (
  guesses: number,
  hintUsed: boolean,
  completionTime: number
) => {
  const baseReward = gameConfig.winPoints[difficulty]; // 100-150 SOLV
  const speedBonus = completionTime < 60 ? 20 : 0;
  const hintPenalty = hintUsed ? gameConfig.hintCost[difficulty] : 0;

  return {
    baseReward,
    speedBonus,
    hintPenalty,
    totalSOLV: baseReward + speedBonus - hintPenalty,
  };
};
```

### **5.3 Game Completion API**

**API Endpoint**: `POST /api/wordle/complete`

**Request Data**:

```typescript
{
  dailyId: "2025-10-04",
  won: true,
  guesses: 3,
  level: 1,
  difficulty: "Easy",
  completionTime: 45,
  hintUsed: false,
  rewards: 120,
  targetWord: "RELAXED",
  userId: 1
}
```

**Database Operations**:

#### **5.3.1 Save Game Result**

```sql
INSERT INTO WordleGame (
  userId, dailyId, level, difficulty, won, guesses,
  completionTime, hintUsed, rewards, targetWord, playedAt
) VALUES (
  1, '2025-10-04', 1, 'Easy', true, 3,
  45, false, 120, 'RELAXED', NOW()
);
```

#### **5.3.2 Update User Statistics**

```sql
UPDATE User SET
  totalSOLV = totalSOLV + 120,
  totalPoints = totalPoints + 120,
  experience_points = experience_points + 1,
  weeklyPoints = weeklyPoints + 120,
  gamesPlayed = gamesPlayed + 1,
  gamesWon = gamesWon + 1,
  level = 1, -- Calculated based on experience_points
  difficulty = 1 -- Based on level
WHERE id = 1;
```

#### **5.3.3 Update Weekly Score**

```sql
INSERT INTO WeeklyScore (userId, weekNumber, year, points)
VALUES (1, 40, 2025, 120)
ON CONFLICT (userId, weekNumber, year)
DO UPDATE SET points = points + 120;
```

#### **5.3.4 Log Activity**

```sql
INSERT INTO UserActivity (
  userId, activity_type, points_earned, metadata
) VALUES (
  1, 'WORDLE_WIN', 1,
  '{"gameType": "wordle", "level": 1, "difficulty": "Easy", "guesses": 3, "completionTime": 45, "targetWord": "RELAXED", "hintUsed": false, "solvEarned": 120}'
);
```

**Response**:

```typescript
{
  success: true,
  level: 1,
  gameId: 31,
  totalGamesWon: 31,
  levelUp: false
}
```

---

## 📊 **6. LEVEL PROGRESSION SYSTEM**

### **6.1 Level Configuration**

**Database Table**: `LevelConfig`

```sql
INSERT INTO LevelConfig (level, points_required, rewards) VALUES
(1, 0, '{"title": "Beginner"}'),
(2, 100, '{"title": "Novice"}'),
(3, 300, '{"title": "Apprentice"}'),
(4, 600, '{"title": "Skilled"}'),
(5, 1000, '{"title": "Expert"}'),
(6, 1500, '{"title": "Master"}'),
(7, 2100, '{"title": "Grandmaster"}'),
(8, 2800, '{"title": "Legend"}'),
(9, 3600, '{"title": "Mythic"}'),
(10, 4500, '{"title": "Transcendent"}');
```

### **6.2 Level Calculation**

**Backend Logic**:

```typescript
const calculateLevel = (experiencePoints: number) => {
  const levelConfigs = await prisma.levelConfig.findMany({
    orderBy: { level: "asc" },
  });

  let currentLevel = 1;
  for (let i = levelConfigs.length - 1; i >= 0; i--) {
    if (experiencePoints >= levelConfigs[i].points_required) {
      currentLevel = levelConfigs[i].level;
      break;
    }
  }

  return currentLevel;
};
```

### **6.3 Level Progression**

**Experience Points System**:

- **1 XP per game won**
- **1 XP per game played**
- **Level up** when XP reaches next threshold

**Example**:

- User has 62 XP → Level 1 (Beginner)
- User needs 38 more XP → Level 2 (Novice)
- Each game win = +1 XP

---

## 🏅 **7. LEADERBOARD & CONTESTS**

### **7.1 Weekly Contests**

**API Endpoint**: `GET /api/allroute?type=leaderboard`

**Database Query**:

```sql
SELECT
  u.id, u.username, u.name, u.totalSOLV, u.gamesPlayed,
  u.gamesWon, u.level, u.difficulty, u.avatar_url
FROM User u
ORDER BY u.totalSOLV DESC
LIMIT 100;
```

**Response**:

```typescript
[
  {
    id: 1,
    username: "ajemark0110",
    name: "Ajemark",
    totalSOLV: 3397,
    gamesPlayed: 31,
    gamesWon: 31,
    level: 1,
    difficulty: 1,
    avatar_url: "https://t.me/photo.jpg",
  },
  // ... more users
];
```

### **7.2 Weekly Score Tracking**

**Database Table**: `WeeklyScore`

```sql
SELECT ws.*, u.username
FROM WeeklyScore ws
JOIN User u ON ws.userId = u.id
WHERE ws.weekNumber = 40 AND ws.year = 2025
ORDER BY ws.points DESC;
```

---

## 💾 **8. DATA STORAGE OVERVIEW**

### **8.1 Database Tables**

#### **User Table**

```sql
CREATE TABLE User (
  id SERIAL PRIMARY KEY,
  username VARCHAR UNIQUE,
  name VARCHAR,
  chatId VARCHAR,
  avatar_url VARCHAR,
  totalSOLV INTEGER DEFAULT 0,
  totalPoints INTEGER DEFAULT 0,
  experience_points INTEGER DEFAULT 0,
  weeklyPoints INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  difficulty INTEGER DEFAULT 1,
  gamesPlayed INTEGER DEFAULT 0,
  gamesWon INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### **Word Table**

```sql
CREATE TABLE Word (
  id SERIAL PRIMARY KEY,
  word VARCHAR UNIQUE,
  length INTEGER,
  difficulty VARCHAR,
  meaning TEXT,
  examples JSON,
  synonyms JSON,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### **WordUsage Table**

```sql
CREATE TABLE WordUsage (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES User(id),
  wordId INTEGER REFERENCES Word(id),
  gameType VARCHAR DEFAULT 'wordle',
  usedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, wordId, gameType)
);
```

#### **WordleGame Table**

```sql
CREATE TABLE WordleGame (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES User(id),
  dailyId VARCHAR,
  level INTEGER,
  difficulty VARCHAR,
  won BOOLEAN,
  guesses INTEGER,
  completionTime INTEGER,
  hintUsed BOOLEAN,
  rewards INTEGER,
  targetWord VARCHAR,
  playedAt TIMESTAMP DEFAULT NOW()
);
```

#### **UserActivity Table**

```sql
CREATE TABLE UserActivity (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES User(id),
  activity_type VARCHAR,
  points_earned INTEGER DEFAULT 0,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### **WeeklyScore Table**

```sql
CREATE TABLE WeeklyScore (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES User(id),
  weekNumber INTEGER,
  year INTEGER,
  points INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, weekNumber, year)
);
```

#### **LevelConfig Table**

```sql
CREATE TABLE LevelConfig (
  id SERIAL PRIMARY KEY,
  level INTEGER UNIQUE,
  points_required INTEGER,
  rewards JSON
);
```

### **8.2 Data Flow Summary**

1. **User Authentication** → `User` table
2. **Word Fetching** → `Word` table
3. **Word Selection** → `WordUsage` table
4. **Game Play** → Frontend state
5. **Game Completion** → `WordleGame` table
6. **User Updates** → `User` table
7. **Activity Logging** → `UserActivity` table
8. **Weekly Tracking** → `WeeklyScore` table
9. **Level Progression** → `LevelConfig` table

---

## 🔄 **9. COMPLETE GAME CYCLE**

### **9.1 New Game Flow**

```
1. User opens app → Authentication check
2. Load user profile → Display level, SOLV, progress
3. Click "New Game" → Fetch random word
4. Play game → Make guesses, use hints
5. Win/Lose → Calculate rewards
6. Save results → Update database
7. Show results → Display rewards, level progress
8. Return to menu → Ready for next game
```

### **9.2 Data Persistence**

- **User progress** saved after each game
- **Word usage** tracked to prevent repetition
- **Activity history** logged for analytics
- **Weekly scores** updated for contests
- **Level progression** calculated automatically

### **9.3 Real-time Updates**

- **SOLV balance** updated immediately
- **Level progress** calculated in real-time
- **Leaderboard** reflects current standings
- **Activity feed** shows recent actions

---

## 🎯 **10. KEY FEATURES**

### **10.1 Word Management**

- **Daily word fetching** from Gemini AI
- **Difficulty-based word selection**
- **No repetition** for individual users
- **Rich word data** (meaning, examples, synonyms)

### **10.2 Progression System**

- **1 XP per activity** (balanced progression)
- **Level-based rewards** and difficulty
- **Experience points** separate from SOLV currency
- **Achievement tracking** through activities

### **10.3 Social Features**

- **Weekly leaderboards** based on SOLV
- **User profiles** with avatars and stats
- **Activity tracking** for engagement
- **Contest participation** through weekly scores

### **10.4 Game Mechanics**

- **Hint system** with daily limits and costs
- **Timer tracking** for completion bonuses
- **Difficulty scaling** based on level
- **Reward calculation** based on performance

---

## 📈 **11. ANALYTICS & MONITORING**

### **11.1 User Analytics**

- **Game completion rates**
- **Average completion time**
- **Hint usage patterns**
- **Level progression speed**

### **11.2 System Monitoring**

- **API response times**
- **Database query performance**
- **Word fetching success rates**
- **User engagement metrics**

### **11.3 Business Metrics**

- **Daily active users**
- **Games played per user**
- **SOLV economy balance**
- **Weekly contest participation**

---

## 🔧 **12. TECHNICAL ARCHITECTURE**

### **12.1 Frontend (Next.js)**

- **React components** for game UI
- **Context API** for state management
- **Tailwind CSS** for styling
- **TypeScript** for type safety

### **12.2 Backend (Next.js API Routes)**

- **RESTful APIs** for data operations
- **Prisma ORM** for database access
- **JWT authentication** for security
- **Error handling** and validation

### **12.3 Database (PostgreSQL)**

- **Relational data** with foreign keys
- **JSON fields** for flexible data
- **Indexes** for performance
- **Transactions** for data consistency

### **12.4 External Services**

- **Gemini AI** for word generation
- **Telegram WebApp** for authentication
- **Google OAuth** for alternative auth

---

## 🚀 **13. DEPLOYMENT & SCALING**

### **13.1 Production Considerations**

- **Database connection pooling**
- **API rate limiting**
- **Caching strategies**
- **Error monitoring**

### **13.2 Performance Optimization**

- **Database query optimization**
- **Frontend code splitting**
- **Image optimization**
- **CDN for static assets**

### **13.3 Security Measures**

- **Input validation** and sanitization
- **SQL injection prevention**
- **XSS protection**
- **Rate limiting** for APIs

---

---

## 🚨 **TROUBLESHOOTING & ISSUES**

### **Word Exhaustion Issue (RESOLVED)**

**Problem**: Users running out of words for their difficulty level

- **Cause**: System only fetched 15 words per difficulty per day
- **Symptom**: `POST /api/words/get-word 404` with "No available words for this difficulty level"
- **Solution**:
  1. **Increased daily word fetch** from 15 to 25 words per difficulty
  2. **Added fallback system** - if no words available for requested difficulty, tries other difficulties
  3. **Emergency word fetch** - automatically fetches more words if all difficulties exhausted
  4. **Manual word fetch** - can be triggered via `POST /api/words/fetch-daily`

**Prevention**:

- Monitor word usage vs. available words
- Set up automated daily word fetching
- Consider increasing words per difficulty based on user activity

---

**Last Updated**: October 4, 2025  
**Version**: 1.1  
**Status**: Production Ready ✅
