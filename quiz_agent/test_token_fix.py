#!/usr/bin/env python3
"""
Test script to verify the token service fix for Pydantic validation errors
"""

import asyncio
import sys
import os

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.token_service import TokenService, CustomFtTokenMetadata
from py_near.account import Account
from utils.config import Config

async def test_custom_metadata_model():
    """Test that our custom metadata model handles None values correctly"""
    print("Testing CustomFtTokenMetadata model...")
    
    # Test with None values for optional fields
    metadata = CustomFtTokenMetadata(
        spec="nep-141",
        name="Test Token",
        symbol="TEST",
        icon=None,
        reference=None,
        reference_hash=None,
        decimals=6
    )
    
    print(f"✅ CustomFtTokenMetadata created successfully:")
    print(f"   Name: {metadata.name}")
    print(f"   Symbol: {metadata.symbol}")
    print(f"   Reference: {metadata.reference}")
    print(f"   Reference Hash: {metadata.reference_hash}")
    print(f"   Icon: {metadata.icon}")
    
    return True

async def test_token_service_initialization():
    """Test that TokenService initializes without errors"""
    print("\nTesting TokenService initialization...")
    
    try:
        token_service = TokenService()
        print("✅ TokenService initialized successfully")
        return True
    except Exception as e:
        print(f"❌ TokenService initialization failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("🧪 Testing Token Service Fix for Pydantic Validation Errors\n")
    
    # Test 1: Custom metadata model
    test1_passed = await test_custom_metadata_model()
    
    # Test 2: Token service initialization
    test2_passed = await test_token_service_initialization()
    
    print(f"\n📊 Test Results:")
    print(f"   Custom Metadata Model: {'✅ PASS' if test1_passed else '❌ FAIL'}")
    print(f"   Token Service Init: {'✅ PASS' if test2_passed else '❌ FAIL'}")
    
    if test1_passed and test2_passed:
        print("\n🎉 All tests passed! The Pydantic validation error fix is working correctly.")
        return 0
    else:
        print("\n❌ Some tests failed. Please check the implementation.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
