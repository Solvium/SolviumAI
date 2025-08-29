# Private Key Wallet Setup

This document explains how to use the new private key wallet functionality in the Solvium wheel game.

## What's New

The application now supports **automatic wallet connection** using your NEAR private key stored in the database, eliminating the need for manual wallet connections or external wallet integrations.

## Features Added

1. **Private Key Wallet Context** (`PrivateKeyWalletContext.tsx`)

   - Manages wallet connection state
   - **Auto-connects from database** when user is authenticated
   - Provides transaction signing methods
   - Handles automatic wallet retrieval

2. **NEAR Wallet Utility** (`nearWallet.ts`)

   - Custom key store for private key usage
   - Transaction signing functions
   - Token registration utilities

3. **Wallet Connection Component** (`WalletConnect.tsx`)

   - Shows auto-connection status
   - Provides fallback manual connection if needed
   - Error handling and retry functionality

4. **Updated Wheel Component** (`Wheel.tsx`)
   - Integrated with auto-connecting private key wallet
   - Automatic token registration
   - Transaction signing for wheel claims

## How It Works

### 1. Automatic Connection

- When a user logs in, the system automatically fetches their wallet information from the database
- The private key is decrypted and used to establish a NEAR connection
- No manual input required - everything happens seamlessly

### 2. Database Integration

- Uses existing `WalletCache` table with encrypted private keys
- Leverages existing API endpoint `/api/wallet/byTelegram/{userId}?decrypt=1`
- Secure decryption using server-side encryption keys

### 3. Fallback Options

- If auto-connection fails, users can manually connect with their private key
- Error handling with retry functionality
- Clear status indicators for connection state

## User Experience

### Connected State

- Shows "✓ Auto-connected from database" indicator
- Displays connected wallet address
- Ready to use immediately

### Loading State

- Shows spinner while connecting
- Automatic connection in progress

### Error State

- Displays specific error messages
- Provides "Retry Auto-Connect" button
- Option to manually connect as fallback

### Manual Connection (Fallback)

- Form for entering account ID and private key
- Only needed if auto-connection fails
- Secure input handling

## Technical Details

### Files Modified/Created

- `frontend/src/lib/nearWallet.ts` - NEAR wallet utilities
- `frontend/src/app/contexts/PrivateKeyWalletContext.tsx` - Auto-connecting wallet context
- `frontend/src/components/WalletConnect.tsx` - Enhanced connection UI
- `frontend/src/components/Wheel.tsx` - Updated wheel component
- `frontend/src/app/layout.tsx` - Added provider

### Database Schema Used

```sql
-- Existing WalletCache table
model WalletCache {
  id                  Int      @id @default(autoincrement())
  telegramUserId      Int      @unique
  accountId           String
  publicKey           String
  encryptedPrivateKey String
  encryptionIv        String
  encryptionTag       String
  isDemo              Boolean  @default(false)
  network             String
  lastUpdated         DateTime @default(now())
  expiresAt           DateTime
}
```

### API Integration

- **Endpoint**: `/api/wallet/byTelegram/{userId}?decrypt=1`
- **Method**: GET
- **Returns**: Decrypted wallet data including private key
- **Security**: Server-side decryption with encryption keys

### Dependencies

- `near-api-js` - Already included in package.json
- No additional dependencies required

## Security Features

### Automatic Connection

- Private keys are fetched securely from database
- Server-side decryption prevents client-side key exposure
- No keys stored in browser localStorage during auto-connection

### Manual Connection (Fallback)

- Private keys stored locally only when manually entered
- Keys are never sent to our servers
- Disconnect option clears all stored credentials

### Best Practices

- Use dedicated gaming accounts
- Regularly rotate keys
- Keep minimal funds in gaming accounts
- Disconnect when not in use

## Troubleshooting

### Common Issues

1. **"No wallet found for this user"**

   - User doesn't have a wallet registered in the database
   - Contact support to set up wallet registration

2. **"Failed to decrypt private key"**

   - Encryption key mismatch or corruption
   - Contact support for key recovery

3. **"Wallet not connected" error**

   - Auto-connection failed
   - Try manual connection as fallback
   - Check network connectivity

4. **Transaction failures**
   - Check account has sufficient NEAR for gas fees
   - Verify token registration status
   - Ensure correct network (mainnet/testnet)

### Getting Help

If you encounter issues:

1. Check the browser console for error messages
2. Try the "Retry Auto-Connect" button
3. Use manual connection as fallback
4. Contact support with specific error details

## Migration from Old System

### For Existing Users

- No action required - auto-connection works immediately
- Existing wallet data in database is used automatically
- Enhanced security with server-side decryption

### For New Users

- Wallet registration through existing system
- Automatic connection on first login
- Seamless integration with existing authentication

## Support

For technical support:

1. Check browser console for detailed error messages
2. Verify your network connection
3. Ensure you're using the correct network (mainnet/testnet)
4. Contact support with specific error details and user ID
