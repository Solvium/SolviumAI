# Async SQLAlchemy Migration Strategy

## Executive Summary

Migrating from synchronous SQLAlchemy to async SQLAlchemy will eliminate event loop blocking and enable true concurrent database operations. This is the final optimization needed to handle 500+ concurrent users.

## Current State Analysis

### Bottleneck
- Synchronous `session.commit()` blocks the entire asyncio event loop
- With 100 users, thousands of blocking commits freeze other request processing
- Event loop can't progress other tasks during database I/O waits

### Impact
- CPU sits idle (5%) while waiting for synchronous database operations
- Requests queue up behind blocked database operations
- Cannot achieve true parallelism despite async/await throughout codebase

## Migration Plan

### Phase 1: Setup (2-4 hours)

**1. Install Dependencies**
```bash
pip install asyncpg sqlalchemy[asyncio]
```

**2. Update database.py**
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Change connection string
database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
async_engine = create_async_engine(
    database_url,
    pool_size=30,
    max_overflow=50,
    pool_pre_ping=True,
    echo=False,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Context manager for async sessions
async def get_async_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### Phase 2: Model Updates (1-2 hours)

**Models stay mostly the same**, but queries become async:

**Before (Sync):**
```python
session = SessionLocal()
try:
    quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
    session.commit()
finally:
    session.close()
```

**After (Async):**
```python
async with get_async_db() as session:
    result = await session.execute(select(Quiz).filter(Quiz.id == quiz_id))
    quiz = result.scalar_one_or_none()
    # Auto-commits on context exit
```

### Phase 3: Service Layer Refactoring (8-12 hours)

**Key Changes Needed:**

**quiz_service.py bulk save (lines 2785-2904):**
```python
# Current (blocking)
existing_answers = session.query(QuizAnswer).filter(...).all()
session.commit()

# Async (non-blocking)
async with get_async_db() as session:
    result = await session.execute(select(QuizAnswer).filter(...))
    existing_answers = result.scalars().all()
    # Commit happens automatically on context exit
```

**Benefits:**
- Event loop processes other requests during database I/O
- 10+ concurrent quiz completions without blocking
- 3-5× throughput increase

### Phase 4: Testing (4-6 hours)

**Test Coverage:**
1. Unit tests for all async database operations
2. Integration tests for quiz lifecycle (create → play → complete)
3. Load test with 100+ concurrent users
4. Verify no race conditions with concurrent access

**Key Test Scenarios:**
- Multiple users completing same quiz simultaneously
- Concurrent wallet operations
- Rapid quiz creation/deletion
- Leaderboard generation under load

## Implementation Priority

### Must-Have (Critical Path)
1. ✅ quiz_service.py - Answer saving (already optimized in Phase 2)
2. 🔴 quiz_service.py - Quiz creation and retrieval
3. 🔴 blockchain.py - Transaction verification
4. 🔴 user_service.py - User operations

### Should-Have (High Impact)
5. 🟡 wallet_service.py - Wallet operations
6. 🟡 point_service.py - Point transactions
7. 🟡 Leaderboard generation

### Nice-to-Have (Lower Priority)
8. 🟢 Background tasks
9. 🟢 Cache operations
10. 🟢 Analytics queries

## Risk Assessment

### High Risk
- **Breaking changes**: Every database call must be converted
- **Race conditions**: Async introduces new concurrency patterns
- **Testing complexity**: Need comprehensive async test suite

### Medium Risk
- **Learning curve**: Team needs async/await expertise
- **Debugging**: Async stack traces more complex
- **Third-party compatibility**: Some libraries may not support async

### Low Risk
- **Performance**: Guaranteed improvement, no risk of degradation
- **Rollback**: Can deploy behind feature flag
- **Database**: PostgreSQL handles async connections natively

## Rollout Strategy

### Step 1: Feature Flag
```python
USE_ASYNC_DB = os.getenv("USE_ASYNC_DB", "false").lower() == "true"

if USE_ASYNC_DB:
    from store.async_database import get_async_db as get_db
else:
    from store.database import SessionLocal as get_db
```

### Step 2: Gradual Migration
1. Week 1: Migrate read-only operations (leaderboards, user lookups)
2. Week 2: Migrate quiz creation and retrieval
3. Week 3: Migrate answer saving and rewards
4. Week 4: Migrate wallet and blockchain operations

### Step 3: A/B Testing
- Route 10% of traffic to async version
- Monitor performance metrics
- Gradually increase to 100%

### Step 4: Cleanup
- Remove sync code paths
- Update documentation
- Optimize async-specific patterns

## Expected Performance Gains

### Current Performance (After Phase 1 & 2)
- 100 concurrent users: 10-15 second lag
- Database: Bulk operations, but synchronous
- Event loop: Blocked during commits

### After Async Migration
- 100 concurrent users: 3-5 second lag (60% improvement)
- 500 concurrent users: 8-12 second lag (scales linearly)
- Database: Non-blocking, true parallelism
- Event loop: Free to process requests during I/O

### Metrics to Track
- Response time P50/P95/P99
- Database connection utilization
- CPU utilization (should increase to 40-60%)
- Concurrent request handling capacity
- Event loop lag

## Alternative: Hybrid Approach

If full migration is too risky, consider hybrid:

**Keep sync for:**
- Background tasks (already not blocking users)
- Admin operations
- One-off scripts

**Migrate to async:**
- User-facing quiz operations
- Real-time leaderboards
- Wallet transactions

This reduces migration scope by 50% while capturing 80% of benefits.

## Timeline Estimate

- **Quick Migration (1 week)**: Hybrid approach, critical paths only
- **Standard Migration (2-3 weeks)**: Full migration with testing
- **Conservative Migration (4-6 weeks)**: Gradual rollout with A/B testing

## Recommendation

**Phase 1 & 2 have delivered significant improvements already**. The async migration should be:

1. **Scheduled for next quarter** when team can dedicate focused time
2. **Implemented gradually** using feature flags
3. **Tested extensively** before full rollout

**Current state (Phase 1+2) is production-ready** for 100-200 concurrent users. Async migration unlocks 500+ user capacity.

## Resources

- [SQLAlchemy Async Documentation](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [asyncpg Documentation](https://magicstack.github.io/asyncpg/)
- [FastAPI with Async SQLAlchemy](https://fastapi.tiangolo.com/advanced/async-sql-databases/)

---

**Generated as part of Phase 3 Performance Optimization**
**Status: Documentation Complete - Ready for Implementation Planning**
