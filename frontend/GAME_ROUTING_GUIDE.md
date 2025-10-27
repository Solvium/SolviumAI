# Game Routing System Guide

This guide explains how to use the new game routing system that allows direct access to specific games via URLs like `/game/wordle`.

## 🎮 Available Game Routes

| Game ID          | Route                  | Title          | Description               |
| ---------------- | ---------------------- | -------------- | ------------------------- |
| `wordle`         | `/game/wordle`         | WORDLE         | Guess the word in 6 tries |
| `quiz`           | `/game/quiz`           | QUIZ           | Test your knowledge       |
| `puzzle`         | `/game/puzzle`         | PUZZLE         | Solve the picture puzzle  |
| `picture-puzzle` | `/game/picture-puzzle` | PICTURE PUZZLE | Arrange the pieces        |
| `num-genius`     | `/game/num-genius`     | NUM GENIUS     | Number puzzle challenge   |
| `cross-word`     | `/game/cross-word`     | CROSSWORD      | Word puzzle game          |

## 🚀 Usage Examples

### 1. Direct URL Access

Users can now visit these URLs directly:

- `https://yourapp.com/game/wordle`
- `https://yourapp.com/game/quiz`
- `https://yourapp.com/game/puzzle`

### 2. Using GameLink Component

```tsx
import GameLink from "@/components/common/GameLink";

// Direct link to Wordle
<GameLink gameId="wordle" className="btn btn-primary">
  Play Wordle
</GameLink>

// Link to Quiz
<GameLink gameId="quiz" className="custom-styling">
  Start Quiz
</GameLink>
```

### 3. Programmatic Navigation

```tsx
import { useEnhancedNavigation } from "@/lib/navigationUtils";

function MyComponent() {
  const { navigateToGame } = useEnhancedNavigation();

  const handlePlayWordle = () => {
    navigateToGame("wordle");
  };

  return <button onClick={handlePlayWordle}>Play Wordle</button>;
}
```

### 4. Using Game Utilities

```tsx
import { getGameInfo, getGameUrl, getAllGames } from "@/lib/gameUtils";

// Get game information
const wordleInfo = getGameInfo("wordle");
console.log(wordleInfo.title); // "WORDLE"

// Get game URL
const wordleUrl = getGameUrl("wordle");
console.log(wordleUrl); // "/game/wordle"

// Get all available games
const allGames = getAllGames();
```

## 🏗️ Architecture

### File Structure

```
src/
├── app/
│   ├── game/
│   │   └── [gameId]/
│   │       └── page.tsx          # Dynamic game route
│   └── game-test/
│       └── page.tsx             # Test page for routing
├── components/
│   ├── common/
│   │   └── GameLink.tsx         # Reusable game link component
│   └── layout/
│       └── GameLayout.tsx       # Layout for individual games
├── lib/
│   ├── gameUtils.ts             # Game utilities and types
│   └── navigationUtils.ts       # Enhanced navigation utilities
└── middleware.ts                # Route validation middleware
```

### Key Components

#### 1. Dynamic Game Route (`/app/game/[gameId]/page.tsx`)

- Handles all game routes dynamically
- Validates game IDs
- Provides consistent layout and navigation
- Includes authentication checks

#### 2. Game Utilities (`/lib/gameUtils.ts`)

- Centralized game configuration
- Type-safe game IDs
- URL generation utilities
- Game metadata management

#### 3. Navigation Utilities (`/lib/navigationUtils.ts`)

- Enhanced navigation hooks
- Programmatic game navigation
- URL generation for sharing

#### 4. GameLink Component (`/components/common/GameLink.tsx`)

- Reusable component for game links
- Type-safe game ID props
- Consistent styling options

## 🔧 Configuration

### Adding New Games

1. **Update Game Types** in `gameUtils.ts`:

```tsx
export type GameId = "wordle" | "quiz" | "puzzle" | "new-game"; // Add your new game
```

2. **Add Game Configuration**:

```tsx
export const GAME_ROUTES: Record<GameId, GameInfo> = {
  // ... existing games
  "new-game": {
    id: "new-game",
    title: "NEW GAME",
    description: "Your new game description",
    route: "/game/new-game",
  },
};
```

3. **Add Game Component** in the dynamic route:

```tsx
const gameComponents = {
  // ... existing components
  "new-game": NewGameComponent,
};
```

4. **Update Middleware** to include the new game ID:

```tsx
const validGameIds = [
  "wordle",
  "quiz",
  "puzzle",
  "new-game", // Add your new game
];
```

## 🛡️ Security & Validation

### Route Protection

- All game routes require authentication
- Invalid game IDs redirect to home page
- Middleware validates game IDs before routing

### Type Safety

- Game IDs are strongly typed
- Compile-time validation of game routes
- IntelliSense support for game navigation

## 🧪 Testing

### Test Page

Visit `/game-test` to test the routing system:

- Direct game links
- Programmatic navigation
- URL examples

### Manual Testing

1. Visit `/game/wordle` - should open Wordle game
2. Visit `/game/invalid` - should redirect to home
3. Test navigation from games page
4. Test back button functionality

## 🎯 Benefits

1. **SEO Friendly**: Direct URLs for each game
2. **Shareable**: Users can share specific game links
3. **Bookmarkable**: Games can be bookmarked
4. **Type Safe**: Compile-time validation
5. **Consistent**: Unified navigation experience
6. **Extensible**: Easy to add new games

## 🔄 Migration from Old System

The old system used state-based navigation within the games page. The new system:

1. **Maintains Backward Compatibility**: Old navigation still works
2. **Adds Direct Access**: New URL-based access
3. **Enhances UX**: Better navigation and sharing
4. **Improves SEO**: Search engines can index individual games

## 📱 Mobile Considerations

- All game routes are mobile-optimized
- Consistent layout across devices
- Touch-friendly navigation
- Responsive design maintained

## 🚀 Future Enhancements

Potential improvements:

1. **Game State Persistence**: Save game progress in URLs
2. **Deep Linking**: Support for game-specific parameters
3. **Analytics**: Track individual game usage
4. **Caching**: Optimize game loading
5. **PWA Support**: Offline game access
