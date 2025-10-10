# Top 5 and Top 10 Winners Implementation

## Overview
This document describes the implementation of **Top 5 Winners** and **Top 10 Winners** reward structures for quizzes, providing users with more flexible prize distribution options.

## Features Added

### 1. **New Reward Structure Options**
- **Top 5 Winners**: Balanced competitive distribution (40/25/15/12/8%)
- **Top 10 Winners**: Tiered distribution (30/20/10/10/8/7/4.5/4/3.5/3%)

### 2. **Distribution Models**

#### Top 5 Winners (40/25/15/12/8%)
```
1st Place: 40% 🥇
2nd Place: 25% 🥈
3rd Place: 15% 🥉
4th Place: 12% 🏅
5th Place: 8%  🏅
```

**Example with 10 NEAR:**
- 1st: 4.0 NEAR
- 2nd: 2.5 NEAR
- 3rd: 1.5 NEAR
- 4th: 1.2 NEAR
- 5th: 0.8 NEAR

#### Top 10 Winners (30/20/10/10/8/7/4.5/4/3.5/3%)
```
Tier 1 (Top 3): 60% total
├─ 1st Place: 30% 🥇
├─ 2nd Place: 20% 🥈
└─ 3rd Place: 10% 🥉

Tier 2 (4-6): 25% total
├─ 4th Place: 10% 🏅
├─ 5th Place: 8%  🏅
└─ 6th Place: 7%  🏅

Tier 3 (7-10): 15% total
├─ 7th Place: 4.5% 🎖️
├─ 8th Place: 4%   🎖️
├─ 9th Place: 3.5% 🎖️
└─ 10th Place: 3%  🎖️
```

**Example with 10 NEAR:**
- 1st: 3.0 NEAR | 2nd: 2.0 NEAR | 3rd: 1.0 NEAR
- 4th: 1.0 NEAR | 5th: 0.8 NEAR | 6th: 0.7 NEAR
- 7th: 0.45 NEAR | 8th: 0.4 NEAR | 9th: 0.35 NEAR | 10th: 0.3 NEAR

---

## User Flow

### Step 1: Reward Structure Selection
```
┌─────────────────────────────────────┐
│ Choose Reward Structure:            │
├─────────────────────────────────────┤
│ [Winner Takes All (10 NEAR)]        │
│ [Top 3 Winners (50/30/20)]          │
│ [Top 5 Winners (40/25/15/12/8)] ⬅️  │
│ [Top 10 Winners (30/20/10/...)]  ⬅️ │
│ [Custom Structure]                  │
└─────────────────────────────────────┘
```

### Step 2: Distribution Preview (Confirmation Screen)
When user clicks **Top 5** or **Top 10**, they see:

```
🏆 Top 5 Winners Distribution
═════════════════════════════════════════════
💰 Total Prize Pool: 10 NEAR

🥇 1st Place: 4.0 NEAR (40%)
🥈 2nd Place: 2.5 NEAR (25%)
🥉 3rd Place: 1.5 NEAR (15%)
🏅 4th Place: 1.2 NEAR (12%)
🏅 5th Place: 0.8 NEAR (8%)

─────────────────────────────────────────────
💡 Winners determined by:
   1️⃣ Most correct answers
   2️⃣ Fastest response time

[✅ Confirm This Structure]
[🔙 Back to Options]
```

### Step 3: Quiz Announcement (In Group)
```
🎮 NEW QUIZ: Blockchain Trivia

📋 10 Questions | ⏱️ 5 mins
💰 10 NEAR Prize Pool
🏆 Top 5 Winners (40/25/15/12/8%)

[🎯 Join Quiz]
```

---

## Code Changes

### 1. **Configuration (src/utils/config.py)**
Added distribution constants:
```python
# Top 5 Winners: Balanced competitive model
TOP_5_DISTRIBUTION = [0.40, 0.25, 0.15, 0.12, 0.08]

# Top 10 Winners: Tiered model
TOP_10_DISTRIBUTION = [0.30, 0.20, 0.10, 0.10, 0.08, 0.07, 0.045, 0.04, 0.035, 0.03]
```

### 2. **Distribution Preview Formatter (src/utils/quiz_cards.py)**
New functions:
- `format_distribution_preview(structure_type, total_amount, currency)` - Returns formatted preview message with amounts
- `get_compact_distribution_text(structure_type)` - Returns compact text like "40/25/15/12/8%"

### 3. **UI Updates (src/bot/handlers.py)**
- Added Top 5 and Top 10 buttons to `show_reward_structure_options()`
- Created `show_distribution_preview()` - Shows confirmation screen
- Created `confirm_distribution_structure()` - Handles confirmation/back actions
- Updated `reward_structure_choice()` - Routes to preview screens
- Updated `store_payment_info_in_quiz()` - Saves Top 5/Top 10 reward schedules

### 4. **Callback Handler Registration (src/bot/telegram_bot.py)**
Updated patterns to handle new callbacks:
```python
REWARD_STRUCTURE_CHOICE: [
    CallbackQueryHandler(reward_structure_choice,
        pattern="^(structure_wta|structure_top3|structure_top5|structure_top10|...)$"),
    CallbackQueryHandler(confirm_distribution_structure,
        pattern="^(confirm_structure_top_5|confirm_structure_top_10|back_to_structure_options)$")
]
```

### 5. **Reward Distribution Logic (src/services/blockchain.py)**
- Added winner selection for Top 5 (`top5_details`) and Top 10 (`top10_details`)
- Implemented distribution calculation using `Config.TOP_5_DISTRIBUTION` and `Config.TOP_10_DISTRIBUTION`
- Added rank-specific reward parsing with fallback to percentage-based distribution

### 6. **Winner Selection (src/services/quiz_service.py)**
Updated `_generate_leaderboard_data_for_quiz()`:
```python
elif reward_type == "top5_details":
    winners_count = 0
    for p in ranked_participants:
        if winners_count < 5 and p["score"] > 0:
            p["is_winner"] = True
            winners_count += 1
```

### 7. **Quiz Announcements (src/services/quiz_service.py)**
Updated `announce_quiz_end()` to handle Top 5 and Top 10:
- Displays "Top 5 Winners" or "Top 10 Winners" in reward type
- Notifies top 5 or top 10 participants via DM

---

## Database Schema
No database migrations required! The implementation uses existing `reward_schedule` JSONB field:

```json
{
  "type": "top5_details",
  "details_text": "4.0 NEAR for 1st, 2.5 NEAR for 2nd, 1.5 NEAR for 3rd, 1.2 NEAR for 4th, 0.8 NEAR for 5th"
}
```

```json
{
  "type": "top10_details",
  "details_text": "3.0 NEAR for 1st, 2.0 NEAR for 2nd, ... 0.3 NEAR for 10th"
}
```

---

## Testing Checklist

### ✅ UI Flow Testing
- [ ] Top 5 button appears in reward structure options
- [ ] Top 10 button appears in reward structure options
- [ ] Clicking Top 5 shows correct distribution preview
- [ ] Clicking Top 10 shows correct distribution preview
- [ ] "✅ Confirm" proceeds to payment verification
- [ ] "🔙 Back" returns to reward structure options

### ✅ Confirmation Screen Validation
- [ ] Distribution percentages are correct (40/25/15/12/8% for Top 5)
- [ ] Distribution percentages are correct (30/20/10/.../3% for Top 10)
- [ ] Total adds up to 100%
- [ ] Amounts calculated correctly based on prize pool
- [ ] Currency displays correctly (NEAR or token symbol)

### ✅ Quiz Announcement
- [ ] Shows "Top 5 Winners (40/25/15/12/8%)" in announcement
- [ ] Shows "Top 10 Winners (30/20/10/...)" in announcement
- [ ] Prize pool amount is correct

### ✅ Reward Distribution
- [ ] Only top 5 participants receive rewards (Top 5 structure)
- [ ] Only top 10 participants receive rewards (Top 10 structure)
- [ ] Each rank receives correct percentage of prize pool
- [ ] 2% service fee deducted correctly
- [ ] Transactions complete successfully

### ✅ Winner Announcements
- [ ] Correct number of winners marked (5 or 10)
- [ ] Leaderboard displays correctly
- [ ] DMs sent to all winners
- [ ] Explorer links work

---

## Files Modified

| File | Purpose | Changes |
|------|---------|---------|
| `src/utils/config.py` | Constants | Added `TOP_5_DISTRIBUTION` and `TOP_10_DISTRIBUTION` |
| `src/utils/quiz_cards.py` | UI formatting | Added `format_distribution_preview()` and `get_compact_distribution_text()` |
| `src/bot/handlers.py` | UI handlers | Added Top 5/10 buttons, preview screen, confirmation handlers |
| `src/bot/telegram_bot.py` | Callback routing | Registered new callback patterns |
| `src/services/blockchain.py` | Reward distribution | Added Top 5/10 winner selection and distribution logic |
| `src/services/quiz_service.py` | Quiz logic | Updated winner marking and announcements |

---

## Example Scenarios

### Scenario 1: Top 5 Quiz with 10 NEAR Prize
1. User creates quiz with 10 NEAR prize pool
2. Selects "Top 5 Winners"
3. Sees preview: 4.0/2.5/1.5/1.2/0.8 NEAR
4. Confirms and pays 10 NEAR
5. 8 users participate, 6 get correct answers
6. Top 5 receive: 3.92/2.45/1.47/1.176/0.784 NEAR (after 2% fee)

### Scenario 2: Top 10 Quiz with 100 NEAR Prize
1. User creates quiz with 100 NEAR prize pool
2. Selects "Top 10 Winners"
3. Sees preview: 30/20/10/10/8/7/4.5/4/3.5/3 NEAR
4. Confirms and pays 100 NEAR
5. 15 users participate, 12 get correct answers
6. Top 10 receive their share (after 2% fee)
7. Ranks 11-12 get participation acknowledgment but no reward

---

## Advantages

1. ✅ **More Flexible** - Users can choose how many winners
2. ✅ **Fair Distribution** - Balanced percentages reward skill
3. ✅ **Transparent** - Users see exact amounts before confirming
4. ✅ **Scalable** - Easy to add Top 15, Top 20 later
5. ✅ **Clean UX** - Confirmation screen prevents errors
6. ✅ **Backward Compatible** - Existing WTA and Top 3 still work

---

## Future Enhancements

### Phase 2: Custom Top N
Allow users to enter custom number of winners (e.g., "7 winners"):
```
How many winners? (3-20)
[Custom: ___ winners]
```

### Phase 3: Custom Distribution
Allow users to customize percentages:
```
Top 5 Winners - Edit Distribution:
1st: 40% [Edit]
2nd: 25% [Edit]
3rd: 15% [Edit]
...
```

---

## Support

For issues or questions:
1. Check logs for error messages
2. Verify distribution percentages add up to 100%
3. Ensure `Config.TOP_5_DISTRIBUTION` and `Config.TOP_10_DISTRIBUTION` are loaded
4. Test with small prize amounts first (0.1 NEAR)

---

**Implementation Status**: ✅ Complete  
**Testing Status**: ⏳ Ready for Testing  
**Documentation**: ✅ Complete
