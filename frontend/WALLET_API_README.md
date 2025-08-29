# Secure SolviumAI Wallet API Integration

This implementation provides a secure way to interact with the SolviumAI wallet API at `https://solviumaiq.onrender.com/`.

## Features

- **Secure API Client**: Type-safe, error-handled client for SolviumAI API
- **Request Validation**: Input validation and sanitization
- **Error Handling**: Comprehensive error handling with custom error types
- **Timeout Protection**: Request timeouts to prevent hanging requests
- **Health Checks**: API health monitoring
- **React Integration**: Custom hooks and components for easy frontend integration
- **Auth Context Integration**: Automatic wallet data fetching with user authentication

## API Endpoints

### 1. Check Wallet Information

- **URL**: `POST /api/wallet/check`
- **Body**: `{ "telegram_user_id": 1447332196 }`
- **Response**: Wallet information including address and balance

### 2. Health Check

- **URL**: `GET /api/wallet/check`
- **Response**: API health status

## Usage Examples

### Using the Auth Context (Recommended)

The wallet functionality is now integrated into the auth context, automatically fetching wallet data when user data is retrieved.

```typescript
import { useAuth } from "@/app/contexts/AuthContext";

function MyComponent() {
  const { user, refreshWalletData, getWalletData } = useAuth();

  // Access wallet data from user object
  if (user?.solviumWallet) {
    console.log("Wallet address:", user.solviumWallet.wallet?.address);
    console.log("Balance:", user.solviumWallet.wallet?.balance);
  }

  // Manually refresh wallet data
  const handleRefresh = async () => {
    await refreshWalletData();
  };

  // Get wallet data for a specific Telegram user
  const handleGetWallet = async (telegramUserId: number) => {
    const walletData = await getWalletData(telegramUserId);
    if (walletData) {
      console.log("Wallet data:", walletData);
    }
  };

  return (
    <div>
      {user?.solviumWallet ? (
        <div>
          <h3>Wallet Address: {user.solviumWallet.wallet?.address}</h3>
          <p>Balance: {user.solviumWallet.wallet?.balance}</p>
          <button onClick={handleRefresh}>Refresh Wallet</button>
        </div>
      ) : (
        <p>No wallet data available</p>
      )}
    </div>
  );
}
```

### Using the Wallet Display Component

```typescript
import WalletDisplay from "@/components/WalletDisplay";

function App() {
  return (
    <div>
      <h1>Wallet Management</h1>
      <WalletDisplay />
    </div>
  );
}
```

### Using the API Client Directly

```typescript
import { solviumWalletAPI, getWalletInfo } from "@/lib/crypto";

// Check wallet information
const walletInfo = await getWalletInfo(1447332196);
if (walletInfo) {
  console.log("Wallet address:", walletInfo.wallet?.address);
  console.log("Balance:", walletInfo.wallet?.balance);
}
```

### Using the React Hook

```typescript
import { useWalletCheck } from "@/app/hooks/useWalletCheck";

function MyComponent() {
  const { checkWallet, isLoading, error } = useWalletCheck();

  const handleCheck = async () => {
    const result = await checkWallet(1447332196);
    if (result) {
      console.log("Wallet found:", result);
    }
  };

  return (
    <div>
      <button onClick={handleCheck} disabled={isLoading}>
        {isLoading ? "Checking..." : "Check Wallet"}
      </button>
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Auth Context Integration

The wallet functionality is now seamlessly integrated into the authentication context:

### Automatic Wallet Fetching

- When a user logs in or when `checkAuthStatus()` is called, wallet data is automatically fetched if a Telegram ID is available
- When `refreshUser()` is called, wallet data is refreshed along with user data
- Wallet data is stored in `user.solviumWallet` property

### New Auth Context Methods

```typescript
interface AuthContextType {
  // ... existing methods

  // Wallet methods
  getWalletData: (
    telegramUserId: number
  ) => Promise<WalletCheckResponse | null>;
  refreshWalletData: () => Promise<void>;
}
```

### User Interface Updates

The `User` interface now includes wallet data:

```typescript
interface User {
  // ... existing properties
  solviumWallet?: WalletCheckResponse; // New field for SolviumAI wallet data
}
```

## Security Features

### 1. Input Validation

- Validates Telegram user ID is a positive integer
- Prevents injection attacks through input sanitization
- Type checking for all API parameters

### 2. Request Security

- Request timeouts (10s for wallet checks, 5s for health checks)
- Proper HTTP headers with User-Agent identification
- Optional API key authentication support

### 3. Error Handling

- Custom error types for different failure scenarios
- Graceful degradation when API is unavailable
- Detailed error logging for debugging

### 4. Response Validation

- Validates API response structure
- Handles malformed responses gracefully
- Type-safe response handling

## Environment Variables

Add these to your `.env.local` file:

```bash
# SolviumAI API Configuration
SOLVIUM_API_BASE_URL=https://solviumaiq.onrender.com
SOLVIUM_API_KEY=your_api_key_here  # Optional
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "wallet": {
    "address": "wallet_address_here",
    "balance": "100.50",
    "currency": "NEAR"
  },
  "message": "Wallet found successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE" // Optional
}
```

## Testing the Implementation

### 1. Test the API Endpoint

```bash
curl -X POST http://localhost:3000/api/wallet/check \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": 1447332196}'
```

### 2. Test Health Check

```bash
curl http://localhost:3000/api/wallet/check
```

### 3. Test with Invalid Input

```bash
curl -X POST http://localhost:3000/api/wallet/check \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": "invalid"}'
```

### 4. Test Auth Context Integration

```typescript
// In your React component
const { user } = useAuth();
console.log("User wallet data:", user?.solviumWallet);
```

## Error Codes

- `400`: Invalid input (bad request)
- `404`: Wallet not found
- `500`: Internal server error or API unavailable
- `502`: Bad gateway (external API issues)

## Best Practices

1. **Use the Auth Context**: Prefer using the auth context for wallet data instead of direct API calls
2. **Handle errors gracefully** in your UI
3. **Use the React hooks** for consistent state management
4. **Monitor API health** before making requests
5. **Implement retry logic** for transient failures
6. **Log errors** for debugging and monitoring
7. **Refresh wallet data** when needed using `refreshWalletData()`

## Troubleshooting

### Common Issues

1. **API Timeout**: Check if SolviumAI API is responding
2. **Invalid User ID**: Ensure Telegram user ID is a positive integer
3. **Network Errors**: Check internet connectivity and firewall settings
4. **CORS Issues**: Ensure proper CORS configuration if calling from browser
5. **Missing Telegram ID**: Ensure user has a valid Telegram ID in the database

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

This will provide detailed console logs for API requests and responses.

### Database Schema Requirements

Ensure your user table includes a `telegramId` field:

```sql
ALTER TABLE users ADD COLUMN telegramId VARCHAR(255);
```

This field is required for the automatic wallet data fetching to work properly.
