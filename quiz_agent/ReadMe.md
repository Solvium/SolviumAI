# Mental Maze Telegram Quiz Bot

A blockchain-powered quiz game bot for Telegram that leverages NEAR Protocol for reward distribution and uses AI to generate trivia questions.

## Overview

Mental Maze Bot enables engaging quiz competitions in Telegram groups where players can win NEAR tokens as rewards. Quiz creators can easily set up custom quizzes by simply specifying a topic, while our AI backend handles question generation. Winners receive their rewards directly to their linked NEAR wallets through a transparent and automated process.

## 🚀 Features

### For Quiz Creators

- **🤖 AI Quiz Generation**: Generate quiz questions about any topic using Google Gemini
- **💰 Flexible Reward Systems**:
  - Winner Takes All
  - Top 3 Rewards
  - Custom Distributions
  - Manual Text Descriptions
- **⏰ Timed Quizzes**: Set duration limits for competitive gameplay
- **🔒 Secure Funding**: Deposit quiz rewards through NEAR blockchain integration
- **📊 Real-time Leaderboards**: Track participants and scores live
- **📢 Auto-announcements**: Quiz activation notifications in group chats

### For Players

- **🔐 Secure Wallet Linking**: Connect NEAR wallets through cryptographic verification
- **💬 Private Quiz Delivery**: Answer questions through direct messages to prevent cheating
- **⌨️ Interactive UI**: Respond using inline keyboard buttons
- **💸 Automatic Rewards**: Receive winnings directly to linked wallets
- **🏆 Multiple Quiz Participation**: Join multiple active quizzes simultaneously

### Security & Anti-Cheat Features

- **🔒 Private messaging** for sensitive operations
- **⛓️ Blockchain-based** wallet verification
- **🚫 Isolated question delivery** to prevent cheating
- **🛡️ Secure database storage** with encrypted sensitive data
- **⏰ Timestamp tracking** for tiebreaker resolution

## 🛠 Technology Stack

### Core Dependencies

- **Python 3.11+**: Primary programming language
- **python-telegram-bot**: Telegram Bot API integration
- **SQLAlchemy 2.0+**: ORM for database operations
- **Redis**: Caching and session management
- **LangChain + Google Gemini**: AI-powered question generation
- **py-near**: NEAR Protocol blockchain integration
- **APScheduler**: Background task scheduling

### Database Options

- **SQLite**: Development (default)
- **PostgreSQL**: Production (recommended)

### AI & Blockchain

- **Google Gemini API**: Natural language question generation
- **NEAR Protocol**: Decentralized reward distribution
- **Redis**: Session state management and caching

## 🔧 Installation & Setup

### Prerequisites

- Python 3.11 or higher
- Redis server
- PostgreSQL (for production)
- NEAR wallet with testnet/mainnet access

### 1. Environment Setup

Clone the repository:

```bash
git clone https://github.com/Mentalmaze/near-quiz-agent
cd mental_maze_agents
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file with the following configuration:

```env
# Environment
ENVIRONMENT=development  # or production

# Telegram Bot Configuration
TELEGRAM_TOKEN=your_telegram_bot_token

# Webhook Configuration (optional - if not set, polling is used)
WEBHOOK_URL=https://yourdomain.com
WEBHOOK_LISTEN_IP=0.0.0.0
WEBHOOK_PORT=8443
WEBHOOK_URL_PATH=your_webhook_path
SSL_CERT_PATH=/path/to/cert.pem
SSL_PRIVATE_KEY_PATH=/path/to/private.key

# Google Gemini API
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# NEAR Blockchain Configuration
NEAR_RPC_ENDPOINT=https://free.rpc.fastnear.com
NEAR_WALLET_PRIVATE_KEY=your_near_private_key
NEAR_WALLET_ADDRESS=your_near_wallet.near
DEPOSIT_ADDRESS=your_deposit_wallet.near

# Database Configuration
DATABASE_URL=sqlite:///./mental_maze.db  # Development
# DATABASE_URL=postgresql://user:password@localhost:5432/mental_maze  # Production

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # optional
REDIS_SSL=false
```

### 3. Database Setup

Initialize the database:

```bash
python -c "from src.store.database import init_db; init_db()"
```

For PostgreSQL migration:

```bash
python -c "from src.store.database import migrate_schema; migrate_schema()"
```

### 4. Running the Bot

#### Development Mode (Polling)

```bash
python src/main.py
```

#### Production Mode (Webhook)

Set `WEBHOOK_URL` in your `.env` file and run:

```bash
python src/main.py
```


## 📋 Command Reference

### Group Commands

- `/createquiz` - Initiate quiz creation (redirects to DM)
- `/playquiz [quiz_id]` - Join an active quiz
- `/winners [quiz_id]` - View quiz results and leaderboard
- `/leaderboards` - Show all active quiz leaderboards

### Private Commands

- `/linkwallet` - Link your NEAR wallet
- `/unlinkwallet` - Remove linked wallet
- `/createquiz <topic>` - Create a new quiz with specified topic

## 🏗 Architecture Overview

### Project Structure

```
src/
├── agent.py                 # AI quiz generation logic
├── main.py                  # Application entry point
├── bot/
│   ├── handlers.py          # Telegram command & callback handlers
│   └── telegram_bot.py      # Bot initialization & management
├── models/
│   ├── quiz.py             # Quiz data model
│   └── user.py             # User data model
├── services/
│   ├── blockchain.py       # NEAR Protocol integration
│   ├── quiz_service.py     # Quiz business logic
│   └── user_service.py     # User management
├── store/
│   └── database.py         # Database connection & initialization
└── utils/
    ├── config.py           # Configuration management
    ├── logger.py           # Logging utilities
    ├── redis_client.py     # Redis connection & utilities
    └── telegram_helpers.py # Telegram utility functions
```

### Key Components

#### 1. Quiz Lifecycle Management

**States**: `DRAFT` → `FUNDING` → `ACTIVE` → `CLOSED`

- **DRAFT**: Quiz created, questions generated
- **FUNDING**: Awaiting creator's deposit
- **ACTIVE**: Accepting participants and answers
- **CLOSED**: Quiz ended, rewards distributed

#### 2. User Management System

- **Wallet Verification**: Cryptographic challenge-response
- **Session Management**: Redis-based state tracking
- **Answer Recording**: Timestamped submissions for tiebreakers

#### 3. Blockchain Integration

- **Deposit Monitoring**: Real-time NEAR transaction tracking
- **Wallet Validation**: On-chain signature verification
- **Reward Distribution**: Automated token transfers

#### 4. AI Question Generation

Powered by Google Gemini via LangChain:

- Topic-based question creation
- Multiple-choice format
- Configurable difficulty levels
- Context-aware generation

## 🔄 Data Flow

### Quiz Creation Flow

1. **Initiation**: User runs `/createquiz` in group
2. **Setup**: Bot redirects to private chat for configuration
3. **AI Generation**: Questions created based on topic/context
4. **Reward Configuration**: Creator sets prize structure
5. **Funding**: Creator deposits rewards to specified address
6. **Activation**: Quiz goes live, participants notified

### Participation Flow

1. **Wallet Linking**: One-time NEAR wallet verification
2. **Quiz Registration**: User joins active quiz
3. **Question Delivery**: Private message with options
4. **Answer Submission**: Timestamped response recording
5. **Scoring**: Real-time leaderboard updates
6. **Reward Distribution**: Automatic payouts to winners

## ⚡ Performance & Scaling

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

## 🛡 Security Considerations

### Data Protection

- **Encrypted Storage**: Sensitive data protection
- **Private Key Security**: Environment-based configuration
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: Abuse prevention mechanisms

### Anti-Cheat Measures

- **Private Messaging**: Isolated question delivery
- **Timestamp Verification**: Answer submission timing
- **Blockchain Verification**: Immutable transaction records
- **Session Management**: Secure state tracking

## 🚨 Error Handling

### Resilience Features

- **Automatic Retries**: Network timeout recovery
- **Graceful Degradation**: Fallback modes for service failures
- **User Feedback**: Clear error messages and guidance
- **Recovery Mechanisms**: State restoration after failures

### Common Issues & Solutions

| Issue                 | Cause                    | Solution                                |
| --------------------- | ------------------------ | --------------------------------------- |
| Bot not responding    | Invalid token or network | Check `TELEGRAM_TOKEN` and connectivity |
| Quiz creation fails   | Missing Gemini API key   | Verify `GOOGLE_GEMINI_API_KEY`          |
| Wallet linking errors | NEAR configuration       | Check NEAR RPC endpoints and keys       |
| Database errors       | Connection issues        | Verify `DATABASE_URL` and permissions   |

## 🔮 Future Enhancements

### Planned Features

- **Multi-language Support**: Internationalization
- **Advanced Analytics**: Quiz performance metrics
- **Tournament Mode**: Multi-round competitions
- **Team Challenges**: Group-based participation
- **NFT Rewards**: Blockchain-based achievement tokens

### API Roadmap

- **REST API**: External integration capabilities
- **Webhook Support**: Real-time event notifications
- **SDK Development**: Third-party bot integration
- **Mobile App**: Native application support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions:

- Create an issue in the repository
- Join our community chat
- Check the [documentation](docs/)

## 🙏 Acknowledgments

- **NEAR Protocol** for blockchain infrastructure
- **Google Gemini** for AI capabilities
- **Telegram** for bot platform
- **Open Source Community** for various dependencies
