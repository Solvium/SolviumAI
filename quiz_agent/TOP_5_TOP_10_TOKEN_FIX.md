# Top 5 & Top 10 Winners - Token Support Fix

## Issues Fixed

### Issue 1: Top 5 and Top 10 Options Not Available for Token Payments

**Problem**: When creating a quiz with token payment, only "Winner Takes All" and "Top 3" options were shown.

**Root Cause**: Token reward structure selection UI didn't include Top 5 and Top 10 buttons.

**Fix**: Added Top 5 and Top 10 buttons to token reward structure selection in two places:

- When selecting token amount from preset options
- When entering custom token amount

### Issue 2: Confirm Button Not Working

**Problem**: Clicking "✅ Confirm This Structure" button did nothing.

**Root Causes**:

1. `show_distribution_preview()` returned wrong conversation state (`REWARD_CHOICE` instead of `REWARD_STRUCTURE_CHOICE`)
2. `confirm_distribution_structure()` didn't handle token payments
3. Token-specific callback patterns (`token_structure_top5`, `token_structure_top10`) weren't registered

**Fixes**:

1. Updated `show_distribution_preview()` to return `REWARD_STRUCTURE_CHOICE`
2. Updated `confirm_distribution_structure()` to handle both NEAR and token payments
3. Updated `reward_structure_choice()` to handle `token_structure_top5` and `token_structure_top10`
4. Updated `telegram_bot.py` callback patterns to include token Top 5/10 patterns

---

## Code Changes

### 1. handlers.py - Added Token Top 5/10 Buttons

**Location**: Lines ~1728 and ~1823

Added buttons to two token reward structure selection screens:

```python
[
    InlineKeyboardButton(
        "🏆 Top 5 (40/25/15/12/8)",
        callback_data="token_structure_top5",
    ),
],
[
    InlineKeyboardButton(
        "🏆 Top 10 (30/20/10/...)",
        callback_data="token_structure_top10",
    ),
],
```

### 2. handlers.py - Token Structure Handlers

**Location**: Lines ~1380-1390

Added handling for token Top 5 and Top 10 in `reward_structure_choice()`:

```python
elif choice == "token_structure_top5":
    # Handle token top 5 structure - show preview first
    await redis_client.set_user_data_key(user_id, "payment_method", "TOKEN")
    return await show_distribution_preview(update, context, "top_5")

elif choice == "token_structure_top10":
    # Handle token top 10 structure - show preview first
    await redis_client.set_user_data_key(user_id, "payment_method", "TOKEN")
    return await show_distribution_preview(update, context, "top_10")
```

### 3. handlers.py - Enhanced Distribution Preview

**Location**: Lines ~1256-1340

Updated `show_distribution_preview()` to:

- Detect payment method (NEAR vs TOKEN)
- Fetch token metadata to get currency symbol
- Use correct amount field (`token_reward_amount` vs `reward_amount`)
- Return correct conversation state (`REWARD_STRUCTURE_CHOICE`)

Key changes:

```python
# Check if this is a token payment
payment_method = await redis_client.get_user_data_key(user_id, "payment_method")

if payment_method == "TOKEN":
    reward_amount = await redis_client.get_user_data_key(user_id, "token_reward_amount")
    # Get token symbol...
    currency = metadata["symbol"]
else:
    reward_amount = await redis_client.get_user_data_key(user_id, "reward_amount")
    currency = "NEAR"

# Return correct state
return REWARD_STRUCTURE_CHOICE  # Was REWARD_CHOICE before
```

### 4. handlers.py - Enhanced Confirmation Handler

**Location**: Lines ~1343-1470

Updated `confirm_distribution_structure()` to:

- Handle both NEAR and token payments for Top 5
- Handle both NEAR and token payments for Top 10
- Calculate service fee for token payments (2%)
- Route to correct payment processor based on method
- Handle "Back" button for both NEAR and token

Key logic:

```python
if choice == "confirm_structure_top_5":
    await redis_client.set_user_data_key(user_id, "reward_structure", "top_5")

    if payment_method == "TOKEN":
        # Token payment logic with 2% service fee
        token_amount_float = float(token_amount)
        service_fee = token_amount_float * 0.02
        total_cost_with_fee = token_amount_float + service_fee
        return await process_token_payment(update, context)
    else:
        # NEAR payment logic
        return await payment_verification(update, context)
```

### 5. telegram_bot.py - Updated Callback Patterns

**Location**: Line ~300

Updated callback pattern to include token Top 5 and Top 10:

```python
REWARD_STRUCTURE_CHOICE: [
    CallbackQueryHandler(
        reward_structure_choice,
        pattern="^(structure_wta|structure_top3|structure_top5|structure_top10|structure_custom|token_structure_wta|token_structure_top3|token_structure_top5|token_structure_top10)$",
    ),
    ...
]
```

---

## Testing Checklist

### ✅ Token Payment - Top 5 Winners

1. **Start Quiz Creation**:

   - `/createquiz` → Enter topic → Select questions

2. **Choose Token Payment**:

   - Select "🪙 Pay with Token"
   - Choose a token from your inventory
   - Enter amount (e.g., 1000 tokens)

3. **Verify Top 5 Option Appears**:

   - ✅ Should see "🏆 Top 5 (40/25/15/12/8)" button

4. **Test Preview Screen**:

   - Click "Top 5" button
   - ✅ Should see distribution preview with token symbol
   - ✅ Shows amounts in tokens (not NEAR)
   - ✅ Percentages: 40/25/15/12/8%

5. **Test Confirm Button**:

   - Click "✅ Confirm This Structure"
   - ✅ Should proceed to token payment screen
   - ✅ Shows total cost + 2% service fee

6. **Test Back Button**:
   - In preview screen, click "🔙 Back to Options"
   - ✅ Should return to token structure options
   - ✅ All 4 options visible (WTA, Top 3, Top 5, Top 10)

### ✅ Token Payment - Top 10 Winners

Same testing flow as Top 5, but verify:

- ✅ "🏆 Top 10 (30/20/10/...)" button appears
- ✅ Preview shows 10 ranks with correct percentages
- ✅ Confirm button works
- ✅ Back button works

### ✅ NEAR Payment - Top 5 & Top 10

Verify existing NEAR functionality still works:

1. `/createquiz` → Topic → Questions
2. Select "💰 Pay with NEAR"
3. Select amount (e.g., 1 NEAR)
4. ✅ Top 5 and Top 10 buttons appear
5. ✅ Preview screen works
6. ✅ Confirm button proceeds to NEAR payment
7. ✅ Back button works

---

## Flow Diagrams

### Token Payment Flow (Top 5 Example)

```
/createquiz
    ↓
Select topic & questions
    ↓
Choose Payment Method: 🪙 Token
    ↓
Select Token (e.g., USDC.e)
    ↓
Enter Amount (e.g., 100 USDC)
    ↓
Choose Reward Structure
├─ 🏆 Winner Takes All
├─ 🥇🥈🥉 Top 3 (50%-30%-20%)
├─ 🏆 Top 5 (40/25/15/12/8)      ← USER CLICKS HERE
└─ 🏆 Top 10 (30/20/10/...)
    ↓
📊 Distribution Preview
─────────────────────────
🏆 Top 5 Winners Distribution
💰 Total Prize Pool: 100 USDC

🥇 1st: 40 USDC (40%)
🥈 2nd: 25 USDC (25%)
🥉 3rd: 15 USDC (15%)
🏅 4th: 12 USDC (12%)
🏅 5th: 8 USDC (8%)
─────────────────────────
[✅ Confirm This Structure]  ← USER CLICKS HERE
[🔙 Back to Options]
    ↓
💳 Token Payment Verification
─────────────────────────
Token: USDC.e
Amount: 100 USDC
Service Fee (2%): 2 USDC
Total Cost: 102 USDC
─────────────────────────
[✅ Proceed with Payment]
    ↓
Process token transfer
    ↓
Quiz Created! 🎉
```

---

## Technical Details

### Payment Method Detection

The fix uses Redis to track payment method:

```python
# Set during token structure selection
await redis_client.set_user_data_key(user_id, "payment_method", "TOKEN")

# Retrieved in preview/confirm functions
payment_method = await redis_client.get_user_data_key(user_id, "payment_method")
```

### Amount Field Handling

Different fields are used for NEAR vs Token:

| Payment Method | Amount Field          | Used In                   |
| -------------- | --------------------- | ------------------------- |
| NEAR           | `reward_amount`       | Preview, Confirm, Payment |
| TOKEN          | `token_reward_amount` | Preview, Confirm, Payment |

### Service Fee Calculation

Token payments include 2% service fee:

```python
token_amount_float = float(token_amount)
service_fee = token_amount_float * 0.02  # 2%
total_cost_with_fee = token_amount_float + service_fee
```

---

## Files Modified

| File                      | Lines Changed | Purpose                                                         |
| ------------------------- | ------------- | --------------------------------------------------------------- |
| `src/bot/handlers.py`     | ~200 lines    | Added token Top 5/10 support, enhanced preview/confirm handlers |
| `src/bot/telegram_bot.py` | 1 line        | Updated callback patterns to include token Top 5/10             |

---

## Verification

Run these checks to verify the fix:

1. **Import Check**:

```bash
python3 -c "from src.bot import handlers; print('✅ No syntax errors')"
```

2. **Pattern Check** (telegram_bot.py):

```bash
grep "token_structure_top5\|token_structure_top10" src/bot/telegram_bot.py
```

Expected output:

```
pattern="^(structure_wta|structure_top3|structure_top5|structure_top10|structure_custom|token_structure_wta|token_structure_top3|token_structure_top5|token_structure_top10)$",
```

3. **Button Check** (handlers.py):

```bash
grep -A 2 "token_structure_top5\|token_structure_top10" src/bot/handlers.py | head -20
```

Expected: Should show button definitions and callback handlers

---

## Summary

**Issues**:

- ❌ Token quizzes missing Top 5/Top 10 options
- ❌ Confirm button not working

**Fixes**:

- ✅ Added Top 5 and Top 10 buttons to token reward structure UI (2 locations)
- ✅ Enhanced `show_distribution_preview()` to handle token payments
- ✅ Enhanced `confirm_distribution_structure()` to handle token payments
- ✅ Added `token_structure_top5` and `token_structure_top10` handlers
- ✅ Updated callback patterns in `telegram_bot.py`
- ✅ Fixed conversation state return value

**Result**: Token payments now fully support Top 5 and Top 10 winner structures with proper preview and confirmation flow.
