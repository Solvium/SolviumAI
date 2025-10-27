# Telegram Mini App URL Routing Guide

This guide explains how to handle URL routing and deep linking in your Telegram Mini App.

## 🚀 How to Open Mini App to Specific URLs

### 1. **From Telegram Bot**

#### Using Inline Keyboard

```python
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

# Create inline keyboard with mini app button
keyboard = [
    [InlineKeyboardButton(
        "Play Wordle",
        web_app=WebAppInfo(url="https://yourapp.com?route=/game/wordle")
    )],
    [InlineKeyboardButton(
        "Play Quiz",
        web_app=WebAppInfo(url="https://yourapp.com?route=/game/quiz")
    )]
]
reply_markup = InlineKeyboardMarkup(keyboard)
```

#### Using Bot Commands with Start Parameters

```python
# When user clicks /start wordle_game
@bot.message_handler(commands=['start'])
def start_command(message):
    if len(message.text.split()) > 1:
        start_param = message.text.split()[1]  # e.g., "wordle_game"

        # Create mini app button with start parameter
        keyboard = [[InlineKeyboardButton(
            "Open Game",
            web_app=WebAppInfo(url=f"https://yourapp.com?start_param={start_param}")
        )]]

        bot.send_message(
            message.chat.id,
            "Click to open the game!",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
```

### 2. **From External Links**

#### Direct URL Access

Users can open your mini app directly with specific routes:

- `https://t.me/your_bot/app?startapp=route%3D%2Fgame%2Fwordle`
- `https://t.me/your_bot/app?startapp=route%3D%2Fgame%2Fquiz`

#### Shareable Links

```javascript
// Generate shareable game links
function generateGameShareLink(gameId, botUsername) {
  const baseUrl = `https://t.me/${botUsername}`;
  const startParam = `route=/game/${gameId}`;
  return `${baseUrl}?startapp=${encodeURIComponent(startParam)}`;
}

// Example usage
const wordleLink = generateGameShareLink("wordle", "your_bot_username");
// Result: https://t.me/your_bot_username?startapp=route%3D%2Fgame%2Fwordle
```

## 🏗️ Implementation Details

### URL Parameter Handling

Your mini app automatically handles these URL patterns:

1. **Query Parameters**: `https://yourapp.com?route=/game/wordle`
2. **Start Parameters**: `https://yourapp.com?start_param=route%3D%2Fgame%2Fwordle`
3. **Path-based**: `https://yourapp.com/game/wordle` (for direct access)

### Navigation Context Integration

The `NavigationContext` automatically detects the initial route:

```typescript
// Automatically maps URLs to app pages
function getInitialPageFromUrl(): AppPage {
  const urlParams = getUrlParams();
  const route =
    urlParams.get("route") || urlParams.get("page") || window.location.pathname;

  if (route.includes("/game/wordle")) return "GameWordle";
  if (route.includes("/game/quiz")) return "GameQuiz";
  // ... other games

  return "Home";
}
```

## 🎮 Game-Specific URLs

### Available Game Routes

| Game       | URL Pattern        | Example                                      |
| ---------- | ------------------ | -------------------------------------------- |
| Wordle     | `/game/wordle`     | `https://yourapp.com?route=/game/wordle`     |
| Quiz       | `/game/quiz`       | `https://yourapp.com?route=/game/quiz`       |
| Puzzle     | `/game/puzzle`     | `https://yourapp.com?route=/game/puzzle`     |
| Num Genius | `/game/num-genius` | `https://yourapp.com?route=/game/num-genius` |
| Crossword  | `/game/cross-word` | `https://yourapp.com?route=/game/cross-word` |

### Bot Integration Examples

#### Python (python-telegram-bot)

```python
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

def create_game_menu():
    keyboard = [
        [InlineKeyboardButton("🎯 Wordle", web_app=WebAppInfo(url="https://yourapp.com?route=/game/wordle"))],
        [InlineKeyboardButton("🧠 Quiz", web_app=WebAppInfo(url="https://yourapp.com?route=/game/quiz"))],
        [InlineKeyboardButton("🧩 Puzzle", web_app=WebAppInfo(url="https://yourapp.com?route=/game/puzzle"))],
        [InlineKeyboardButton("🔢 Num Genius", web_app=WebAppInfo(url="https://yourapp.com?route=/game/num-genius"))],
        [InlineKeyboardButton("📝 Crossword", web_app=WebAppInfo(url="https://yourapp.com?route=/game/cross-word"))],
    ]
    return InlineKeyboardMarkup(keyboard)

@bot.message_handler(commands=['games'])
def show_games(message):
    bot.send_message(
        message.chat.id,
        "🎮 Choose a game to play:",
        reply_markup=create_game_menu()
    )
```

#### Node.js (telegraf)

```javascript
const { Markup } = require("telegraf");

const gameMenu = Markup.inlineKeyboard([
  [Markup.button.webApp("🎯 Wordle", "https://yourapp.com?route=/game/wordle")],
  [Markup.button.webApp("🧠 Quiz", "https://yourapp.com?route=/game/quiz")],
  [Markup.button.webApp("🧩 Puzzle", "https://yourapp.com?route=/game/puzzle")],
  [
    Markup.button.webApp(
      "🔢 Num Genius",
      "https://yourapp.com?route=/game/num-genius"
    ),
  ],
  [
    Markup.button.webApp(
      "📝 Crossword",
      "https://yourapp.com?route=/game/cross-word"
    ),
  ],
]);

bot.command("games", (ctx) => {
  ctx.reply("🎮 Choose a game to play:", gameMenu);
});
```

## 🔧 Advanced Features

### 1. **Deep Linking with Parameters**

You can pass additional parameters to games:

```javascript
// URL with game parameters
const gameUrl = `https://yourapp.com?route=/game/wordle&difficulty=hard&theme=dark`;

// In your bot
InlineKeyboardButton(
  "Hard Wordle",
  (web_app = WebAppInfo(
    (url = "https://yourapp.com?route=/game/wordle&difficulty=hard")
  ))
);
```

### 2. **User-Specific Game States**

```python
# Pass user-specific data
user_id = message.from_user.id
game_url = f"https://yourapp.com?route=/game/wordle&user_id={user_id}&level=5"

InlineKeyboardButton(
    "Continue Game",
    web_app=WebAppInfo(url=game_url)
)
```

### 3. **Telegram WebApp API Integration**

```typescript
// Access Telegram WebApp data in your mini app
const tg = getTelegramWebApp();

if (tg) {
  // Get user info
  const user = tg.initDataUnsafe.user;

  // Get start parameter
  const startParam = tg.initDataUnsafe.start_param;

  // Handle back button
  tg.BackButton.show();
  tg.BackButton.onClick(() => {
    // Handle back navigation
  });
}
```

## 🛡️ Security Considerations

### 1. **URL Validation**

- Always validate incoming URL parameters
- Sanitize user input
- Check for valid game IDs

### 2. **Authentication**

- Verify user identity through Telegram WebApp data
- Validate start parameters
- Implement proper session management

### 3. **Rate Limiting**

- Implement rate limiting for game access
- Prevent abuse of deep links
- Monitor unusual access patterns

## 📱 Testing Your Mini App

### 1. **Local Testing**

```bash
# Start your development server
npm run dev

# Test with ngrok for Telegram testing
ngrok http 3000

# Use the ngrok URL in your bot
https://your-ngrok-url.ngrok.io?route=/game/wordle
```

### 2. **Telegram Testing**

1. Create a test bot with BotFather
2. Set your mini app URL in BotFather
3. Test different URL patterns
4. Verify deep linking works correctly

### 3. **URL Testing Checklist**

- [ ] Direct game URLs work
- [ ] Bot buttons open correct games
- [ ] Start parameters are parsed correctly
- [ ] Back navigation works
- [ ] Invalid URLs redirect properly
- [ ] Authentication is maintained

## 🚀 Deployment

### 1. **Production URLs**

Update your bot's mini app URL to your production domain:

```
https://yourdomain.com
```

### 2. **HTTPS Requirements**

- Telegram requires HTTPS for mini apps
- Ensure SSL certificates are valid
- Test all URLs in production

### 3. **Performance Optimization**

- Implement proper caching
- Optimize game loading
- Monitor performance metrics

## 📊 Analytics & Monitoring

### Track Game Access

```typescript
// Track which games are accessed via deep links
function trackGameAccess(gameId: string, source: string) {
  // Send analytics data
  console.log(`Game ${gameId} accessed via ${source}`);
}
```

### Monitor URL Patterns

- Track most popular game routes
- Monitor conversion rates
- Analyze user behavior patterns

## 🔄 Migration from Old System

If you're migrating from a state-based navigation system:

1. **Keep Backward Compatibility**: Old navigation still works
2. **Gradual Migration**: Update bot buttons to use new URLs
3. **User Education**: Inform users about new direct access features
4. **Testing**: Thoroughly test all URL patterns

## 📚 Additional Resources

- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WebApp JavaScript API](https://core.telegram.org/bots/webapps#javascript-sdk)

## 🎯 Best Practices

1. **Always use HTTPS** for mini app URLs
2. **Validate all parameters** before processing
3. **Provide fallbacks** for invalid URLs
4. **Test thoroughly** with different devices and browsers
5. **Monitor performance** and user experience
6. **Keep URLs simple** and memorable
7. **Document your URL patterns** for team members
