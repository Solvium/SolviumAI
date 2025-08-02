#!/usr/bin/env python3
"""
Test database service initialization
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Add src to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

from services.database_service import db_service
import asyncio

async def test_db_service():
    """Test database service initialization"""
    try:
        print("🔍 Testing database service...")
        
        # Check if async_session is initialized
        if db_service.async_session:
            print("✅ Database service async_session is initialized")
            
            # Test creating a session
            try:
                async with db_service.async_session() as session:
                    print("✅ Database session created successfully")
                    return True
            except Exception as e:
                print(f"❌ Failed to create database session: {e}")
                return False
        else:
            print("❌ Database service async_session is None")
            return False
            
    except Exception as e:
        print(f"❌ Database service test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_db_service())
    if success:
        print("✅ Database service test passed!")
    else:
        print("❌ Database service test failed!")
        sys.exit(1) 