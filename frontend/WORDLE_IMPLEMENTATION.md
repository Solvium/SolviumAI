## Wordle Feature - End-to-End Implementation Plan

### 1) Game Mechanics

- Word length: 5 (configurable via env `WORDLE_WORD_LEN=5`).
- Allowed guesses: 6 (configurable via env `WORDLE_MAX_GUESSES=6`).
- Hard mode (optional): when enabled, revealed hints must be honored in subsequent guesses.
- Validation:
  - Only allow guesses in the allowed-guess dictionary.
  - Prevent duplicate guesses; show shake animation and message.
- Coloring logic (per letter frequency aware):
  - exact: correct letter in correct position.
  - present: letter exists in answer but surplus handled with frequency caps.
  - absent: letter not present (or surplus over frequency cap).

Implementation notes:

- Keep a `computeGuessColors(answer: string, guess: string)` utility that returns an array of `exact|present|absent` with correct frequency behavior.
- Add unit tests for edge cases (duplicate letters).

### 2) Daily Puzzle Logic

- Daily answer seeded by date at UTC midnight.
- Free play mode separate from daily (no streak impact).
- No answer leakage in client code.

Implementation:

- API `GET /api/wordle/daily` returns today’s puzzle id and server-signed hash.
- API `POST /api/wordle/validate` checks server-side and returns colors; never send plain answer to client.
- Seed: `dailyId = formatUTC(YYYY-MM-DD)`. Map to answer via deterministic PRNG (seed = hash(dailyId + SECRET)) into curated solution list.

### 3) Word Lists

- Maintain two lists:
  - `solutions.txt` (smaller, curated)
  - `allowed.txt` (larger, includes solutions)
- Offensive filtering done at build time; lists versioned to preserve daily reproducibility.

### 4) UI/UX

- On-screen keyboard + physical keyboard input.
- Animations: flip reveal on submit, shake on invalid word, pop on type.
- Accessibility: adequate contrast, ARIA roles, focus states, reduced motion option.
- Responsive: mobile-friendly, large touch targets.

### 5) State & Persistence

- Persist ongoing game in `localStorage` keyed by daily id: grid, row, keyboard state, hard mode.
- Persist stats: games played, win rate, current streak, max streak, guess distribution.
- Anti-cheat: client only stores colored results, not answer; server validates.

### 6) Server/Edge APIs

Routes (Next.js app routes):

- `GET /api/wordle/daily` → `{ dailyId, puzzleId, hardModeEnabled }`
- `POST /api/wordle/validate` → body `{ dailyId, guess }` → returns `{ colors: string[], valid: boolean }`
- `POST /api/wordle/complete` → body `{ dailyId, won, guesses }` → logs stats and activities.

Server details:

- Use a small service `wordleService.ts` for:
  - `getDailyAnswer(dailyId)` → returns answer (server-side only)
  - `isAllowedWord(word)`
  - `computeColors(answer, guess)` (identical logic as client util for parity testing but source of truth is server)

### 7) Integration With Existing App

- Auth-aware stats: if logged in, store per-user stats in DB; else localStorage only.
- Activity logging: on win, call existing `/api/user/activities` with `TASK_COMPLETION` or custom `WORDLE_WIN` points (e.g., +25).
- Leaderboards: optional daily leaderboard for fewest guesses and completion time.

### 8) Data Model (Prisma)

Add (if desired) minimal tables:

- `WordleResult`:
  - `id Int @id @default(autoincrement())`
  - `userId Int?` (nullable for guests)
  - `dailyId String`
  - `guesses Int`
  - `won Boolean`
  - `completedAt DateTime @default(now())`
  - Unique(`userId,dailyId`) to avoid duplicates.
- `WordleStats` (optional aggregate per user):
  - `userId Int @id`
  - `gamesPlayed Int` `wins Int` `currentStreak Int` `maxStreak Int`
  - `distribution Json` (map guess-count → frequency)

### 9) Components Structure

- `components/wordle/WordleGame.tsx` (container)
- `components/wordle/Grid.tsx` (rows/tiles animations)
- `components/wordle/Keyboard.tsx` (keys + status)
- `components/wordle/StatsModal.tsx` (share + streaks)
- `lib/wordle/words.ts` (client-allowed list subset if needed)
- `lib/wordle/utils.ts` (`computeGuessColors`, `seedFromDate`)

### 10) API Contracts

- `GET /api/wordle/daily`
  - Res: `{ dailyId: string, hardModeEnabled: boolean }`
- `POST /api/wordle/validate`
  - Req: `{ dailyId: string, guess: string }`
  - Res: `{ valid: boolean, colors?: ("exact"|"present"|"absent")[] }`
- `POST /api/wordle/complete`
  - Req: `{ dailyId: string, won: boolean, guesses: number }`
  - Res: `{ success: true }`

### 11) Points & Economy Hooks

- On successful daily completion:
  - `logActivity({ activity_type: "WORDLE_WIN", points_earned: ACTIVITY_POINTS.TASK_COMPLETION, metadata: { dailyId, guesses } })`.
- Optional: monetization add-ons (buy hint with points; extra guess purchase).

### 12) Testing

- Unit tests (coloring): duplicate letters, all-match, none-match, partials.
- Integration tests:
  - valid/invalid words
  - win on last guess
  - hard mode constraints
  - persistence reload
- E2E: keyboard entry, animations, daily rollover.

### 13) Performance

- Lazy-load large word lists.
- Keep client bundle small; avoid shipping full solution list.
- Preload fonts; minimize layout shifts.

### 14) Config & Ops

- Env vars:
  - `WORDLE_WORD_LEN`, `WORDLE_MAX_GUESSES`
  - `WORDLE_HARD_MODE=true|false`
  - `WORDLE_SECRET` (server-only for seeding)
- Time standardization: UTC for daily rollover.
- Feature flags to toggle special events or themes.

### 15) Pseudocode Highlights

Client submit flow:

```
onSubmit(guess):
  if guess.length !== WORD_LEN return shake
  if !allowedList.has(guess) return shake
  res = await POST /api/wordle/validate { dailyId, guess }
  if (!res.valid) return shake
  applyColors(res.colors) with flip animation
  if allExact → win → POST /api/wordle/complete
  else if row == maxGuesses-1 → lose → show answer via server message
  persist state in localStorage
```

Server validate:

```
validate(dailyId, guess):
  answer = getDailyAnswer(dailyId)
  if !isAllowedWord(guess) return { valid: false }
  colors = computeColors(answer, guess)
  return { valid: true, colors }
```

### 16) Delivery Checklist

- [ ] APIs implemented (`daily`, `validate`, `complete`).
- [ ] Client components with animations and a11y.
- [ ] Persistence + stats + share grid.
- [ ] Activity logging integrated.
- [ ] Tests (unit + integration + E2E smoke).
- [ ] Docs for operations and envs.

---

This plan fits your existing stack (Next.js, Prisma, AuthContext, activities API) and keeps the answer secure on the server while providing a polished Wordle experience.
