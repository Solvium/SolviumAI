# Menu & Keyboard Features Analysis

## Overview

This document provides a comprehensive analysis of all menu and keyboard features in the SolviumAI Quiz Agent Telegram bot.

---

## 🎯 Main Menu Structure

### Primary Interface

**Location:** `src/bot/keyboard_markups.py` - `create_main_menu_keyboard()`

**Layout:** 2x2 Grid (ReplyKeyboardMarkup)

```
┌─────────────────┬─────────────────┐
│ 💰 My Wallet    │ 🎯 My Points    │
├─────────────────┼─────────────────┤
│ 🏆 Leaderboards │ 📜 History      │
└─────────────────┴─────────────────┘
```

**Settings:**

- `resize_keyboard=True` - Optimizes button size
- `one_time_keyboard=False` - **CRITICAL** - Keeps menu visible
- `input_field_placeholder="📱 Choose an option..."` - Shows menu icon

**Key Features:**

- ✅ Persistent keyboard - never disappears
- ✅ Clean, focused interface - only 4 essential options
- ✅ Menu icon (📱) always visible in input field
- ✅ Consistent across all messages

---

## 💰 My Wallet Menu

### Wallet Submenu

**Handler:** `handle_my_wallet()` in `menu_handlers.py`

**Layout:** 3x2 Grid

```
┌──────────────────┬──────────────────┐
│ 💰 View Balance  │ 🔑 Export Keys   │
├──────────────────┼──────────────────┤
│ 📤 Withdraw      │ 📥 Receive       │
├──────────────────┼──────────────────┤
│ 📊 Transactions  │ ⬅️ Back to Main  │
└──────────────────┴──────────────────┘
```

### Feature Analysis:

#### 1. 💰 View Balance

**Handler:** `handle_view_balance()`
**Status:** ✅ **IMPLEMENTED**

**Features:**

- ✅ Real-time NEAR balance from blockchain
- ✅ Force refresh capability (`force_refresh=True`)
- ✅ Displays account ID
- ✅ Shows network (mainnet/testnet)
- ✅ Balance auto-updates every few minutes
- ✅ Error handling with user-friendly messages

**Technical Details:**

```python
# Fetches live balance from NEAR RPC
near_balance = await wallet_service.get_wallet_balance(user_id, force_refresh=True)
account_id = wallet.get("account_id", "Unknown")
```

**Display Format:**

```
💰 Wallet Balance
🏛️ NEAR Balance: X.XXXX NEAR
🌐 Network: Mainnet/Testnet
📍 Account ID: account.near
💡 Tip: Balance updates automatically
```

**Strengths:**

- Real blockchain integration
- Force refresh prevents stale data
- Clear, informative display

**Potential Improvements:**

- Add token balances display
- Show USD equivalent
- Add balance change indicator

---

#### 2. 🔑 Export Keys

**Handler:** `handle_export_keys()`
**Status:** ✅ **IMPLEMENTED** with security features

**Features:**

- ✅ Security warning before export
- ✅ Two-step confirmation process
- ✅ Private key decryption
- ✅ Clear import instructions
- ✅ Secure handling (clears from memory)

**Security Flow:**

1. Shows critical security warning
2. Requires explicit confirmation
3. Decrypts private key using NEARWalletService
4. Displays key with import instructions
5. Reminds user to delete message after saving

**Technical Details:**

```python
# Encrypted storage - secure by default
encrypted_private_key = wallet_data.get("encrypted_private_key")
iv = wallet_data.get("iv")
tag = wallet_data.get("tag")

# Decryption only on explicit user request
private_key = near_service.decrypt_private_key(encrypted_private_key, iv, tag)
```

**Callback Handlers:**

- `export_confirm:{user_id}` - Proceed with export
- `export_cancel` - Cancel export

**Strengths:**

- Excellent security practices
- Clear warnings
- User education included
- Encrypted storage

**Potential Improvements:**

- Add QR code generation for mobile import
- Support multiple key export formats
- Add key backup verification

---

#### 3. 📤 Withdraw

**Handler:** `handle_withdraw()`
**Status:** ⚠️ **PARTIAL** - Shows withdrawal menu

**Submenu:** `create_withdrawal_keyboard()`

```
┌───────────────────┬──────────────────┐
│ 💎 Withdraw NEAR  │ 🪙 Withdraw Token│
├───────────────────┼──────────────────┤
│ 🎯 Withdraw Points│ 📊 Transactions  │
├───────────────────┴──────────────────┤
│        ⬅️ Back to Main Menu           │
└────────────────────────────────────────┘
```

**Current Implementation:**

- ✅ Shows withdrawal options
- ❌ Individual handlers not implemented

**Missing Handlers:**

- `handle_withdraw_near()`
- `handle_withdraw_token()`
- `handle_withdraw_points()`

**Potential Implementation:**

```python
async def handle_withdraw_near(update, context):
    # 1. Show current NEAR balance
    # 2. Ask for amount
    # 3. Ask for destination address
    # 4. Show fee calculation
    # 5. Confirm transaction
    # 6. Process withdrawal
    # 7. Show transaction hash
```

**Recommendations:**

- HIGH PRIORITY - Core wallet feature
- Implement NEAR withdrawal first
- Add transaction fee calculator
- Include destination address validation
- Show transaction confirmation with hash

---

#### 4. 📥 Receive

**Handler:** `handle_receive()`
**Status:** ✅ **WELL IMPLEMENTED**

**Features:**

- ✅ Shows account ID for deposits
- ✅ Clear deposit instructions
- ✅ Enhanced receive keyboard with balance checkers
- ✅ Multiple balance check options
- ✅ Network verification reminder

**Enhanced Receive Keyboard:**

```
┌──────────────────────┬──────────────────────┐
│ 🔄 Check NEAR Balance│ 🪙 Check Token Balance│
├──────────────────────┴──────────────────────┤
│          💰 Check All Balances              │
├──────────────────────────────────────────────┤
│           ⬅️ Back to Wallet                  │
└──────────────────────────────────────────────┘
```

**Balance Check Handlers:**

##### a) Check NEAR Balance

**Handler:** `handle_check_near_balance_after_deposit()`

- ✅ Force refreshes from blockchain
- ✅ Shows loading state
- ✅ Real-time update display
- ✅ Timestamp included

##### b) Check Token Balance

**Handler:** `handle_check_token_balance_after_deposit()`

- ✅ Scans for all fungible tokens
- ✅ Shows token inventory
- ✅ Displays symbol, balance, and name
- ✅ Handles NEP-141 tokens
- ✅ Limits display to avoid message overflow

**Technical Integration:**

```python
from services.token_service import TokenService
tokens = await token_service.get_user_token_inventory(
    account_id, force_refresh=True
)
```

##### c) Check All Balances

**Handler:** `handle_check_all_balances_after_deposit()`

- ✅ Comprehensive balance report
- ✅ NEAR + all tokens in one view
- ✅ Force refresh for accuracy
- ✅ Returns to wallet menu after display

**Strengths:**

- Excellent UX for deposit verification
- Clear instructions
- Multiple verification options
- Real-time blockchain data

**Potential Improvements:**

- Add QR code for easier deposits
- Show recent deposit history
- Add deposit notifications

---

#### 5. 📊 Transactions

**Handler:** `handle_transactions()`
**Status:** ⚠️ **MOCK DATA** - Not fully implemented

**Current Implementation:**

- Shows placeholder transaction history
- Mock data with example transactions

**Needed Implementation:**

```python
# Should integrate with:
# 1. NEAR blockchain transaction history
# 2. Quiz payment records
# 3. Reward distributions
# 4. Withdrawal history
# 5. Token transfers
```

**Recommendations:**

- Query NEAR Explorer API for transaction history
- Store transaction metadata in database
- Add filtering options (type, date range)
- Link to NEAR Explorer for details
- Add export functionality

---

## 🎯 My Points Menu

### Points Overview

**Handler:** `handle_my_points()`
**Status:** ✅ **FULLY IMPLEMENTED**

**Features:**

- ✅ Total points display
- ✅ Point breakdown (taker/creator)
- ✅ Statistics display
- ✅ Last updated timestamp
- ✅ Earning guide included

**Integration:**

```python
from services.point_service import PointService
points_data = await PointService.get_user_points(user_id)
```

**Display Format:**

```
🎯 {username}'s Points

💰 Total Points: X,XXX
📊 Breakdown:
   • Quiz Taker Points: X,XXX
   • Quiz Creator Points: X,XXX

📈 Statistics:
   • Correct Answers: XX
   • Quizzes Created: XX
   • Quizzes Taken: XX
   • First Correct Answers: XX

🕒 Last Updated: YYYY-MM-DD HH:MM:SS

💡 How to earn more points:
• Answer correctly (+5 points each)
• Be first to answer (+3 bonus)
• Create quizzes (+2 per unique player)
• Get bonus when players answer correctly (+1)
```

**Strengths:**

- Comprehensive point tracking
- Clear breakdown
- Educational component
- Real-time data

**Potential Improvements:**

- Add point history chart
- Show point milestones
- Add daily/weekly point goals
- Show point conversion to tokens

---

## 🏆 Leaderboards Menu

### Leaderboard Submenu

**Handler:** `handle_leaderboards()`
**Layout:** 2x2 + 1 Grid

```
┌────────────────────┬───────────────────┐
│ 🏆 Global Leaderboard │ 👥 Group Leaderboard │
├────────────────────┼───────────────────┤
│ 📊 Weekly Top      │ 🎖️ All Time Best │
├────────────────────┴───────────────────┤
│         ⬅️ Back to Main Menu            │
└───────────────────────────────────────┘
```

### Feature Analysis:

#### 1. 🏆 Global Leaderboard

**Handler:** `handle_global_leaderboard()`
**Status:** ✅ **FULLY IMPLEMENTED**

**Features:**

- ✅ Top 10 players display
- ✅ Rank indicators (🥇🥈🥉)
- ✅ User's position highlighted
- ✅ Real-time updates
- ✅ Formatted point display with commas
- ✅ Markdown username escaping for safety

**Technical Details:**

```python
from services.point_service import PointService
leaderboard_data = await PointService.get_leaderboard(
    limit=10,
    leaderboard_type="total"
)
```

**Display Format:**

```
🏆 Global Leaderboard

🥇 #1 - Username (10,000 points)
🥈 #2 - Username (8,500 points)
🥉 #3 - Username (7,200 points)
4. #4 - Username (6,000 points)
...

📍 Your Points: X,XXX points
🔄 Updated: Just now
```

**Strengths:**

- Clear ranking system
- User position highlighted
- Real-time data
- Secure username handling

**Potential Improvements:**

- Add pagination for more ranks
- Show user's nearby competitors
- Add filtering by timeframe
- Show point differences

---

#### 2. 👥 Group Leaderboard

**Handler:** `handle_group_leaderboard()`
**Status:** ⚠️ **PARTIAL** - Uses global data

**Current Implementation:**

- Shows top 5 from global leaderboard
- Indicates feature is in development

**Needed Features:**

- Group-specific filtering
- Group ID tracking
- Group-only rankings
- Team competitions

**Recommendations:**

- Add group_id to user points table
- Filter leaderboard by group
- Add group invite bonuses
- Implement team challenges

---

#### 3. 📊 Weekly Top

**Handler:** `handle_weekly_top()`
**Status:** ✅ **IMPLEMENTED** - Shows quiz creators

**Features:**

- ✅ Top 5 quiz creators
- ✅ Creator points display
- ✅ Quiz count per creator
- ✅ Real-time data

**Technical Details:**

```python
leaderboard_data = await PointService.get_leaderboard(
    limit=10,
    leaderboard_type="creator"
)
```

**Display Format:**

```
📊 Weekly Top Performers ⭐

🎯 Quiz Creators This Week:
🥇 Username - XXX creator points (X quizzes)
🥈 Username - XXX creator points (X quizzes)
...

💡 Note: Showing top quiz creators by creator points
⏰ Updated: Real-time data
```

**Note:** Despite name "Weekly Top", currently shows all-time creator data.

**Recommendations:**

- Add actual weekly filtering
- Store timestamp with points
- Add weekly reset mechanism
- Show weekly vs all-time toggle

---

#### 4. 🎖️ All Time Best

**Handler:** `handle_all_time_best()`
**Status:** ✅ **IMPLEMENTED** - Shows quiz takers

**Features:**

- ✅ Top 5 quiz performers
- ✅ Quiz taker points display
- ✅ Accuracy percentage calculation
- ✅ Correct answers count
- ✅ Total quizzes taken

**Technical Details:**

```python
leaderboard_data = await PointService.get_leaderboard(
    limit=10,
    leaderboard_type="taker"
)
```

**Display Format:**

```
🎖️ All Time Best Players 🏆

🧠 Quiz Masters (By Quiz Performance):
🥇 Username - XXX quiz points
   📊 XX correct answers, XX.X% accuracy
🥈 Username - XXX quiz points
   📊 XX correct answers, XX.X% accuracy
...

🏆 Hall of Fame - Greatest quiz performers of all time!
```

**Strengths:**

- Detailed performance metrics
- Accuracy calculation
- Clear achievement focus

**Potential Improvements:**

- Add streak information
- Show perfect scores count
- Add difficulty-adjusted scores
- Include category breakdowns

---

## 📜 History Menu

### History Submenu

**Handler:** `handle_history()`
**Layout:** 2x2 + 1 Grid

```
┌───────────────────┬──────────────────┐
│ 📝 Quiz Activity  │ 💰 Points History│
├───────────────────┼──────────────────┤
│ 💳 Wallet Activity│ 🏆 Achievements  │
├───────────────────┴──────────────────┤
│        ⬅️ Back to Main Menu           │
└────────────────────────────────────────┘
```

### Feature Analysis:

#### 1. 📝 Quiz Activity

**Handler:** `handle_quiz_activity()`
**Status:** ✅ **FULLY IMPLEMENTED**

**Features:**

- ✅ Shows quizzes created by user (last 10)
- ✅ Shows recent quiz participations (last 10)
- ✅ Quiz status indicators
- ✅ Date display
- ✅ Accuracy calculations
- ✅ Database integration

**Technical Details:**

```python
from store.database import SessionLocal
from models.quiz import Quiz, QuizAnswer

# Created quizzes
created_quizzes = session.query(Quiz)
    .filter(Quiz.creator_id == user_id)
    .order_by(desc(Quiz.created_at))
    .limit(10)
    .all()

# Participated quizzes
participated_quizzes = session.query(
    QuizAnswer.quiz_id,
    Quiz.topic,
    func.count(QuizAnswer.id).label('answers_count'),
    func.sum(...).label('correct_count')
)
```

**Display Format:**

```
📝 Quiz Activity History

🎯 Quizzes You Created:
1. 🔥 Quiz Topic (MM/DD)
2. ✏️ Quiz Topic (MM/DD)
...

🎮 Recent Quiz Participation:
1. Quiz Topic
   📊 X/Y (ZZ% accuracy)
2. Quiz Topic
   📊 X/Y (ZZ% accuracy)
...
```

**Status Indicators:**

- ✏️ DRAFT
- 💰 FUNDING
- 🔥 ACTIVE
- ✅ CLOSED

**Strengths:**

- Comprehensive activity tracking
- Clear categorization
- Accurate calculations
- Recent focus (last 10)

**Potential Improvements:**

- Add date range filters
- Show total activity counts
- Add export functionality
- Include quiz difficulty ratings

---

#### 2. 💰 Points History

**Handler:** `handle_points_history()`
**Status:** ✅ **FULLY IMPLEMENTED**

**Features:**

- ✅ Transaction history (last 15, displays 10)
- ✅ Transaction type indicators
- ✅ Point amounts with +/- signs
- ✅ Descriptions
- ✅ Timestamps
- ✅ Service integration

**Technical Details:**

```python
from services.point_service import PointService
history = await PointService.get_user_point_history(user_id, limit=15)
```

**Transaction Type Emojis:**

- ✅ CORRECT_ANSWER - Correct answer points
- 🥇 FIRST_CORRECT - First to answer bonus
- 👥 CREATOR_UNIQUE - Unique player bonus
- 🎯 CREATOR_CORRECT - Creator correct answer bonus
- 💰 Default - Generic transaction

**Display Format:**

```
💰 Points History

✅ +5 pts - Correct answer in "Quiz Topic"
   📅 MM/DD HH:MM

🥇 +3 pts - First correct answer
   📅 MM/DD HH:MM

... and X more transactions
```

**Strengths:**

- Detailed transaction log
- Clear categorization
- Chronological order
- Overflow indication

**Potential Improvements:**

- Add filtering by transaction type
- Show daily/weekly summaries
- Add point balance graph
- Include quiz context links

---

#### 3. 💳 Wallet Activity

**Handler:** `handle_wallet_activity()`
**Status:** ✅ **IMPLEMENTED**

**Features:**

- ✅ Wallet information display
- ✅ Quiz payment tracking
- ✅ Transaction hash display
- ✅ Network indicator
- ✅ Creation date

**Technical Details:**

```python
from store.database import SessionLocal
from models.wallet import UserWallet
from models.quiz import Quiz

# Get wallet
user_wallet = session.query(UserWallet)
    .filter(UserWallet.telegram_user_id == user_id)
    .first()

# Get quiz payments
quiz_payments = session.query(Quiz)
    .filter(Quiz.creator_id == user_id)
    .filter(Quiz.payment_transaction_hash.isnot(None))
    .order_by(desc(Quiz.created_at))
    .limit(10)
    .all()
```

**Display Format:**

```
💳 Wallet Activity

🏦 Wallet: account_id
🌐 Network: Mainnet/Testnet
📅 Created: MM/DD/YYYY

💰 Quiz Creation Payments:
1. Quiz Topic
   📅 MM/DD | 🔗 tx_hash_short

💡 Tip: View full transaction details on NEAR Explorer
```

**Strengths:**

- Transaction tracking
- NEAR Explorer integration
- Clear payment history
- Network awareness

**Potential Improvements:**

- Add reward distributions received
- Show withdrawal history
- Add token transfer history
- Include transaction value in NEAR

---

#### 4. 🏆 Achievements

**Handler:** `handle_achievements()`
**Status:** ✅ **FULLY IMPLEMENTED**

**Features:**

- ✅ Points milestones tracking
- ✅ Quiz participation badges
- ✅ Quiz creation badges
- ✅ Accuracy achievements
- ✅ Ranking achievements
- ✅ Speed achievements (first correct answers)
- ✅ Progress indicators

**Achievement Categories:**

##### Points Milestones:

- 🥇 Points Master (1000+ pts)
- 🥈 Points Expert (500+ pts)
- 🥉 Points Collector (100+ pts)

##### Quiz Participation:

- 🏆 Quiz Master (50+ quizzes)
- 🥇 Quiz Expert (20+ quizzes)
- 🥈 Quiz Regular (10+ quizzes)
- 🥉 Quiz Explorer (5+ quizzes)

##### Quiz Creation:

- 👑 Quiz Creator Pro (10+ created)
- 🎪 Quiz Maker (5+ created)
- 🎯 First Creator (1+ created)

##### Accuracy Badges:

- 🎖️ Sharpshooter (90%+ accuracy)
- 🥇 Expert Accuracy (75%+)
- 🥈 Good Accuracy (60%+)

##### Ranking:

- 👑 Top 3 Player
- 🥇 Top 10 Player
- 🥈 Top 50 Player

##### Speed:

- ⚡ Speed Demon (X first correct answers)

**Display Format:**

```
🏆 Your Achievements

💰 Points Milestones:
[Achievement status or progress]

🎮 Quiz Participation:
[Achievement status or progress]

🎨 Quiz Creation:
[Achievement status or progress]

🎯 Accuracy Badges:
[Current accuracy percentage]

🏅 Ranking:
[Current rank or "Not ranked yet"]

⚡ Speed Demon: X first correct answers!
```

**Strengths:**

- Comprehensive achievement system
- Progress tracking
- Multiple achievement types
- Next milestone indicators
- Gamification elements

**Potential Improvements:**

- Add achievement notifications
- Create achievement badges/NFTs
- Add rare/special achievements
- Include achievement rewards
- Add social sharing

---

## 🔧 Technical Implementation Details

### Keyboard Consistency System

**Critical Settings for Menu Icon Persistence:**

```python
# From keyboard_markups.py
reply_markup = ReplyKeyboardMarkup(
    buttons,
    resize_keyboard=True,        # Makes buttons smaller
    one_time_keyboard=False,     # CRITICAL - keeps keyboard visible
    input_field_placeholder="📱 Choose an option..."  # Menu icon
)
```

**Why `one_time_keyboard=False` is Critical:**

- If `True`, keyboard disappears after button press
- If any message is sent without `reply_markup`, keyboard vanishes
- Must maintain `False` across ALL message sends

**Helper Function:**

```python
async def send_message_with_keyboard(
    update, context, text, keyboard_func=None
):
    """
    Ensures all messages include keyboard to prevent disappearing menu
    """
    if keyboard_func is None:
        keyboard_func = create_main_menu_keyboard

    # Always includes reply_markup
    await update.message.reply_text(text, reply_markup=keyboard_func())
```

---

### Text Message Router

**Handler:** `handle_text_message()` in `menu_handlers.py`

**Function:** Routes button presses to appropriate handlers

**Button Recognition:**

```python
menu_buttons = [
    # Main menu
    "💰 My Wallet", "🎯 My Points", "🏆 Leaderboards", "📜 History",
    # Wallet submenu
    "💰 View Balance", "🔑 Export Keys", "📤 Withdraw", ...
    # Leaderboard submenu
    "🏆 Global Leaderboard", "👥 Group Leaderboard", ...
    # History submenu
    "📝 Quiz Activity", "💰 Points History", ...
    # Navigation
    "⬅️ Back to Main Menu", "❌ Cancel", ...
]

if message_text not in menu_buttons:
    return  # Let other handlers process
```

**Wallet Creation Check:**

```python
# Before any menu action
wallet_service = WalletService()
has_wallet = await wallet_service.has_wallet_robust(user_id)

if not has_wallet:
    await handle_first_time_wallet_creation(update, context)
    return
```

**Routing Logic:**

```python
# Route to specific handler
if message_text == "💰 My Wallet":
    await handle_my_wallet(update, context)
elif message_text == "🎯 My Points":
    await handle_my_points(update, context)
# ... etc
```

---

### State Management

**Redis Keys Used:**

```python
# User menu state
current_menu: "main" | "wallet" | "leaderboards" | "history"

# Wallet creation flags
wallet_created: bool
wallet: dict

# Group chat tracking
group_chat_id: int

# Quiz creation flow
topic: str
num_questions: int
context_text: str
duration_seconds: int
reward_amount: float
reward_structure: str
```

**State Transitions:**

```python
# Set state
await redis_client.set_user_data_key(user_id, "current_menu", "wallet")

# Get state
current_menu = await redis_client.get_user_data_key(user_id, "current_menu")

# Clear state
await redis_client.clear_user_data(user_id)
```

---

### Error Handling Pattern

**Standard Error Handler:**

```python
try:
    # Feature implementation
    ...
except Exception as e:
    logger.error(f"Error in [feature] for user {user_id}: {e}")
    await update.message.reply_text(
        "❌ Error message here. Please try again.",
        reply_markup=create_appropriate_keyboard()
    )
```

**Benefits:**

- Logs errors for debugging
- User-friendly error messages
- Returns appropriate keyboard
- Prevents conversation breaks

---

## 🎨 UX Best Practices

### Icon Usage

- ✅ Consistent emoji use across menus
- ✅ Icons match functionality
- ✅ Status indicators (🥇🥈🥉, ✅❌⏳)
- ✅ Category icons (💰🎯🏆📜)

### Message Formatting

- ✅ Markdown for emphasis
- ✅ Code blocks for addresses/hashes
- ✅ Structured layouts
- ✅ Clear section headers
- ✅ Bullet points for lists

### User Feedback

- ✅ Loading messages for async operations
- ✅ Success/error confirmations
- ✅ Progress indicators
- ✅ Timestamp displays
- ✅ "Just now" real-time labels

### Navigation

- ✅ Consistent "Back" buttons
- ✅ Breadcrumb-style context
- ✅ Clear menu hierarchies
- ✅ "Back to Main Menu" in submenus

---

## 📊 Feature Implementation Status

### ✅ Fully Implemented (19 features)

1. Main Menu
2. My Points (full display + statistics)
3. View Balance (blockchain integration)
4. Export Keys (with security)
5. Receive (with balance checkers)
6. Check NEAR Balance
7. Check Token Balance
8. Check All Balances
9. Global Leaderboard
10. Weekly Top (creators)
11. All Time Best (quiz takers)
12. Quiz Activity History
13. Points History
14. Wallet Activity
15. Achievements System
16. Handle Text Message Router
17. Wallet Creation (first-time)
18. Silent Wallet Creation
19. Keyboard Consistency System

### ⚠️ Partially Implemented (5 features)

1. Withdraw (menu only, no handlers)
2. Transactions (mock data)
3. Group Leaderboard (uses global data)
4. History (mock data)
5. Weekly Top (no time filtering)

### ❌ Placeholders / Coming Soon (8 features)

1. Challenge Group
2. Challenge Friend
3. My Challenges
4. Challenge Stats
5. Join Announcements (has link)
6. Join Discussion (has link)
7. Join Gaming (has link)
8. Join Trading (has link)

---

## 🚀 Priority Recommendations

### High Priority (Core Features)

1. **Implement NEAR Withdrawal** - Critical wallet feature

   - Add amount input validation
   - Implement destination address validation
   - Calculate and display fees
   - Process real NEAR transactions
   - Show transaction confirmation

2. **Real Transaction History** - Essential for transparency

   - Query NEAR Explorer API
   - Store transaction metadata
   - Add filtering and search
   - Link to explorer details

3. **Weekly Leaderboard Time Filter** - Fix mislabeled feature
   - Add timestamp to point records
   - Implement weekly reset logic
   - Add date range filtering

### Medium Priority (Enhancement)

1. **Group Leaderboard** - Social feature

   - Track group membership
   - Filter by group_id
   - Add group challenges

2. **Token Withdrawal** - Extended wallet feature

   - Support NEP-141 tokens
   - Add token selection
   - Validate token addresses

3. **Points Withdrawal/Conversion** - Monetization
   - Define point-to-token ratio
   - Implement conversion logic
   - Add minimum thresholds

### Low Priority (Nice to Have)

1. **Challenge System** - Gamification

   - Friend challenges
   - Group competitions
   - Challenge history
   - Stats tracking

2. **Community Links** - Social growth

   - Verify channel/group existence
   - Add auto-join features
   - Track member referrals

3. **Enhanced History** - Analytics
   - Export functionality
   - Charts and graphs
   - Detailed analytics
   - Comparison tools

---

## 🔒 Security Considerations

### ✅ Implemented Security

1. Private key encryption (AES)
2. Secure key export (two-step confirmation)
3. Markdown username escaping
4. Input validation
5. Error message sanitization

### 🛡️ Recommended Additions

1. Rate limiting on wallet operations
2. 2FA for withdrawals
3. Transaction amount limits
4. Withdrawal whitelist option
5. Session timeout
6. Audit logging

---

## 📈 Performance Considerations

### ✅ Current Optimizations

1. Redis caching for user state
2. Force refresh option for balances
3. Limited result sets (top 10, last 10)
4. Message length truncation
5. Pagination indicators

### 🚀 Recommended Improvements

1. Cache leaderboard data (5-minute TTL)
2. Async batch operations for multi-user queries
3. Database query optimization with indexes
4. Lazy loading for history
5. Background job for balance updates

---

## 🎯 Conclusion

The menu system is **well-structured and mostly functional** with a clear hierarchy and good UX. The main gaps are:

1. **Withdrawal functionality** - Highest priority
2. **Real transaction history** - Data integrity
3. **Group-specific features** - Social engagement

The codebase shows good practices:

- Clean separation of concerns
- Consistent error handling
- User-friendly messages
- Security-conscious design

With the recommended implementations, this would be a **production-ready** Telegram bot menu system.

---

**Generated:** 2025-10-10
**Version:** 1.0
**File:** MENU_FEATURES_ANALYSIS.md
