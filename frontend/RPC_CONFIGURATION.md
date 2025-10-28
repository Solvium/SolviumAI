# RPC Configuration

## Overview

The frontend application is now configured to use **Intea RPC** exclusively for all NEAR blockchain interactions.

## Configuration

### Environment Variables

Add the following to your `.env.local` file:

```bash
# Intea RPC API Key
INTEA_API_KEY=your_intea_api_key_here

# NEAR Network (optional, defaults to mainnet)
NEXT_PUBLIC_NEAR_NETWORK_ID=mainnet
```

### RPC Endpoints

- **Mainnet**: `https://rpc.intea.rs`
- **Testnet**: `https://rpc.intea.rs`

All RPC calls are routed through the local proxy at `/api/wallet?action=near-rpc` to avoid CORS issues.

## Logging

The application now includes comprehensive logging for RPC usage:

- `[RPC]` - Server-side RPC proxy logs
- `[NEAR Wallet]` - Wallet connection logs
- `[useNearWallet]` - Hook-specific RPC usage logs
- `[Account Verification]` - Account verification logs

## Files Modified

1. **`src/app/api/wallet/route.ts`**

   - Updated to use Intea RPC exclusively
   - Added comprehensive logging
   - Uses `INTEA_API_KEY` environment variable

2. **`src/lib/nearWallet.ts`**

   - Updated API key reference to Intea
   - Added detailed logging for wallet operations
   - All RPC calls go through the proxy

3. **`src/hooks/useNearWallet.ts`**
   - Added logging helper function
   - All wallet operations now log RPC usage
   - Consistent Intea RPC usage across all functions

## Usage

The RPC configuration is automatically applied when:

- Connecting wallets
- Making deposits
- Fetching balances
- Transferring tokens
- Verifying accounts

All operations will log which RPC endpoint is being used, making it easy to monitor and debug RPC usage.
