# Secure Wallet Caching System

This document explains the secure wallet caching system that handles the new SolviumAI wallet response format with private keys.

## Overview

The secure wallet caching system provides:

- **Encrypted Storage**: Private keys are encrypted using AES-256-GCM
- **Automatic Caching**: Wallet data is cached for 30 minutes to reduce API calls
- **Secure Retrieval**: Private keys are decrypted only when needed
- **Database Integration**: Uses Prisma with PostgreSQL for persistent storage

## New Wallet Response Format

The SolviumAI API now returns wallet data in this format:

```json
{
  "has_wallet": true,
  "message": "Wallet found for user 1447332196. Private key decrypted successfully.",
  "wallet_info": {
    "account_id": "demona030.kindpuma8958.testnet",
    "public_key": "ed25519:hC1rJPkwGGU8KYL2XWBtjZp8YWeFtQrrkRQR72WK8Le",
    "private_key": "ed25519:5xeVepE4FtFGMd7oCs2oEJVDqniwncVyFxRFSPi7hCCyTumUFGKBxgmmAjNoFxKrqZjM41j8VvwqPdfFeLbDqJvA",
    "is_demo": false,
    "network": "testnet"
  }
}
```

## Security Features

### 1. Private Key Encryption

- Private keys are encrypted using AES-256-GCM before storage
- Each encryption uses a unique IV (Initialization Vector)
- Authentication tags prevent tampering
- Encryption key is stored in environment variables

### 2. Database Schema

```sql
CREATE TABLE wallet_cache (
  id SERIAL PRIMARY KEY,
  telegram_user_id INTEGER UNIQUE NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  encryption_iv VARCHAR(255) NOT NULL,
  encryption_tag VARCHAR(255) NOT NULL,
  is_demo BOOLEAN DEFAULT FALSE,
  network VARCHAR(50) NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

### 3. Cache Expiration

- Wallet data expires after 30 minutes
- Expired data is automatically cleaned up
- Force refresh bypasses cache when needed

## Implementation

### 1. Updated Types

```typescript
export interface WalletInfo {
  account_id: string;
  public_key: string;
  private_key: string;
  is_demo: boolean;
  network: string;
}

export interface WalletCheckResponse {
  has_wallet: boolean;
  message: string;
  wallet_info?: WalletInfo;
  error?: string;
}

export interface SecureWalletData {
  telegramUserId: number;
  walletInfo: WalletInfo;
  encryptedPrivateKey: string;
  encryptionIv: string;
  encryptionTag: string;
  lastUpdated: Date;
  expiresAt: Date;
}
```

### 2. Secure Storage Class

```typescript
export class SecureWalletStorage {
  private encryptionKey: Buffer;

  constructor() {
    const key = process.env.WALLET_ENCRYPTION_KEY;
    if (!key) {
      throw new Error("WALLET_ENCRYPTION_KEY environment variable is required");
    }
    this.encryptionKey = parseEncryptionKey(key) || Buffer.alloc(32);
  }

  // Encrypt private key before storage
  private encryptWalletData(data: string): {
    encrypted: string;
    iv: string;
    tag: string;
  };

  // Decrypt private key when needed
  private decryptWalletData(encrypted: string, iv: string, tag: string): string;

  // Store wallet data securely
  async storeWalletData(
    telegramUserId: number,
    walletInfo: WalletInfo
  ): Promise<void>;

  // Retrieve wallet data
  async getWalletData(telegramUserId: number): Promise<WalletInfo | null>;

  // Clear wallet data
  async clearWalletData(telegramUserId: number): Promise<void>;
}
```

### 3. Enhanced API Client

```typescript
export class SolviumWalletAPI {
  private secureStorage: SecureWalletStorage;

  // Check wallet with caching
  async checkWallet(
    telegramUserId: number,
    forceRefresh: boolean = false
  ): Promise<WalletCheckResponse>;

  // Store wallet info securely
  async storeWalletInfo(
    telegramUserId: number,
    walletInfo: WalletInfo
  ): Promise<void>;

  // Get cached wallet info
  async getWalletInfo(telegramUserId: number): Promise<WalletInfo | null>;

  // Clear cached wallet info
  async clearWalletInfo(telegramUserId: number): Promise<void>;
}
```

## Usage Examples

### 1. Basic Wallet Check (with caching)

```typescript
import { getWalletInfo } from "@/lib/crypto";

// Get wallet data (uses cache if available)
const walletData = await getWalletInfo(1447332196);

if (walletData?.has_wallet && walletData.wallet_info) {
  console.log("Account ID:", walletData.wallet_info.account_id);
  console.log("Public Key:", walletData.wallet_info.public_key);
  console.log("Private Key:", walletData.wallet_info.private_key); // Decrypted automatically
  console.log("Network:", walletData.wallet_info.network);
}
```

### 2. Force Refresh (bypass cache)

```typescript
// Force refresh from API
const walletData = await getWalletInfo(1447332196, true);
```

### 3. Using Auth Context

```typescript
import { useAuth } from "@/app/contexts/AuthContext";

function MyComponent() {
  const { user, getWalletData, refreshWalletData } = useAuth();

  const handleGetWallet = async () => {
    if (user?.telegramId) {
      const telegramUserId = parseInt(user.telegramId);
      const walletData = await getWalletData(telegramUserId);

      if (walletData?.has_wallet) {
        console.log("Wallet found:", walletData.wallet_info);
      }
    }
  };

  const handleRefresh = async () => {
    await refreshWalletData();
  };

  return (
    <div>
      <button onClick={handleGetWallet}>Get Wallet</button>
      <button onClick={handleRefresh}>Refresh Wallet</button>
    </div>
  );
}
```

### 4. Using the Secure Wallet Manager Component

```typescript
import SecureWalletManager from "@/components/SecureWalletManager";

function App() {
  return (
    <div>
      <h1>Wallet Management</h1>
      <SecureWalletManager />
    </div>
  );
}
```

## Environment Variables

Add these to your `.env.local` file:

```bash
# Wallet encryption key (32 bytes, base64 or hex)
WALLET_ENCRYPTION_KEY=your_32_byte_encryption_key_here

# SolviumAI API Configuration
SOLVIUM_API_BASE_URL=https://solviumaiq.onrender.com
SOLVIUM_API_KEY=your_api_key_here  # Optional
```

## Database Setup

### 1. Run Prisma Migration

```bash
# Generate migration for new WalletCache model
npx prisma migrate dev --name add_wallet_cache

# Apply migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 2. Verify Schema

```bash
# Check database schema
npx prisma db pull

# View database in Prisma Studio
npx prisma studio
```

## Security Best Practices

### 1. Encryption Key Management

- Use a strong 32-byte encryption key
- Store key in environment variables
- Rotate keys periodically
- Never commit keys to version control

### 2. Private Key Handling

- Never log private keys
- Decrypt only when needed
- Clear from memory after use
- Use secure display components

### 3. Cache Management

- Set appropriate expiration times
- Implement cache cleanup
- Monitor cache usage
- Handle cache failures gracefully

### 4. API Security

- Validate all inputs
- Use HTTPS for all requests
- Implement rate limiting
- Monitor for suspicious activity

## Error Handling

### Common Error Scenarios

1. **Encryption Key Missing**

```typescript
// Error: WALLET_ENCRYPTION_KEY environment variable is required
// Solution: Set the environment variable
```

2. **Cache Expired**

```typescript
// Wallet data expires after 30 minutes
// Solution: Use force refresh or wait for automatic refresh
```

3. **Database Connection Failed**

```typescript
// Fallback to in-memory cache
// Solution: Check database connection and credentials
```

4. **Decryption Failed**

```typescript
// Invalid encryption key or corrupted data
// Solution: Clear cache and re-fetch from API
```

## Performance Considerations

### 1. Cache Hit Rate

- Monitor cache hit rates
- Adjust cache duration based on usage patterns
- Implement cache warming for frequently accessed wallets

### 2. Database Performance

- Index on `telegram_user_id` for fast lookups
- Implement connection pooling
- Monitor query performance

### 3. API Rate Limiting

- Respect API rate limits
- Implement exponential backoff
- Use caching to reduce API calls

## Monitoring and Logging

### 1. Cache Metrics

```typescript
// Log cache operations
console.log(`[WalletCache] ${operation} for user ${telegramUserId}`);
```

### 2. Security Events

```typescript
// Log security-related events
console.warn(`[WalletSecurity] ${event} for user ${telegramUserId}`);
```

### 3. Performance Metrics

```typescript
// Track API response times
console.log(`[WalletAPI] Response time: ${responseTime}ms`);
```

## Troubleshooting

### 1. Cache Not Working

- Check database connection
- Verify Prisma client generation
- Check environment variables

### 2. Encryption Errors

- Verify encryption key format
- Check key length (32 bytes)
- Ensure consistent key across deployments

### 3. API Integration Issues

- Verify API endpoint URL
- Check authentication headers
- Monitor API response format changes

## Migration Guide

### From Old Wallet System

1. **Update Types**: Replace old wallet types with new ones
2. **Update API Calls**: Use new response format
3. **Add Caching**: Implement secure caching
4. **Test Security**: Verify encryption/decryption
5. **Monitor Performance**: Track cache effectiveness

### Database Migration

```sql
-- Add telegramId to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(255);

-- Create wallet_cache table
CREATE TABLE IF NOT EXISTS wallet_cache (
  -- ... schema as defined above
);
```

This secure wallet caching system provides enterprise-grade security while maintaining excellent performance through intelligent caching.

