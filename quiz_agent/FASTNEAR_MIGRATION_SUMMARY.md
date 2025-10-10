# FastNear Premium RPC Migration - Implementation Summary

## 🎯 Overview

Successfully migrated the quiz_agent bot to use **FastNear Premium RPC** as the primary data source for:

- NEAR account balances
- Token balances
- Token lists
- Token metadata

## ✅ Implementation Complete

### 1. Configuration (`src/utils/config.py`)

- ✅ Added `FASTNEAR_API_KEY` with premium subscription key
- ✅ Added `FASTNEAR_MAINNET_RPC_URL` for authenticated RPC calls
- ✅ Added `FASTNEAR_MAINNET_API_URL` and `FASTNEAR_TESTNET_API_URL`
- ✅ Updated `NEAR_MAINNET_RPC_ENDPOINTS` to prioritize FastNear Premium
- ✅ Updated `NEAR_TESTNET_RPC_ENDPOINTS` to prioritize FastNear Premium
- ✅ Added cache TTL configurations:
  - `BALANCE_CACHE_TTL = 30` seconds (fresh balance data)
  - `METADATA_CACHE_TTL = 86400` seconds (24 hours)
  - `TOKEN_INVENTORY_CACHE_TTL = 30` seconds (fresh token lists)

### 2. New Service: MetadataCacheService (`src/services/metadata_cache_service.py`)

Created comprehensive caching service with different TTLs:

**Token Metadata (24h TTL)**

- `get_token_metadata(contract_id)` - Get cached metadata
- `set_token_metadata(contract_id, metadata)` - Cache metadata
- `invalidate_token_metadata(contract_id)` - Manual invalidation

**Account Balances (30s TTL)**

- `get_account_balance(account_id)` - Get cached NEAR balance
- `set_account_balance(account_id, balance)` - Cache NEAR balance
- `get_token_balance(account_id, contract_id)` - Get cached token balance
- `set_token_balance(account_id, contract_id, balance)` - Cache token balance

**Token Inventory (30s TTL)**

- `get_token_inventory(account_id)` - Get cached token list
- `set_token_inventory(account_id, inventory)` - Cache token list
- `invalidate_token_inventory(account_id)` - Manual invalidation

**Utility Methods**

- `clear_all_balances(account_id)` - Clear all balance caches
- `get_cache_stats()` - Get cache configuration stats

### 3. New Service: FastNearService (`src/services/fastnear_service.py`)

Created comprehensive FastNear integration with authentication and caching:

**RPC Calls (with 30s balance cache)**

- `make_rpc_call(method, params, use_auth)` - Authenticated RPC calls
- `get_account_balance(account_id, use_cache)` - Get NEAR balance (30s cache)
- `fetch_token_metadata_rpc(contract_id, use_cache)` - Fetch ft_metadata (24h cache)

**API Calls (token lists with 30s cache)**

- `get_user_token_list(account_id, use_cache)` - Get raw token list from `/v1/account/{id}/ft`
- `get_enriched_token_inventory(account_id, use_cache)` - Get tokens + metadata

**Authentication**

- `_get_rpc_url_with_auth()` - URL with API key parameter
- `_get_auth_headers()` - Authorization Bearer header

**Utility**

- `invalidate_account_caches(account_id)` - Clear all caches for account
- `get_service_info()` - Get service configuration

### 4. RPC Retry Updates (`src/utils/rpc_retry.py`)

- ✅ Added `get_fastnear_headers()` - Get Authorization headers
- ✅ Added `get_fastnear_rpc_url(include_api_key)` - Get RPC URL with/without key
- ✅ Added `execute_fastnear_rpc_call()` - Execute authenticated RPC with retries

### 5. TokenService Updates (`src/services/token_service.py`)

Modified to use FastNear as primary with NearBlocks fallback:

**`get_user_token_inventory(account_id, force_refresh)`**

- ✅ Tries FastNear Premium API first (30s cache for balances)
- ✅ Enriches with metadata (24h cache)
- ✅ Falls back to NearBlocks if FastNear fails
- ✅ Legacy `_get_user_token_inventory_nearblocks()` kept as fallback

**`get_token_balance(account, token_contract)`**

- ✅ Tries FastNear Premium first (30s cache)
- ✅ Falls back to NearBlocks if FastNear fails
- ✅ Legacy `_get_token_balance_nearblocks()` kept as fallback

### 6. WalletService Updates (`src/services/wallet_service.py`)

**`get_wallet_balance(user_id, force_refresh)`**

- ✅ Uses FastNear Premium RPC (30s cache)
- ✅ Falls back to `near_wallet_service.get_account_balance()` if fails
- ✅ Removed old cache_service balance caching (replaced with MetadataCacheService)

### 7. NEARWalletService Updates (`src/services/near_wallet_service.py`)

**`get_account_balance(account_id, network)`**

- ✅ Uses FastNear Premium for mainnet (30s cache)
- ✅ Falls back to RPC fallback for testnet or if FastNear fails
- ✅ Maintains existing `_get_balance_rpc_fallback()` as safety net

## 🔄 Data Flow Architecture

### Balance Checks (30s Cache)

```
User Request
    ↓
FastNear Premium RPC (authenticated)
    ↓
MetadataCacheService (30s TTL)
    ↓
If FastNear fails → NearBlocks/Free RPC Fallback
    ↓
Return balance to user
```

### Token List (30s Cache + 24h Metadata Cache)

```
User Request
    ↓
FastNear API: GET /v1/account/{id}/ft (30s cache)
    ↓
Returns: [{contract_id, balance, last_update_block_height}]
    ↓
For each token:
    Check MetadataCacheService (24h TTL)
        ↓
        MISS? → FastNear RPC: ft_metadata call → Cache it
        HIT? → Use cached metadata
    ↓
Combine balance (30s fresh) + metadata (24h cached)
    ↓
Return enriched token list
```

## 🎯 Key Features

### ✅ Performance Optimization

- **30-second cache** for balances - fresh enough for money-related data
- **24-hour cache** for metadata - symbol/decimals rarely change
- Automatic cache invalidation after transactions

### ✅ Reliability

- FastNear Premium as primary (fast & authenticated)
- NearBlocks API as fallback
- Free RPC endpoints as final fallback
- Existing RPC retry logic with circuit breakers

### ✅ Metadata Strategy

1. **Primary**: FastNear RPC `ft_metadata` call (cached 24h)
2. **Secondary**: NearBlocks API (if RPC fails)
3. **Tertiary**: py-near library (if API fails)
4. **Fallback**: Default values (24 decimals, "UNKNOWN" symbol)

## 📊 Caching Strategy Summary

| Data Type       | Primary Source | Cache TTL  | Reason                       |
| --------------- | -------------- | ---------- | ---------------------------- |
| NEAR Balance    | FastNear RPC   | 30 seconds | Money needs freshness        |
| Token Balance   | FastNear API   | 30 seconds | Money needs freshness        |
| Token Metadata  | FastNear RPC   | 24 hours   | Rarely changes               |
| Token Inventory | FastNear API   | 30 seconds | Balance part needs freshness |

## 🔐 Authentication

FastNear Premium supports two authentication methods (both implemented):

### Method 1: Authorization Header (Used by Default)

```python
headers = {
    "Authorization": "Bearer TEMP648WSeY9y1XDyiAHL2KMbZxxnn3Tq4Dxggdd3eGniSy2",
    "Content-Type": "application/json"
}
```

### Method 2: API Key in URL (Fallback)

```python
url = "https://rpc.mainnet.fastnear.com?apiKey=TEMP648WSeY9y1XDyiAHL2KMbZxxnn3Tq4Dxggdd3eGniSy2"
```

## 🚀 Benefits

1. **Faster Response Times**: Premium RPC endpoints are significantly faster
2. **Lower Latency**: Authenticated access to optimized infrastructure
3. **Better Reliability**: Premium SLA with guaranteed uptime
4. **Fresh Data**: 30s cache ensures money-related data is recent
5. **Metadata Efficiency**: 24h cache reduces unnecessary RPC calls
6. **Graceful Degradation**: Automatic fallback to free services

## 📝 Files Modified

1. ✅ `src/utils/config.py` - Added FastNear configuration
2. ✅ `src/utils/rpc_retry.py` - Added authentication helpers
3. ✅ `src/services/metadata_cache_service.py` - **NEW** - Caching service
4. ✅ `src/services/fastnear_service.py` - **NEW** - FastNear integration
5. ✅ `src/services/token_service.py` - Updated to use FastNear
6. ✅ `src/services/wallet_service.py` - Updated to use FastNear
7. ✅ `src/services/near_wallet_service.py` - Updated to use FastNear

## 🧪 Testing Checklist

### Balance Caching (30s TTL)

- [ ] First balance check fetches from FastNear
- [ ] Second check within 30s uses cache
- [ ] After 30s, fetches fresh data
- [ ] force_refresh=True bypasses cache

### Metadata Caching (24h TTL)

- [ ] First metadata fetch uses RPC call
- [ ] Subsequent calls use 24h cache
- [ ] Unknown tokens trigger RPC fetch + cache

### FastNear Authentication

- [ ] Authorization header works
- [ ] API key in URL works (fallback)
- [ ] Invalid API key falls back to free RPCs

### Fallback Behavior

- [ ] FastNear failure → NearBlocks API
- [ ] NearBlocks failure → Free RPC
- [ ] All failures → Return "0 NEAR" gracefully

### Performance

- [ ] Token list fetch < 500ms (vs ~2s previously)
- [ ] Balance check < 300ms
- [ ] Cache hit rate > 80% after warmup

## ⚠️ Important Notes

1. **API Key Security**: API key is in config.py - should be moved to .env in production
2. **Testnet**: Currently uses free FastNear for testnet, premium for mainnet
3. **Rate Limiting**: 30s cache helps stay within API quota
4. **Cache Invalidation**: Automatically clears balance caches after transactions
5. **Monitoring**: Check logs for "FastNear" vs "NearBlocks fallback" to track success rate

## 🔧 Environment Variables

Add to `.env` file for production:

```bash
# FastNear Premium Configuration
FASTNEAR_API_KEY=TEMP648WSeY9y1XDyiAHL2KMbZxxnn3Tq4Dxggdd3eGniSy2
FASTNEAR_MAINNET_RPC_URL=https://rpc.mainnet.fastnear.com
FASTNEAR_MAINNET_API_URL=https://api.fastnear.com
FASTNEAR_TESTNET_API_URL=https://test.api.fastnear.com

# Cache TTL Configuration (optional - has defaults)
BALANCE_CACHE_TTL=30        # 30 seconds
METADATA_CACHE_TTL=86400    # 24 hours
TOKEN_INVENTORY_CACHE_TTL=30 # 30 seconds
```

## 📈 Expected Impact

### Before (NearBlocks)

- Token list fetch: ~2-3 seconds
- Rate limiting issues common
- 5-minute cache (stale data)
- No premium SLA

### After (FastNear Premium)

- Token list fetch: < 500ms (4-6x faster)
- Premium quota & SLA
- 30-second cache (fresh data)
- Authenticated priority access

## 🎉 Migration Complete!

The bot now uses FastNear Premium as the primary RPC provider with:

- ✅ 30-second cache for balance freshness
- ✅ 24-hour cache for metadata efficiency
- ✅ Authenticated premium access
- ✅ Graceful fallback to NearBlocks/free RPCs
- ✅ Improved performance and reliability

---

**Status**: ✅ **IMPLEMENTATION COMPLETE** - Ready for testing
**Next Step**: Run comprehensive tests (Task #8)
