const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

console.log("🔐 Setting up environment variables for secure login system...\n");

// Generate secure secrets
const jwtAccessSecret = crypto.randomBytes(32).toString("hex");
const jwtRefreshSecret = crypto.randomBytes(32).toString("hex");
const sessionSecret = crypto.randomBytes(32).toString("hex");
const nextAuthSecret = crypto.randomBytes(32).toString("hex");
const jwtSecret = crypto.randomBytes(32).toString("hex");

// Generate wallet encryption key (32 bytes base64 encoded)
const walletEncryptionKey = crypto.randomBytes(32).toString("base64");

const envContent = `# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/solvium_db"

# JWT Configuration
JWT_SECRET="${jwtSecret}"
JWT_ACCESS_SECRET="${jwtAccessSecret}"
JWT_REFRESH_SECRET="${jwtRefreshSecret}"

# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_BOT_USERNAME="your-telegram-bot-username"

# Security Configuration
NEXTAUTH_SECRET="${nextAuthSecret}"
NEXTAUTH_URL="http://localhost:6001"

# Rate Limiting Configuration
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_WINDOW_MS="900000" # 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"

# Session Configuration
SESSION_SECRET="${sessionSecret}"
SESSION_MAX_AGE="604800" # 7 days in seconds

# CORS Configuration
CORS_ORIGIN="http://localhost:6001"
CORS_CREDENTIALS="true"

# Logging Configuration
LOG_LEVEL="info"
LOG_FORMAT="json"

# Production Configuration
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:6001"

# Wallet Encryption Key (32 bytes base64 encoded)
WALLET_ENCRYPTION_KEY="${walletEncryptionKey}"

# Blockchain Configuration
BLOCKCHAIN_NET="testnet"
`;

const envPath = path.join(__dirname, ".env.local");

try {
  fs.writeFileSync(envPath, envContent);
  console.log("✅ Environment file created: .env.local");
  console.log("📝 Please update the following values:");
  console.log("   - DATABASE_URL: Your PostgreSQL connection string");
  console.log("   - GOOGLE_CLIENT_ID: Your Google OAuth client ID");
  console.log("   - GOOGLE_CLIENT_SECRET: Your Google OAuth client secret");
  console.log("   - TELEGRAM_BOT_TOKEN: Your Telegram bot token");
  console.log("   - TELEGRAM_BOT_USERNAME: Your Telegram bot username");
  console.log("\n🔑 Secure secrets have been generated automatically:");
  console.log("   - JWT_SECRET:", jwtSecret);
  console.log("   - WALLET_ENCRYPTION_KEY:", walletEncryptionKey);
  console.log("\n🚀 You can now run the application with secure authentication!");
} catch (error) {
  console.error("❌ Failed to create environment file:", error.message);
  console.log(
    "\n📋 Please create .env.local manually with the following content:"
  );
  console.log(envContent);
}
