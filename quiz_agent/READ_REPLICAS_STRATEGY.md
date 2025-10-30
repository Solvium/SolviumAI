# Database Read Replicas Strategy

## Executive Summary

Read replicas separate read-heavy operations (leaderboards, stats) from write operations (answer saving, quiz creation), preventing read queries from blocking writes during high load.

## Current Architecture

```
All Operations → Primary PostgreSQL Database
                     ↓
        Reads + Writes on same server
                     ↓
        Write locks block reads
```

### Current Load Profile
- **Writes**: Quiz creation, answer saving, rewards (30% of queries)
- **Reads**: Leaderboards, user lookups, stats (70% of queries)
- **Problem**: Read queries wait for write locks to release

## Proposed Architecture

```
Write Operations → Primary Database (Master)
                       ↓
                  Replication →
                       ↓
Read Operations  → Read Replica 1 (Slave)
                → Read Replica 2 (Slave)
```

### Benefits
- **Write isolation**: Writes don't compete with reads
- **Read scaling**: Add more replicas as needed
- **High availability**: Replica can be promoted if primary fails
- **Geographic distribution**: Place replicas near users

## Implementation Guide

### Phase 1: Infrastructure Setup (Day 1-2)

**1. Create Read Replica (Database Provider)**

Most PostgreSQL hosting services provide one-click replica setup:

**Neon.tech:**
```bash
# Via Neon Console:
# 1. Go to your project
# 2. Click "Replicas" → "Create Read Replica"
# 3. Choose region (same as primary for latency)
# 4. Wait 5-10 minutes for initial sync
```

**AWS RDS:**
```bash
aws rds create-db-instance-read-replica \
    --db-instance-identifier myapp-read-replica \
    --source-db-instance-identifier myapp-primary \
    --db-instance-class db.t3.micro \
    --availability-zone us-east-1a
```

**DigitalOcean:**
```bash
# Via DO Console:
# Database → Your Cluster → Settings → Read-only Node
# Add node → Select same datacenter
```

**2. Update Environment Variables**

```bash
# .env
DATABASE_URL=postgresql://user:pass@primary-host:5432/db  # Primary (writes)
DATABASE_READ_URL=postgresql://user:pass@replica-host:5432/db  # Replica (reads)
```

### Phase 2: Code Implementation (Day 3-4)

**Update database.py:**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import random

# Create primary engine (writes)
primary_engine = create_db_engine(Config.DATABASE_URL)
PrimarySession = sessionmaker(bind=primary_engine)

# Create read replica engines (reads)
read_replica_urls = [
    Config.DATABASE_READ_URL,
    Config.DATABASE_READ_URL_2,  # Optional: multiple replicas
]

read_engines = [create_db_engine(url) for url in read_replica_urls if url]
ReadReplicaSession = sessionmaker(bind=random.choice(read_engines) if read_engines else primary_engine)

# Context managers
def get_write_db():
    """Use for: quiz creation, answer saving, user updates"""
    session = PrimarySession()
    try:
        yield session
    finally:
        session.close()

def get_read_db():
    """Use for: leaderboards, user lookups, stats"""
    engine = random.choice(read_engines) if read_engines else primary_engine
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
```

**Update quiz_service.py:**

```python
# WRITES - Use primary database
async def save_quiz_answers(user_id, quiz_id, answers):
    """Writes must go to primary"""
    with get_write_db() as session:
        # Save answers (writes)
        session.bulk_insert_mappings(QuizAnswer, answer_mappings)
        session.commit()

# READS - Use read replica
async def get_quiz_leaderboard(quiz_id):
    """Reads can use replica"""
    with get_read_db() as session:
        # Read leaderboard (no writes)
        leaderboard = session.query(QuizAnswer).filter(...).all()
        return leaderboard
```

### Phase 3: Query Classification (Day 5)

**Identify all database operations and classify:**

**WRITE Operations (Primary Only):**
```python
# quiz_service.py
- create_quiz()                    # Creates quiz
- finish_enhanced_quiz()           # Saves answers
- save_quiz_reward_details()       # Saves rewards

# user_service.py
- create_user()                    # Creates user
- link_wallet()                    # Updates wallet
- update_user_stats()              # Updates stats

# blockchain.py
- save_quiz_payment_hash()         # Saves transaction
- verify_transaction_by_hash()     # Writes verification result

# point_service.py
- award_quiz_taker_points()        # Adds points
- award_quiz_creator_points()      # Adds points
```

**READ Operations (Replica OK):**
```python
# quiz_service.py
- get_quiz_details()               # Fetches quiz
- get_quiz_leaderboard()           # Fetches leaderboard
- _generate_leaderboard_data()     # Generates rankings

# user_service.py
- get_user()                       # Fetches user
- get_user_quizzes()               # Fetches user history
- check_wallet_linked()            # Checks wallet status

# blockchain.py
- get_wallet_balance()             # Reads balance
- get_transaction_status()         # Reads TX status

# point_service.py
- get_user_points()                # Reads points
- get_leaderboard()                # Reads rankings
```

### Phase 4: Replication Lag Handling (Day 6)

**Problem:** Replica lags 100-500ms behind primary

**Scenario:**
```
1. User submits answer → Write to primary ✓
2. Redirect to leaderboard → Read from replica
3. Replica hasn't synced yet → User's answer missing ✗
```

**Solution 1: Read-after-write from Primary**
```python
async def finish_quiz_with_leaderboard(user_id, quiz_id):
    # Write answers to primary
    with get_write_db() as session:
        save_answers(session, user_id, quiz_id)
        session.commit()

    # Read leaderboard from PRIMARY (not replica) to see fresh data
    with get_write_db() as session:  # Use primary for consistency
        leaderboard = get_leaderboard(session, quiz_id)

    return leaderboard
```

**Solution 2: Delay Read**
```python
async def finish_quiz_with_leaderboard(user_id, quiz_id):
    # Write answers
    save_answers(user_id, quiz_id)

    # Wait for replication (100-200ms typical)
    await asyncio.sleep(0.5)

    # Read from replica
    leaderboard = get_leaderboard(quiz_id)
    return leaderboard
```

**Solution 3: Cache-Aside Pattern**
```python
async def get_leaderboard(quiz_id):
    # Check Redis cache first
    cached = await redis.get(f"leaderboard:{quiz_id}")
    if cached:
        return json.loads(cached)

    # Read from replica
    with get_read_db() as session:
        leaderboard = query_leaderboard(session, quiz_id)

    # Cache for 30 seconds
    await redis.setex(f"leaderboard:{quiz_id}", 30, json.dumps(leaderboard))
    return leaderboard
```

**Recommendation:** Use Solution 3 (caching) for best user experience

### Phase 5: Monitoring (Day 7)

**Add Replica Health Checks:**

```python
# monitoring.py
async def get_replication_status():
    """Check replica lag"""
    with get_read_db() as replica_session:
        result = replica_session.execute(
            "SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) AS lag_seconds"
        )
        lag = result.scalar()

    return {
        "replica_lag_seconds": lag,
        "replica_healthy": lag < 5.0,  # Alert if lag > 5 seconds
        "replica_connection": "ok",
    }
```

**Add to Stats Endpoint:**
```python
stats["database_replicas"] = {
    "primary": {
        "url": Config.DATABASE_URL,
        "connections": primary_engine.pool.checkedout(),
    },
    "replicas": [
        {
            "url": replica_url,
            "lag_seconds": await get_replication_lag(replica),
            "connections": replica_engine.pool.checkedout(),
        }
        for replica_url, replica in zip(replica_urls, read_engines)
    ],
}
```

## Query Routing Decision Matrix

| Operation | Primary or Replica? | Reason |
|-----------|---------------------|--------|
| Quiz creation | Primary | Write operation |
| Answer saving | Primary | Write operation |
| User registration | Primary | Write operation |
| Leaderboard view | Replica | Read-only, high frequency |
| User profile | Replica | Read-only, can tolerate lag |
| Quiz list | Replica | Read-only, cached anyway |
| Real-time stats | Primary | Need latest data |
| Admin dashboard | Replica | Analytics, can tolerate lag |
| Wallet balance | Replica | Read-only, cached |
| Transaction verify | Primary | Need immediate consistency |

## Performance Impact

### Before Replicas
```
Primary Database Load:
- Writes: 30 TPS
- Reads: 70 TPS
- Total: 100 TPS (hitting limits)
- Query latency: 50-100ms (high contention)
```

### After Replicas
```
Primary Database Load:
- Writes: 30 TPS (isolated)
- Query latency: 10-20ms (low contention)

Replica Database Load:
- Reads: 70 TPS (distributed)
- Query latency: 15-30ms (dedicated resources)

Result: 3-5× performance improvement for read-heavy operations
```

## Cost Analysis

### Infrastructure Cost
- **Primary database**: Existing ($20-50/month)
- **Read replica**: +$20-50/month per replica
- **Total**: $40-100/month (2× current cost)

### Performance Benefit
- **Read latency**: 50ms → 20ms (60% improvement)
- **Write latency**: 100ms → 20ms (80% improvement)
- **Capacity**: 100 TPS → 300+ TPS (3× scaling)

### ROI Calculation
- **Cost**: +$30/month
- **Benefit**: Handle 3× traffic without primary database upgrade
- **Alternative**: Upgrading primary would cost +$100/month
- **Savings**: $70/month

**Verdict:** Read replicas are cost-effective for scaling reads

## Rollout Plan

### Week 1: Setup & Testing
- Day 1-2: Provision replica, test replication
- Day 3-4: Implement code changes
- Day 5-6: Classify and update all queries
- Day 7: Load testing

### Week 2: Gradual Rollout
- Day 1: Deploy with feature flag OFF (primary only)
- Day 2-3: Enable for analytics queries only
- Day 4-5: Enable for leaderboards
- Day 6-7: Enable for all read operations

### Week 3: Monitoring & Optimization
- Monitor replica lag
- Optimize slow queries
- Add caching where needed
- Fine-tune connection pools

## Alternative Approaches

### Option A: Query Caching (Simpler)
Instead of replicas, aggressively cache read queries:
- **Pros**: No infrastructure changes, immediate deployment
- **Cons**: Cache invalidation complexity, stale data possible
- **Best for**: <200 concurrent users

### Option B: Connection Pooling Optimization (Free)
Increase connection pools, optimize queries:
- **Pros**: Zero cost, quick win
- **Cons**: Limited scaling, doesn't solve read/write contention
- **Best for**: Buying time before replica deployment

### Option C: Sharding (Advanced)
Split data across multiple databases:
- **Pros**: Near-infinite scaling
- **Cons**: Very complex, requires app-level routing
- **Best for**: >10,000 concurrent users

## Recommendation

**Current State (Phase 1 & 2):**
- ✅ Connection pool optimized (30+50)
- ✅ Bulk operations reduce write pressure
- ✅ Good for 200-300 concurrent users

**When to Add Replicas:**
- 🟡 At 300+ concurrent users
- 🟡 When primary CPU consistently >70%
- 🟡 When read query latency >50ms

**Immediate Action:**
- 📊 Monitor primary database load
- 📊 Track read vs write query ratio
- 📊 Measure query latencies

**When to Implement:**
- ✅ **NOW** if scaling to 500+ users is planned
- ⏸️ **Later** if current 100-200 user capacity is sufficient
- ❌ **Never** if staying below 100 concurrent users

---

**Generated as part of Phase 3 Performance Optimization**
**Status: Documentation Complete - Implement When Scaling Beyond 300 Users**
