# 🎮 Solvium - AI-Powered Gaming & Quiz Platform

A revolutionary blockchain-integrated gaming platform that combines AI-powered quiz generation, interactive games, and multi-chain wallet support. Built with Next.js frontend and Python backend, Solvium offers an engaging gaming experience with real rewards through blockchain technology.

## 🌟 Overview

Solvium is a comprehensive gaming ecosystem that features:

- **🤖 AI-Powered Quiz Generation**: Dynamic quiz creation using Google Gemini AI
- **🎯 Interactive Games**: Wordle, Logic Puzzles, Picture Puzzles, and more
- **💰 Blockchain Rewards**: Multi-chain support (NEAR, Solana, TON, EVM)
- **🏆 Wheel of Fortune**: Daily spin mechanics with token rewards
- **📱 Telegram/Discord Integration**: Quiz bot for group competitions
- **🎨 Modern UI**: Beautiful, responsive design with dark theme
- **    AI-Powered Social Wallet

## 🏗️ Architecture

### Frontend (`/frontend`)

- **Framework**: Next.js 14 with TypeScript
- **UI**: Tailwind CSS + Radix UI components
- **State Management**: Zustand + React Context
- **Blockchain**: Multi-chain wallet integration
- **Games**: Interactive gaming components

### Backend (`/quiz_agent`)

- **Language**: Python 3.11+
- **Framework**: python-telegram-bot
- **AI**: Google Gemini API via LangChain
- **Database**: SQLAlchemy + PostgreSQL/SQLite
- **Cache**: Redis for session management
- **Blockchain**: NEAR Protocol integration

## 🎮 Gaming Features

### 1. AI-Powered Quiz System

- **Dynamic Question Generation**: Uses Google Gemini AI to create unique, context-aware questions
- **Multiple Quiz Types**: Trivia, Logic Challenges, Custom Topics
- **Anti-Cheat System**: Private messaging, timestamp verification
- **Real-time Leaderboards**: Live scoring and rankings

### 2. Interactive Games

- **Wordle**: Classic word-guessing game with hints and rewards
- **Logic Puzzles**: Advanced reasoning challenges
- **Picture Puzzles**: Image arrangement games
- **Daily Challenges**: Rotating game modes

### 3. Wheel of Fortune

- **Daily Spins**: 24-hour cooldown system
- **Token Rewards**: 1-5000 token prizes
- **Visual Effects**: Animated spinning with sound
- **Multi-chain Support**: Rewards across different blockchains

### 4. Blockchain Integration

- **Multi-Chain Support**: NEAR, Solana, TON, EVM chains
- **Wallet Connection**: Seamless wallet integration
- **Token Rewards**: Real cryptocurrency rewards
- **Smart Contracts**: Automated reward distribution
### 5. AI-Powered Social wallet 
- **Bitte agent integration on Telegram and Discord wallets 

## 🤖 AI Features

### Quiz Generation

```python
# AI-powered question generation
async def generate_quiz(topic: str, num_questions: int = 1, context_text: str = None):
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        api_key=GOOGLE_API_KEY,
        temperature=0.75
    )
    # Generates unique, non-repetitive questions
```

### Features

- **Context-Aware**: Uses provided context for relevant questions
- **Multiple Formats**: Definition, application, comparison questions
- **Fact-Checking**: Ensures accuracy and avoids hallucinations
- **Difficulty Scaling**: Adjustable complexity levels
- **Anti-Repetition**: Unique questions for each generation

## 🏗️ Project Structure

```
Solvium/
├── frontend/                 # Next.js gaming platform
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   │   ├── games/       # Gaming components
│   │   │   │   ├── wordle/  # Wordle game
│   │   │   │   ├── quiz/    # Quiz games
│   │   │   │   └── puzzle/  # Puzzle games
│   │   │   ├── SolWheel.tsx # Wheel of Fortune
│   │   │   └── Profile.tsx  # User profile
│   │   ├── contexts/        # React contexts
│   │   └── hooks/           # Custom hooks
│   └── package.json
├── quiz_agent/              # Python Telegram bot
│   ├── src/
│   │   ├── agent.py         # AI quiz generation
│   │   ├── main.py          # Bot entry point
│   │   ├── bot/             # Telegram handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Data models
│   │   └── utils/           # Utilities
│   └── requirements.txt
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.11+
- Redis server
- PostgreSQL (optional, SQLite for development)
- NEAR wallet with testnet/mainnet access

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Environment variables needed:

```env
NEXT_PUBLIC_NEAR_NETWORK_ID=testnet
NEXT_PUBLIC_NEAR_NODE_URL=https://rpc.testnet.near.org
NEXT_PUBLIC_TON_NETWORK=testnet
```

### Backend Setup

```bash
cd quiz_agent
pip install -r requirements.txt
```

Create `.env` file:

```env
TELEGRAM_TOKEN=your_telegram_bot_token
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
NEAR_RPC_ENDPOINT=https://free.rpc.fastnear.com
NEAR_WALLET_PRIVATE_KEY=your_near_private_key
DATABASE_URL=sqlite:///./mental_maze.db
REDIS_HOST=localhost
REDIS_PORT=6379
```

Initialize database:

```bash
python -c "from src.store.database import init_db; init_db()"
```

Run the bot:

```bash
python src/main.py
```

## 🎯 Key Features

### 1. Multi-Chain Wallet Support

- **NEAR Protocol**: Primary blockchain integration
- **Solana**: High-performance gaming rewards
- **TON**: Telegram ecosystem integration
- **EVM Chains**: Ethereum and compatible chains

### 2. AI Gaming Intelligence

- **Dynamic Difficulty**: Adapts to player skill level
- **Personalized Content**: Tailored questions and challenges
- **Smart Hints**: AI-generated helpful hints
- **Performance Analytics**: Track player progress

### 3. Social Gaming

- **Telegram Integration**: Quiz competitions in groups
- **Leaderboards**: Real-time rankings
- **Tournament Mode**: Multi-round competitions
- **Team Challenges**: Collaborative gameplay

### 4. Reward System

- **Token Rewards**: Real cryptocurrency prizes
- **Daily Bonuses**: Regular engagement rewards
- **Achievement System**: Unlockable achievements
- **NFT Rewards**: Blockchain-based collectibles

## 🛠️ Technology Stack

### Frontend

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component library
- **Zustand**: Lightweight state management
- **React Query**: Server state management

### Backend

- **Python 3.11+**: Core programming language
- **python-telegram-bot**: Telegram Bot API
- **LangChain**: AI framework integration
- **Google Gemini**: Advanced AI capabilities
- **SQLAlchemy**: Database ORM
- **Redis**: Caching and sessions
- **APScheduler**: Background task scheduling

### Blockchain

- **NEAR Protocol**: Primary blockchain
- **Solana**: High-performance transactions
- **TON**: Telegram ecosystem
- **EVM**: Ethereum compatibility

## 🎮 Gaming Mechanics

### Quiz System

1. **Creation**: AI generates questions based on topic
2. **Participation**: Players join via Telegram or web
3. **Competition**: Real-time answering with timestamps
4. **Rewards**: Automatic distribution to winners

### Wheel of Fortune

1. **Daily Reset**: 24-hour cooldown system
2. **Spin Mechanics**: Animated wheel with sound effects
3. **Reward Tiers**: 1-5000 token prizes
4. **Claim System**: Secure token distribution

### Interactive Games

1. **Wordle**: 5-letter word guessing with hints
2. **Logic Puzzles**: Advanced reasoning challenges
3. **Picture Puzzles**: Image arrangement games
4. **Daily Challenges**: Rotating game modes

## 🔒 Security Features

### Anti-Cheat System

- **Private Messaging**: Isolated question delivery
- **Timestamp Verification**: Answer submission timing
- **Blockchain Verification**: Immutable transaction records
- **Session Management**: Secure state tracking

### Data Protection

- **Encrypted Storage**: Sensitive data protection
- **Private Key Security**: Environment-based configuration
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: Abuse prevention mechanisms

## 📊 Performance & Scaling

### Optimization Features

- **Redis Caching**: Session state and frequently accessed data
- **Connection Pooling**: Optimized database connections
- **Async Operations**: Non-blocking I/O for better concurrency
- **Background Tasks**: Scheduled operations via APScheduler

### Monitoring & Logging

- **Structured Logging**: JSON-formatted logs for analysis
- **Error Tracking**: Comprehensive exception handling
- **Performance Metrics**: Request timing and resource usage
- **Health Checks**: Database and external service monitoring

## 🚀 Deployment

### Frontend Deployment

```bash
cd frontend
npm run build
npm start
```

### Backend Deployment

```bash
cd quiz_agent
# Set up environment variables
python src/main.py
```

### Docker Support

```bash
# Frontend
docker build -t solvium-frontend ./frontend
docker run -p 3000:3000 solvium-frontend

# Backend
docker build -t solvium-backend ./quiz_agent
docker run -p 8443:8443 solvium-backend
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NEAR Protocol** for blockchain infrastructure
- **Google Gemini** for AI capabilities
- **Telegram** for bot platform
- **Open Source Community** for various dependencies

## 📞 Support

For support and questions:

- Create an issue in the repository
- Join our community chat
- Check the [documentation](docs/)

---

**🎮 Ready to play? Start spinning the wheel and test your knowledge with AI-powered quizzes!**
