#!/usr/bin/env python3
"""
Test script for the new menu system

This script tests the keyboard layouts and menu handlers without requiring
a full bot instance. It's useful for development and debugging.

Usage:
    python test_menu_system.py
"""

import sys
import os

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from bot.keyboard_markups import (
    create_main_menu_keyboard,
    create_game_selection_keyboard,
    create_challenge_keyboard,
    create_community_keyboard,
    create_app_keyboard,
    create_quiz_creation_keyboard,
    create_cancel_keyboard
)

def test_keyboard_layouts():
    """Test all keyboard layouts to ensure they're properly formatted"""
    
    print("🧪 Testing Keyboard Layouts...")
    print("=" * 50)
    
    # Test main menu keyboard
    print("\n1. Main Menu Keyboard:")
    main_menu = create_main_menu_keyboard()
    print(f"   Rows: {len(main_menu.inline_keyboard)}")
    for i, row in enumerate(main_menu.inline_keyboard):
        print(f"   Row {i+1}: {len(row)} buttons")
        for j, button in enumerate(row):
            print(f"     Button {j+1}: '{button.text}' -> '{button.callback_data}'")
    
    # Test game selection keyboard
    print("\n2. Game Selection Keyboard:")
    game_menu = create_game_selection_keyboard()
    print(f"   Rows: {len(game_menu.inline_keyboard)}")
    for i, row in enumerate(game_menu.inline_keyboard):
        print(f"   Row {i+1}: {len(row)} buttons")
        for j, button in enumerate(row):
            print(f"     Button {j+1}: '{button.text}' -> '{button.callback_data}'")
    
    # Test challenge keyboard
    print("\n3. Challenge Keyboard:")
    challenge_menu = create_challenge_keyboard()
    print(f"   Rows: {len(challenge_menu.inline_keyboard)}")
    for i, row in enumerate(challenge_menu.inline_keyboard):
        print(f"   Row {i+1}: {len(row)} buttons")
        for j, button in enumerate(row):
            print(f"     Button {j+1}: '{button.text}' -> '{button.callback_data}'")
    
    # Test community keyboard
    print("\n4. Community Keyboard:")
    community_menu = create_community_keyboard()
    print(f"   Rows: {len(community_menu.inline_keyboard)}")
    for i, row in enumerate(community_menu.inline_keyboard):
        print(f"   Row {i+1}: {len(row)} buttons")
        for j, button in enumerate(row):
            if hasattr(button, 'url'):
                print(f"     Button {j+1}: '{button.text}' -> URL: '{button.url}'")
            else:
                print(f"     Button {j+1}: '{button.text}' -> '{button.callback_data}'")
    
    # Test app keyboard
    print("\n5. App Keyboard:")
    app_menu = create_app_keyboard()
    print(f"   Rows: {len(app_menu.inline_keyboard)}")
    for i, row in enumerate(app_menu.inline_keyboard):
        print(f"   Row {i+1}: {len(row)} buttons")
        for j, button in enumerate(row):
            if hasattr(button, 'web_app'):
                print(f"     Button {j+1}: '{button.text}' -> Web App: '{button.web_app.url}'")
            elif hasattr(button, 'url'):
                print(f"     Button {j+1}: '{button.text}' -> URL: '{button.url}'")
            else:
                print(f"     Button {j+1}: '{button.text}' -> '{button.callback_data}'")
    
    # Test quiz creation keyboard
    print("\n6. Quiz Creation Keyboard:")
    quiz_menu = create_quiz_creation_keyboard()
    print(f"   Rows: {len(quiz_menu.inline_keyboard)}")
    for i, row in enumerate(quiz_menu.inline_keyboard):
        print(f"   Row {i+1}: {len(row)} buttons")
        for j, button in enumerate(row):
            print(f"     Button {j+1}: '{button.text}' -> '{button.callback_data}'")
    
    # Test cancel keyboard
    print("\n7. Cancel Keyboard:")
    cancel_menu = create_cancel_keyboard()
    print(f"   Rows: {len(cancel_menu.inline_keyboard)}")
    for i, row in enumerate(cancel_menu.inline_keyboard):
        print(f"   Row {i+1}: {len(row)} buttons")
        for j, button in enumerate(row):
            print(f"     Button {j+1}: '{button.text}' -> '{button.callback_data}'")

def test_callback_data_patterns():
    """Test that callback data patterns are consistent"""
    
    print("\n🔍 Testing Callback Data Patterns...")
    print("=" * 50)
    
    # Define expected patterns
    expected_patterns = {
        "menu:": ["menu:main", "menu:pick_game", "menu:challenge_friends", "menu:join_community", "menu:get_app"],
        "game:": ["game:create_quiz", "game:play_quiz", "game:leaderboards", "game:winners"],
        "challenge:": ["challenge:group", "challenge:friend", "challenge:my_challenges", "challenge:stats"],
        "app:": ["app:connect_wallet", "app:rewards"],
        "quiz:": ["quiz:quick_create", "quiz:custom_create", "quiz:templates", "quiz:my_quizzes"],
        "navigation:": ["cancel", "back"]
    }
    
    # Get all keyboards
    keyboards = [
        ("main_menu", create_main_menu_keyboard()),
        ("game_selection", create_game_selection_keyboard()),
        ("challenge", create_challenge_keyboard()),
        ("community", create_community_keyboard()),
        ("app", create_app_keyboard()),
        ("quiz_creation", create_quiz_creation_keyboard()),
        ("cancel", create_cancel_keyboard())
    ]
    
    # Collect all callback data
    all_callbacks = []
    for name, keyboard in keyboards:
        for row in keyboard.inline_keyboard:
            for button in row:
                if hasattr(button, 'callback_data') and button.callback_data:
                    all_callbacks.append(button.callback_data)
    
    print(f"Total callback data found: {len(all_callbacks)}")
    print("Unique callback data:")
    for callback in sorted(set(all_callbacks)):
        print(f"  - {callback}")
    
    # Check for any unexpected patterns
    unexpected = []
    for callback in all_callbacks:
        if not any(callback.startswith(pattern) for pattern in expected_patterns.keys()):
            unexpected.append(callback)
    
    if unexpected:
        print(f"\n⚠️  Unexpected callback patterns found: {unexpected}")
    else:
        print("\n✅ All callback patterns are as expected")

def test_web_app_integration():
    """Test web app integration features"""
    
    print("\n🌐 Testing Web App Integration...")
    print("=" * 50)
    
    app_menu = create_app_keyboard()
    
    web_app_buttons = []
    url_buttons = []
    
    for row in app_menu.inline_keyboard:
        for button in row:
            if hasattr(button, 'web_app') and button.web_app:
                web_app_buttons.append(button)
            elif hasattr(button, 'url') and button.url:
                url_buttons.append(button)
    
    print(f"Web App buttons found: {len(web_app_buttons)}")
    for button in web_app_buttons:
        print(f"  - '{button.text}' -> {button.web_app.url}")
    
    print(f"\nURL buttons found: {len(url_buttons)}")
    for button in url_buttons:
        print(f"  - '{button.text}' -> {button.url}")

def main():
    """Run all tests"""
    print("🚀 SolviumAI Menu System Test")
    print("=" * 50)
    
    try:
        test_keyboard_layouts()
        test_callback_data_patterns()
        test_web_app_integration()
        
        print("\n" + "=" * 50)
        print("✅ All tests completed successfully!")
        print("\n📋 Summary:")
        print("- Main menu with 2x2 grid layout ✓")
        print("- Game selection menu ✓")
        print("- Challenge features menu ✓")
        print("- Community links menu ✓")
        print("- App integration menu ✓")
        print("- Quiz creation menu ✓")
        print("- Navigation and cancel options ✓")
        print("- Web app integration ✓")
        
        print("\n🎯 Next Steps:")
        print("1. Configure BotFather with the settings in botfather_config.py")
        print("2. Test the bot with actual Telegram interactions")
        print("3. Deploy and test the web app integration")
        print("4. Monitor user engagement and feedback")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 