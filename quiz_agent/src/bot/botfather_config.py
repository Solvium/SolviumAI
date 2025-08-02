"""
BotFather Configuration for SolviumAI Bot

This file contains the configuration and instructions for setting up the bot's
persistent menu button and other BotFather settings.

To configure the bot with BotFather:

1. Open @BotFather in Telegram
2. Send /mybots
3. Select your bot
4. Go to "Bot Settings" > "Menu Button"
5. Set the menu button with the following configuration:

Menu Button Text: "Open app"
Menu Button URL: "https://solvium.ai" (or your web app URL)

Alternative configuration via commands:
/menubutton - Set the menu button
/setmenubutton - Set the menu button with custom text and URL

Example BotFather commands:
/setmenubutton - Set the menu button
Bot: @your_bot_username
Text: Open app
URL: https://solvium.ai

Additional BotFather settings you might want to configure:

1. Bot Description:
/setdescription
Bot: @your_bot_username
Description: SolviumAI - The ultimate quiz and gaming platform with crypto rewards! 
Create quizzes, challenge friends, and earn rewards. Join our community and start winning today!

2. Bot Short Description:
/setshortdescription
Bot: @your_bot_username
Short Description: 🎮 Quiz & Gaming Platform with Crypto Rewards

3. Bot Commands:
/setcommands
Bot: @your_bot_username
start - Start the bot and show main menu
createquiz - Create a new quiz
playquiz - Play available quizzes
linkwallet - Connect your wallet
unlinkwallet - Disconnect your wallet
winners - View quiz winners
leaderboards - View leaderboards

4. Bot Profile Picture:
/setuserpic
Bot: @your_bot_username
[Upload your bot's profile picture]

5. Bot Name:
/setname
Bot: @your_bot_username
Name: SolviumAI Bot

6. Bot Username:
/setusername
Bot: @your_bot_username
Username: solviumai_bot (or your preferred username)

7. Bot About:
/setabouttext
Bot: @your_bot_username
About: SolviumAI is the premier quiz and gaming platform that rewards users with cryptocurrency. 
Create engaging quizzes, challenge friends, and earn SOLV tokens for your knowledge and skills!

8. Bot Group Privacy:
/setprivacy
Bot: @your_bot_username
Privacy: Disabled (to allow the bot to work in groups)

9. Bot Inline Mode:
/setinline
Bot: @your_bot_username
Inline Text: 🎮 Play SolviumAI quizzes and earn rewards!
Inline Feedback: Enabled

10. Bot Inline Placeholder:
/setinlinefeedback
Bot: @your_bot_username
Placeholder: Search for quizzes, games, or challenges...

Web App Configuration:
To enable the web app functionality, you'll need to:

1. Deploy your frontend to a web server
2. Configure the web app URL in your bot
3. Set up the menu button to point to your web app

The web app should be accessible at: https://solvium.ai (or your domain)

Security Considerations:
- Use HTTPS for all web app URLs
- Implement proper authentication in your web app
- Validate user sessions and permissions
- Use secure WebSocket connections if needed

Environment Variables:
Make sure to set these environment variables in your deployment:

BOT_TOKEN=your_bot_token_here
WEBHOOK_URL=https://your-domain.com
WEBHOOK_LISTEN_IP=0.0.0.0
WEBHOOK_PORT=8443
WEBHOOK_URL_PATH=webhook

Testing:
1. Test the bot in private chat first
2. Test the menu button functionality
3. Test the web app integration
4. Test group chat functionality
5. Test all callback queries and navigation

Monitoring:
- Monitor bot performance and response times
- Track user engagement and feature usage
- Monitor error rates and failed requests
- Keep logs for debugging and analytics
"""

# Bot configuration constants
BOT_NAME = "SolviumAI Bot"
BOT_USERNAME = "solviumai_bot"  # Change this to your actual bot username
BOT_DESCRIPTION = "SolviumAI - The ultimate quiz and gaming platform with crypto rewards!"
BOT_SHORT_DESCRIPTION = "🎮 Quiz & Gaming Platform with Crypto Rewards"
WEB_APP_URL = "https://solvium.ai"  # Change this to your actual web app URL

# Menu button configuration
MENU_BUTTON_TEXT = "Open app"
MENU_BUTTON_URL = WEB_APP_URL

# Bot commands configuration
BOT_COMMANDS = {
    "start": "Start the bot and show main menu",
    "createquiz": "Create a new quiz",
    "playquiz": "Play available quizzes", 
    "linkwallet": "Connect your wallet",
    "unlinkwallet": "Disconnect your wallet",
    "winners": "View quiz winners",
    "leaderboards": "View leaderboards"
}

# Community links
COMMUNITY_LINKS = {
    "announcements": "https://t.me/solvium_announcements",
    "community": "https://t.me/solvium_community", 
    "gaming": "https://t.me/solvium_gaming",
    "trading": "https://t.me/solvium_trading"
}

# App download links
APP_LINKS = {
    "web_app": WEB_APP_URL,
    "mobile_android": "https://play.google.com/store/apps/solvium",
    "mobile_ios": "https://apps.apple.com/app/solvium"  # Add when available
} 