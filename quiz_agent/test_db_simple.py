#!/usr/bin/env python3
"""
Simple test to verify database service initialization
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_db_init():
    """Test database service initialization"""
    try:
        print("🔍 Testing database service initialization...")
        
        # Import the database service
        from services.database_service import db_service
        
        print(f"✅ Database service imported successfully")
        print(f"📊 Engine type: {type(db_service.engine)}")
        print(f"📊 Async session type: {type(db_service.async_session)}")
        
        # Check if async_session is callable
        if callable(db_service.async_session):
            print("✅ Async session is callable")
        else:
            print("❌ Async session is not callable")
            return False
        
        print("🎉 Database service initialization test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Database service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_db_init()
    if success:
        print("✅ All tests passed!")
    else:
        print("❌ Tests failed!")
        sys.exit(1) 