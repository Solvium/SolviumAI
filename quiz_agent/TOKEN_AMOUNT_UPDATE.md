# Token Amount Options Update

## 🎯 Change Summary

Updated token reward amount options to be more affordable and accessible for quiz creators.

---

## 📊 Before vs After

### Before (Old Options)

```
[100] [200]
[300] [500]
[1000] [2000]
[Custom amount]
```

**Issues**:

- ❌ Minimum 100 tokens too high for small quizzes
- ❌ Not suitable for high-value tokens (e.g., USDC, USDT)
- ❌ Limited options between 100-500 range

### After (New Options)

```
[1]  [3]  [5]
[10] [20] [50]
[Custom amount]
```

**Benefits**:

- ✅ Starting at 1 token - perfect for expensive tokens
- ✅ More granular options for small quizzes
- ✅ Better range for testing and accessibility
- ✅ Still supports custom amounts for flexibility

---

## 💡 Use Cases

### High-Value Tokens (USDC, USDT, NEAR)

- **1 USDC** → $1 quiz (perfect for testing)
- **5 USDC** → $5 quiz (small engagement)
- **10 USDC** → $10 quiz (moderate reward)
- **50 USDC** → $50 quiz (major event)

### Medium-Value Tokens

- **3 tokens** → Good for community quizzes
- **10 tokens** → Standard reward
- **20 tokens** → Enhanced engagement

### Low-Value Tokens

- Use higher amounts via **Custom amount** option
- Example: 1000, 5000, 10000 for meme tokens

---

## 🔧 Technical Changes

### File Modified

`src/bot/handlers.py` - Line ~1816

### Code Change

```python
# Updated button layout
reply_markup=InlineKeyboardMarkup(
    [
        [
            InlineKeyboardButton("1", callback_data="token_amount_1"),
            InlineKeyboardButton("3", callback_data="token_amount_3"),
            InlineKeyboardButton("5", callback_data="token_amount_5"),
        ],
        [
            InlineKeyboardButton("10", callback_data="token_amount_10"),
            InlineKeyboardButton("20", callback_data="token_amount_20"),
            InlineKeyboardButton("50", callback_data="token_amount_50"),
        ],
        [
            InlineKeyboardButton(
                "Custom amount", callback_data="token_amount_custom"
            ),
        ],
    ]
)
```

---

## 🧪 Testing Guide

### Test 1: Small Amount (1 Token)

1. `/createquiz` → Select token payment
2. Choose a token (e.g., USDC)
3. Click **1** button
4. ✅ Verify: Shows "1 USDC" in reward structure screen

### Test 2: Medium Amount (10 Tokens)

1. Follow quiz creation flow
2. Click **10** button
3. ✅ Verify: Shows "10 USDC" with correct distribution preview

### Test 3: Large Amount (50 Tokens)

1. Follow quiz creation flow
2. Click **50** button
3. ✅ Verify: Shows "50 USDC" for all reward structures

### Test 4: Custom Amount

1. Click **Custom amount**
2. Enter "100" or any value
3. ✅ Verify: Accepts custom input and proceeds

---

## 📱 User Experience

### Quiz Creation Flow

```
Choose Token → Select Token → Amount Selection
                                    ↓
                    ┌───────────────────────────┐
                    │  💰 Token Balance: 100    │
                    │  ✅ Status: Sufficient    │
                    │                           │
                    │  Select reward amount:    │
                    │                           │
                    │  [ 1 ]  [ 3 ]  [ 5 ]      │
                    │  [ 10 ] [ 20 ] [ 50 ]     │
                    │  [ Custom amount ]        │
                    └───────────────────────────┘
```

### Example Scenarios

**Scenario 1: Test Quiz with USDC**

- Select: 1 USDC
- Structure: Winner Takes All
- Cost: 1.02 USDC (with 2% fee)
- Perfect for testing!

**Scenario 2: Community Quiz with Custom Token**

- Select: 10 tokens
- Structure: Top 3 (50/30/20%)
- Winners get: 5/3/2 tokens

**Scenario 3: Major Event with NEAR**

- Select: 50 NEAR
- Structure: Top 10
- Winners get: 15/10/5/5/4/3.5/... NEAR

---

## ✅ Verification

**Syntax Check**:

```bash
python3 -m py_compile src/bot/handlers.py
```

✅ No errors

**Pattern Check**:

```bash
grep "token_amount_" src/bot/handlers.py | grep InlineKeyboardButton
```

Should show: `token_amount_1`, `token_amount_3`, `token_amount_5`, `token_amount_10`, `token_amount_20`, `token_amount_50`, `token_amount_custom`

---

## 🚀 Deployment Notes

- **Backward Compatible**: ✅ Yes - existing custom amount flow unchanged
- **Database Changes**: ❌ None required
- **Migration Required**: ❌ No
- **Breaking Changes**: ❌ None

---

## 💬 User Communication

When announcing this update to users:

> 🎉 **New Token Reward Options!**
>
> We've made token quizzes more affordable and accessible:
>
> - Starting from just **1 token** 💰
> - Perfect for testing and small community quizzes
> - Options: 1, 3, 5, 10, 20, 50 tokens
> - Custom amounts still available!
>
> Create your token quiz today with `/createquiz`

---

## 📝 Summary

**Change**: Updated token amount preset options from [100, 200, 300, 500, 1000, 2000] to [1, 3, 5, 10, 20, 50]

**Impact**:

- ✅ More accessible for small quizzes
- ✅ Better for high-value tokens (USDC, USDT)
- ✅ Improved user experience
- ✅ Maintains flexibility with custom amounts

**Status**: ✅ Complete and ready for testing
