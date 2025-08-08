#!/usr/bin/env python3
"""
Quick start script for SolviumAI Quiz Bot.
This script helps users get started quickly with the right configuration.
"""
import os
import sys


def main():
    print("🤖 SolviumAI Quiz Bot - FastAPI Integration")
    print("=" * 50)
    print()

    # Check if FastAPI is installed
    try:
        import fastapi
        import uvicorn

        fastapi_available = True
        print("✅ FastAPI dependencies are installed")
    except ImportError:
        fastapi_available = False
        print("❌ FastAPI dependencies not found")
        print("   Run: pip install fastapi uvicorn python-multipart")
        print()

    # Check environment file
    env_file = ".env"
    if os.path.exists(env_file):
        print(f"✅ Environment file found: {env_file}")
    else:
        print(f"❌ Environment file not found: {env_file}")
        print("   Copy .env.example to .env and configure your settings")
        print()

    # Check telegram token
    from dotenv import load_dotenv

    load_dotenv()

    telegram_token = os.getenv("TELEGRAM_TOKEN")
    webhook_url = os.getenv("WEBHOOK_URL")
    environment = os.getenv("ENVIRONMENT", "development")

    if telegram_token:
        print("✅ Telegram token configured")
    else:
        print("❌ Telegram token not configured")
        print("   Set TELEGRAM_TOKEN in your .env file")
        print()

    print(f"🌍 Environment: {environment}")

    if webhook_url:
        print(f"🔗 Webhook URL: {webhook_url}")
        if fastapi_available:
            print("🚀 Will use FastAPI webhook mode")
        else:
            print("⚠️  Will use legacy webhook mode (FastAPI not available)")
    else:
        print("📡 Polling mode (no webhook URL configured)")

    print()
    print("🎯 Starting the bot...")
    print("   python main.py")
    print()

    # Import and run main
    sys.path.append(os.path.dirname(__file__))
    from main import main
    import asyncio

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Bot stopped by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
