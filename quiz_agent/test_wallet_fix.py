#!/usr/bin/env python3
"""
Simple test to verify wallet creation method call works correctly
"""

import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.wallet_service import WalletService
from utils.config import Config


async def test_wallet_creation_call():
    """Test that the wallet creation method can be called correctly"""
    print("🧪 Testing wallet creation method call...")
    
    wallet_service = WalletService()
    
    try:
        # Test the method call that was failing
        # This should not raise an argument error anymore
        result = await wallet_service.create_demo_wallet(
            user_id=123, 
            user_name="test_user"
        )
        print("✅ Wallet creation method call works correctly")
        print(f"   Result keys: {list(result.keys())}")
        print(f"   Network: {result.get('network', 'unknown')}")
        print(f"   Account ID: {result.get('account_id', 'unknown')}")
        
    except Exception as e:
        print(f"❌ Wallet creation method call failed: {e}")
        return False
    
    return True


async def main():
    """Run the test"""
    print("🚀 Testing wallet creation fix...\n")
    
    print(f"Environment: {Config.ENVIRONMENT}")
    print(f"Is Production: {Config.is_production()}")
    print(f"Mainnet Enabled: {Config.is_mainnet_enabled()}\n")
    
    success = await test_wallet_creation_call()
    
    if success:
        print("\n🎉 Test passed! Wallet creation should work correctly now.")
    else:
        print("\n❌ Test failed! There's still an issue.")
    
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
