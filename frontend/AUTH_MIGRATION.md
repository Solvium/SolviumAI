# Authentication System Migration Guide

## Overview

This document outlines the migration from the complex multi-chain authentication system to a simplified Telegram and Gmail-focused authentication system with extensibility for future providers.

## Changes Made

### 1. New Authentication Architecture

#### Before (Complex Multi-Chain)

```typescript
// Old: Multiple contexts and hooks
import { useMultiLoginContext } from "./contexts/MultiLoginContext";
import { useMultiChain } from "./hooks/useMultiChain";
import { useWallet } from "./contexts/WalletContext";

const { userData, loginWithTelegram, loginWithGoogle, loginWithWallet } =
  useMultiLoginContext();
const { activeChain, connectWallet } = useMultiChain();
const {
  state: { accountId, isConnected },
} = useWallet();
```

#### After (Simplified)

```typescript
// New: Single auth context
import { useAuth } from "./contexts/AuthContext";

const { user, loginWithTelegram, loginWithGoogle, logout } = useAuth();
```

### 2. Component Updates Required

#### Profile Component

```typescript
// Before
const {
  userData: userDetails,
  userTasks,
  tasks,
  multiplier,
} = useMultiLoginContext();

// After
const { user: userDetails, refreshUser } = useAuth();
```

#### LeaderBoard Component

```typescript
// Before
const { userData: user, leader } = useMultiLoginContext();

// After
const { user } = useAuth();
const [leader, setLeader] = useState<any[]>([]);
```

### 3. New API Routes

#### Authentication Endpoints

- `POST /api/auth/telegram` - Telegram login
- `POST /api/auth/google` - Google login
- `GET /api/auth/me` - Check auth status
- `POST /api/auth/logout` - Logout

#### Old Routes to Remove

- `POST /api/user` (old multi-login endpoint)
- `POST /api/auth/wallet` (old wallet auth)
- `POST /api/auth/nonce` (old nonce generation)

### 4. Extensibility System

#### Adding New Auth Providers

```typescript
import { registerCustomProvider } from "@/app/auth/providers/AuthProviderRegistry";

// Register a new provider
registerCustomProvider("discord", {
  name: "Discord",
  icon: "🎮",
  color: "#7289da",
  enabled: true,
  loginHandler: async (data) => {
    const response = await fetch("/api/auth/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },
});
```

## Migration Steps

### Step 1: Update Dependencies

```bash
# Remove unused wallet dependencies
npm uninstall @near-wallet-selector/core @near-wallet-selector/meteor-wallet @near-wallet-selector/modal-ui @near-wallet-selector/my-near-wallet @ton/core @ton/crypto @ton/ton @tonconnect/ui-react @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets @solana/web3.js @solana/spl-token

# Keep essential dependencies
npm install @react-oauth/google @twa-dev/sdk jwt-decode
```

### Step 2: Update Components

1. Replace `useMultiLoginContext` with `useAuth`
2. Update user data references from `userData` to `user`
3. Remove wallet-specific logic from components
4. Update API calls to use new endpoints

### Step 3: Update API Routes

1. Create new auth routes in `/api/auth/`
2. Remove old multi-login routes
3. Update database schema if needed

### Step 4: Test Authentication Flow

1. Test Telegram login in Telegram Web App
2. Test Google login in browser
3. Verify logout functionality
4. Test auth status persistence

## Benefits of New System

### 1. Simplified Architecture

- Single authentication context
- Clear separation of concerns
- Easier to maintain and debug

### 2. Better User Experience

- Faster login process
- Cleaner UI with fewer options
- Better error handling

### 3. Extensibility

- Easy to add new auth providers
- Plugin-based architecture
- Configuration-driven setup

### 4. Performance

- Reduced bundle size
- Fewer dependencies
- Faster initial load

## Future Enhancements

### 1. Additional Providers

- Discord authentication
- GitHub authentication
- Apple Sign-In
- Facebook authentication

### 2. Advanced Features

- Multi-factor authentication
- Account linking
- Social login preferences
- Custom auth flows

### 3. Security Enhancements

- JWT token refresh
- Session management
- Rate limiting
- Audit logging

## Troubleshooting

### Common Issues

#### 1. Telegram Web App Not Available

```typescript
// Check if running in Telegram
const isTelegramAvailable = window?.Telegram?.WebApp;
if (!isTelegramAvailable) {
  // Fallback to Google login
}
```

#### 2. Google OAuth Configuration

```typescript
// Ensure Google Client ID is configured
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
  console.error("Google Client ID not configured");
}
```

#### 3. Cookie Issues

```typescript
// Check cookie settings
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 30 * 24 * 60 * 60, // 30 days
};
```

## Support

For issues or questions about the migration:

1. Check the troubleshooting section
2. Review the API documentation
3. Test in development environment
4. Contact the development team
