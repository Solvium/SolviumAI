# FastNear Testnet Support - Bug Fix

## 🐛 Issue Identified

From the logs:
```
FastNearService initialized for testnet network 
(API: https://test.api.fastnear.com, RPC: https://rpc.mainnet.fastnear.com)
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                            WRONG! Should be testnet RPC
```

**Problem:** FastNearService was using **mainnet RPC URL** for **testnet accounts**, causing "Server error" when trying to query testnet balances.

---

## ✅ Fix Applied

### 1. Added Testnet RPC URL to Config (`src/utils/config.py`)

**Before:**
```python
FASTNEAR_MAINNET_RPC_URL = "https://rpc.mainnet.fastnear.com"
FASTNEAR_MAINNET_API_URL = "https://api.fastnear.com"
FASTNEAR_TESTNET_API_URL = "https://test.api.fastnear.com"
# Missing: FASTNEAR_TESTNET_RPC_URL
```

**After:**
```python
FASTNEAR_MAINNET_RPC_URL = "https://rpc.mainnet.fastnear.com"
FASTNEAR_TESTNET_RPC_URL = "https://rpc.testnet.fastnear.com"  # ✅ ADDED
FASTNEAR_MAINNET_API_URL = "https://api.fastnear.com"
FASTNEAR_TESTNET_API_URL = "https://test.api.fastnear.com"
```

### 2. Updated FastNearService to Use Correct RPC URL (`src/services/fastnear_service.py`)

**Before:**
```python
def __init__(self):
    self.mainnet_rpc_url = Config.FASTNEAR_MAINNET_RPC_URL
    # Always used mainnet_rpc_url regardless of network!
    
def _get_rpc_url_with_auth(self):
    return f"{self.mainnet_rpc_url}?apiKey={self.api_key}"  # ❌ WRONG
```

**After:**
```python
def __init__(self):
    self.mainnet_rpc_url = Config.FASTNEAR_MAINNET_RPC_URL
    self.testnet_rpc_url = Config.FASTNEAR_TESTNET_RPC_URL  # ✅ ADDED
    
    # Determine network and set correct RPC URL
    self.network = Config.get_current_network()
    if self.network == "mainnet":
        self.rpc_url = self.mainnet_rpc_url
        self.api_base_url = self.mainnet_api_url
    else:
        self.rpc_url = self.testnet_rpc_url  # ✅ Now uses testnet RPC
        self.api_base_url = self.testnet_api_url
    
def _get_rpc_url_with_auth(self):
    return f"{self.rpc_url}?apiKey={self.api_key}"  # ✅ Uses correct URL
```

---

## 🎯 What Changed

### Network-Aware RPC URL Selection

The service now correctly selects RPC URLs based on network:

| Network | RPC URL | API URL |
|---------|---------|---------|
| **Mainnet** | `https://rpc.mainnet.fastnear.com` | `https://api.fastnear.com` |
| **Testnet** | `https://rpc.testnet.fastnear.com` | `https://test.api.fastnear.com` |

### Log Output Now Shows Correct URLs

**Before:**
```
FastNearService initialized for testnet network 
(API: https://test.api.fastnear.com, RPC: https://rpc.mainnet.fastnear.com)
                                            ^^^^^^ WRONG - mainnet RPC
```

**After:**
```
FastNearService initialized for testnet network 
(API: https://test.api.fastnear.com, RPC: https://rpc.testnet.fastnear.com)
                                            ^^^^^^ CORRECT - testnet RPC
```

---

## ✅ Expected Behavior After Fix

### For Testnet Accounts (like `unicornaede.kindpuma8958.testnet`)

**Before Fix:**
```
❌ FastNear RPC error: Server error
❌ Returns "0 NEAR" (incorrect)
❌ Falls back to legacy method
```

**After Fix:**
```
✅ Uses testnet RPC URL
✅ Returns correct balance
✅ No server errors
✅ 30s cache works properly
```

### For Mainnet Accounts

No change - already worked correctly.

---

## 🧪 Testing

To verify the fix works:

```bash
# Restart the bot
# Then check balance for a testnet account
```

**Expected logs:**
```
FastNearService initialized for testnet network 
(API: https://test.api.fastnear.com, RPC: https://rpc.testnet.fastnear.com)

Fetching fresh balance for unicornaede.kindpuma8958.testnet from FastNear

Successfully got balance from FastNear for unicornaede.kindpuma8958.testnet: X.XXXX NEAR
```

**No errors** should appear!

---

## 📝 Files Modified

1. ✅ `src/utils/config.py` - Added `FASTNEAR_TESTNET_RPC_URL`
2. ✅ `src/services/fastnear_service.py` - Updated to use network-aware RPC URL

---

## 🎉 Issue Resolved

The bot will now correctly:
- Use **testnet RPC** for testnet accounts
- Use **mainnet RPC** for mainnet accounts
- Get accurate balance data without server errors
- Benefit from 30s caching on both networks

---

**Status:** ✅ **FIXED** - Ready for testing with testnet accounts
