# FastNear Premium RPC - Testing Guide

## 🧪 Quick Testing Checklist

### 1. Test FastNear Authentication

```python
# Test in Python shell or create a test script
import asyncio
from services.fastnear_service import get_fastnear_service

async def test_fastnear_auth():
    fastnear = get_fastnear_service()

    # Test account balance fetch
    balance = await fastnear.get_account_balance("solviumpuzzle.near")
    print(f"Balance: {balance}")

    # Test token list fetch
    tokens = await fastnear.get_user_token_list("solviumpuzzle.near")
    print(f"Found {len(tokens)} tokens")

    # Test metadata fetch
    metadata = await fastnear.fetch_token_metadata_rpc("wrap.near")
    print(f"wNEAR metadata: {metadata}")

asyncio.run(test_fastnear_auth())
```

**Expected Output:**

- Balance should return like "4.1234 NEAR"
- Token list should return array with contract_id, balance, last_update_block_height
- Metadata should return symbol, decimals, name, etc.

**Failure Signs:**

- "FastNear RPC error: unauthorized" → API key issue
- "HTTP 401" → Authentication failed
- Falls back to NearBlocks → FastNear unavailable but graceful

---

### 2. Test Cache Behavior (30s TTL)

```python
import asyncio
import time
from services.fastnear_service import get_fastnear_service

async def test_cache():
    fastnear = get_fastnear_service()
    account = "solviumpuzzle.near"

    # First fetch - should hit FastNear API
    print("Fetch 1 (should call API):")
    start = time.time()
    balance1 = await fastnear.get_account_balance(account)
    time1 = time.time() - start
    print(f"  {balance1} - took {time1:.2f}s")

    # Second fetch within 30s - should use cache
    print("\nFetch 2 (should use cache):")
    start = time.time()
    balance2 = await fastnear.get_account_balance(account)
    time2 = time.time() - start
    print(f"  {balance2} - took {time2:.2f}s")

    # Wait 31 seconds
    print("\nWaiting 31 seconds for cache expiry...")
    await asyncio.sleep(31)

    # Third fetch after cache expiry - should call API again
    print("\nFetch 3 (should call API again):")
    start = time.time()
    balance3 = await fastnear.get_account_balance(account)
    time3 = time.time() - start
    print(f"  {balance3} - took {time3:.2f}s")

    print(f"\nCache performance:")
    print(f"  API call: ~{time1:.2f}s")
    print(f"  Cache hit: ~{time2:.2f}s (should be < 0.1s)")
    print(f"  After expiry: ~{time3:.2f}s")

asyncio.run(test_cache())
```

**Expected Results:**

- Fetch 1: ~300-500ms (API call)
- Fetch 2: ~5-50ms (cache hit) - **should be much faster!**
- Fetch 3: ~300-500ms (API call after cache expiry)

---

### 3. Test Token Inventory with Metadata

```python
import asyncio
from services.token_service import TokenService

async def test_token_inventory():
    token_service = TokenService()
    account = "solviumpuzzle.near"  # Use an account with tokens

    print(f"Fetching token inventory for {account}...\n")
    tokens = await token_service.get_user_token_inventory(account)

    print(f"Found {len(tokens)} tokens:\n")
    for token in tokens[:5]:  # Show first 5
        print(f"  {token['symbol']:10s} | Balance: {token['balance']:20s} | Decimals: {token['decimals']}")
        print(f"  Contract: {token['contract_address']}\n")

asyncio.run(test_token_inventory())
```

**Expected Output:**

```
Found 3 tokens:

  DOGSHIT    | Balance: 4.000000           | Decimals: 24
  Contract: dogshit-1408.meme-cooking.near

  USDT       | Balance: 10.500000          | Decimals: 6
  Contract: usdt.tether-token.near

  ...
```

---

### 4. Test Fallback Behavior

```python
import asyncio
from services.fastnear_service import get_fastnear_service

async def test_fallback():
    fastnear = get_fastnear_service()

    # Test with invalid API key (simulate FastNear failure)
    fastnear.api_key = "invalid_key"

    print("Testing with invalid API key (should fall back)...")
    try:
        balance = await fastnear.get_account_balance("solviumpuzzle.near", use_cache=False)
        print(f"Got balance (via fallback): {balance}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_fallback())
```

**Expected Behavior:**

- Should log warning about FastNear failure
- Should fall back to NearBlocks/free RPC
- Should still return a balance (not crash)

---

### 5. Test via Bot Commands

**Test Balance Check:**

```
/wallet
```

- Should show NEAR balance
- Check logs for "Successfully got balance from FastNear"
- First check ~500ms, second check within 30s should be instant

**Test Token Inventory:**

```
/tokens  (or whatever command shows tokens)
```

- Should list all tokens with correct symbols and decimals
- Check logs for "Successfully fetched X tokens from FastNear"
- Metadata should be correct (not "UNKNOWN")

---

## 📊 Performance Benchmarks

### Target Performance

- **NEAR Balance**: < 300ms first fetch, < 50ms cached
- **Token List**: < 500ms first fetch, < 50ms cached
- **Token Metadata**: < 400ms first fetch, instant cached (24h)
- **Cache Hit Rate**: > 80% after warmup period

### How to Measure

```python
import asyncio
import time
from services.fastnear_service import get_fastnear_service

async def benchmark():
    fastnear = get_fastnear_service()
    account = "solviumpuzzle.near"

    times = {"balance": [], "tokens": [], "metadata": []}

    # Warm up cache
    await fastnear.get_account_balance(account)
    await asyncio.sleep(1)

    # Test 10 times
    for i in range(10):
        # Balance check
        start = time.time()
        await fastnear.get_account_balance(account)
        times["balance"].append(time.time() - start)

        # Token list
        start = time.time()
        await fastnear.get_user_token_list(account)
        times["tokens"].append(time.time() - start)

        await asyncio.sleep(0.5)

    print("Performance Results (10 iterations):")
    print(f"  Balance: avg {sum(times['balance'])/10*1000:.0f}ms")
    print(f"  Tokens:  avg {sum(times['tokens'])/10*1000:.0f}ms")

asyncio.run(benchmark())
```

---

## 🔍 Monitoring & Logs

### Look for these log messages:

**Success:**

- ✅ "Successfully got balance from FastNear for {account}"
- ✅ "Successfully fetched X tokens from FastNear for {account}"
- ✅ "Using cached balance for {account}"
- ✅ "Metadata cache HIT for {contract}"

**Fallback (not an error, just info):**

- ⚠️ "FastNear failed, falling back to NearBlocks"
- ⚠️ "FastNear returned no tokens, trying NearBlocks fallback"

**Errors (need investigation):**

- ❌ "FastNear RPC error: unauthorized"
- ❌ "HTTP 401" or "HTTP 403"
- ❌ "FastNear API error: 429" (rate limit - shouldn't happen with premium)

---

## 🐛 Troubleshooting

### Issue: "unauthorized" or HTTP 401

**Solution:** Check API key in config.py or .env

### Issue: All requests falling back to NearBlocks

**Solution:**

1. Check network connectivity
2. Verify API key is correct
3. Check FastNear service status

### Issue: Cache not working (always hitting API)

**Solution:**

1. Check Redis is running
2. Verify BALANCE_CACHE_TTL config
3. Check logs for cache errors

### Issue: Wrong token decimals/symbols

**Solution:**

1. Clear metadata cache: `redis-cli DEL "metadata:{contract_id}"`
2. Force refresh: `force_refresh=True`
3. Check if token has valid ft_metadata

---

## ✅ Success Criteria

- [ ] FastNear authentication works (no 401 errors)
- [ ] Balance fetches return correct values
- [ ] Token lists include all user's tokens
- [ ] Token metadata is correct (symbols, decimals)
- [ ] Cache reduces response times significantly
- [ ] Fallback works when FastNear unavailable
- [ ] No errors in logs during normal operation
- [ ] Performance targets met (< 500ms for API calls)

---

## 🚀 Production Deployment Checklist

Before deploying to production:

- [ ] Move API key to .env file (don't commit to git)
- [ ] Test with production accounts
- [ ] Monitor FastNear API quota usage
- [ ] Set up alerts for fallback rate (if > 10%, investigate)
- [ ] Document cache invalidation strategy for support team
- [ ] Test cache behavior under load
- [ ] Verify all bot commands work correctly
- [ ] Check logs for any unexpected errors

---

## 📞 Support

If issues persist:

1. Check FastNear docs: https://docs.fastnear.com/rpcs/openapi
2. Review migration summary: `FASTNEAR_MIGRATION_SUMMARY.md`
3. Check logs for detailed error messages
4. Test with `force_refresh=True` to bypass cache
