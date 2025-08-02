#!/usr/bin/env python3
"""
Test to verify wallet saving functionality
"""

import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

async def test_wallet_save():
    """Test wallet saving functionality"""
    try:
        print("🔍 Testing wallet save functionality...")
        
        # Import the database service
        from services.database_service import db_service
        
        # Create a test wallet info
        test_wallet_info = {
            'account_id': 'test123.kindpuma8958.testnet',
            'public_key': 'ed25519:testpublickey123',
            'encrypted_private_key': 'encrypted_test_key',
            'iv': 'test_iv_123',
            'tag': 'test_tag_123',
            'is_demo': True,
            'network': 'testnet'
        }
        
        test_user_id = 999999  # Use a test user ID
        test_user_name = "Test User"
        
        print(f"📝 Attempting to save wallet for test user {test_user_id}...")
        
        # Try to save the wallet
        result = await db_service.save_wallet_async(test_wallet_info, test_user_id, test_user_name)
        
        if result:
            print("✅ Wallet save operation queued successfully")
        else:
            print("❌ Wallet save operation failed")
            return False
        
        # Wait a bit for the background task to complete
        print("⏳ Waiting for background save to complete...")
        await asyncio.sleep(2)
        
        # Check if the wallet was saved
        wallet_data = await db_service.get_user_wallet(test_user_id)
        if wallet_data:
            print("✅ Wallet data retrieved successfully")
            print(f"📊 Account ID: {wallet_data.get('account_id')}")
            return True
        else:
            print("❌ Wallet data not found after save")
            return False
        
    except Exception as e:
        print(f"❌ Wallet save test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_wallet_save())
    if success:
        print("✅ All wallet save tests passed!")
    else:
        print("❌ Wallet save tests failed!")
        sys.exit(1) 