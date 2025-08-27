#!/usr/bin/env python3
"""
Test script to verify mainnet implementation works correctly
"""

import asyncio
import os
import sys
from unittest.mock import patch, MagicMock

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from services.wallet_service import WalletService
from services.near_wallet_service import NEARWalletService
from utils.config import Config


async def test_wallet_creation_environment_detection():
    """Test that wallet creation uses the correct network based on environment"""
    print("🧪 Testing wallet creation environment detection...")

    wallet_service = WalletService()

    # Test development environment (should create testnet wallet)
    with patch.object(Config, "is_production", return_value=False):
        with patch.object(
            wallet_service.near_wallet_service, "create_testnet_wallet"
        ) as mock_testnet:
            mock_testnet.return_value = {
                "account_id": "test123.testnet",
                "network": "testnet",
                "is_testnet": True,
            }

            result = await wallet_service.create_demo_wallet(
                user_id=123, user_name="test_user"
            )

            mock_testnet.assert_called_once_with(123)
            assert result["network"] == "testnet"
            assert result["is_testnet"] == True
            print("✅ Development environment correctly creates testnet wallet")

    # Test production environment (should create mainnet wallet)
    with patch.object(Config, "is_production", return_value=True):
        with patch.object(wallet_service, "create_mainnet_wallet") as mock_mainnet:
            mock_mainnet.return_value = {
                "account_id": "test123.near",
                "network": "mainnet",
                "is_testnet": False,
            }

            result = await wallet_service.create_demo_wallet(
                user_id=123, user_name="test_user"
            )

            mock_mainnet.assert_called_once_with(123, "test_user")
            assert result["network"] == "mainnet"
            assert result["is_testnet"] == False
            print("✅ Production environment correctly creates mainnet wallet")


async def test_near_wallet_service_mainnet():
    """Test NEAR wallet service mainnet functionality"""
    print("\n🧪 Testing NEAR wallet service mainnet functionality...")

    near_service = NEARWalletService()

    # Test mainnet wallet creation
    with patch.object(Config, "is_mainnet_enabled", return_value=True):
        with patch.object(
            near_service, "_create_mainnet_sub_account", return_value=True
        ):
            with patch.object(near_service, "_encrypt_data") as mock_encrypt:
                mock_encrypt.return_value = (b"encrypted", b"iv", b"tag")

                result = await near_service.create_mainnet_wallet(user_id=456)

                assert result["network"] == "mainnet"
                assert result["is_testnet"] == False
                assert "account_id" in result
                assert "encrypted_private_key" in result
                print("✅ Mainnet wallet creation works correctly")

    # Test mainnet balance query
    with patch.object(
        near_service, "_get_balance_rpc_fallback", return_value="1.2345 NEAR"
    ):
        balance = await near_service.get_account_balance("test123.near", "mainnet")
        assert balance == "1.2345 NEAR"
        print("✅ Mainnet balance query works correctly")


async def test_config_environment_detection():
    """Test config environment detection methods"""
    print("\n🧪 Testing config environment detection...")

    # Test production detection
    with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
        assert Config.is_production() == True
        assert Config.is_development() == False
        print("✅ Production environment detection works")

    # Test development detection
    with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
        assert Config.is_production() == False
        assert Config.is_development() == True
        print("✅ Development environment detection works")

    # Test mainnet enabled detection
    with patch.dict(os.environ, {"ENABLE_NEAR_MAINNET": "true"}):
        assert Config.is_mainnet_enabled() == True
        print("✅ Mainnet enabled detection works")

    with patch.dict(os.environ, {"ENABLE_NEAR_MAINNET": "false"}):
        assert Config.is_mainnet_enabled() == False
        print("✅ Mainnet disabled detection works")


async def test_wallet_balance_network_detection():
    """Test wallet balance retrieval with network detection"""
    print("\n🧪 Testing wallet balance network detection...")

    wallet_service = WalletService()

    # Mock wallet data
    testnet_wallet = {"account_id": "test123.testnet", "network": "testnet"}

    mainnet_wallet = {"account_id": "test123.near", "network": "mainnet"}

    # Test testnet balance
    with patch.object(wallet_service, "get_user_wallet", return_value=testnet_wallet):
        with patch.object(
            wallet_service.near_wallet_service, "get_account_balance"
        ) as mock_balance:
            mock_balance.return_value = "0.5 NEAR"

            balance = await wallet_service.get_wallet_balance(user_id=123)

            mock_balance.assert_called_once_with("test123.testnet", "testnet")
            assert balance == "0.5 NEAR"
            print("✅ Testnet balance retrieval works correctly")

    # Test mainnet balance
    with patch.object(wallet_service, "get_user_wallet", return_value=mainnet_wallet):
        with patch.object(
            wallet_service.near_wallet_service, "get_account_balance"
        ) as mock_balance:
            mock_balance.return_value = "1.0 NEAR"

            balance = await wallet_service.get_wallet_balance(user_id=123)

            mock_balance.assert_called_once_with("test123.near", "mainnet")
            assert balance == "1.0 NEAR"
            print("✅ Mainnet balance retrieval works correctly")


async def main():
    """Run all tests"""
    print("🚀 Starting mainnet implementation tests...\n")

    try:
        await test_config_environment_detection()
        await test_wallet_creation_environment_detection()
        await test_near_wallet_service_mainnet()
        await test_wallet_balance_network_detection()

        print("\n🎉 All tests passed! Mainnet implementation is working correctly.")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback

        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
