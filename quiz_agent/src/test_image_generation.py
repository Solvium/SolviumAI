#!/usr/bin/env python3
"""
Test script for quiz image generation functionality.
"""

import asyncio
import sys
import logging
from pathlib import Path

# Add the src directory to the path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

from services.announcement.image_generator import generate_quiz_image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_image_generation():
    """Test the image generation functionality."""

    test_cases = [
        {
            "name": "GAMEPHOBIA QUIZ",
            "reward": 5.0,
            "currency": "NEAR",
            "theme": "gaming"
        },
        {
            "name": "Crypto Knowledge Challenge",
            "reward": 2.5,
            "currency": "NEAR",
            "theme": "crypto"
        },
        {
            "name": "Free General Knowledge Quiz",
            "reward": 0.0,
            "currency": "NEAR",
            "theme": "default"
        },
        {
            "name": "Tech Innovation Quiz",
            "reward": 1.0,
            "currency": "NEAR",
            "theme": "tech"
        }
    ]

    output_dir = Path(__file__).parent / "test_images"
    output_dir.mkdir(exist_ok=True)

    for i, test_case in enumerate(test_cases):
        try:
            logger.info(f"Generating image {i+1}/{len(test_cases)}: {test_case['name']}")

            image_data = await generate_quiz_image(
                quiz_name=test_case["name"],
                reward_amount=test_case["reward"],
                reward_currency=test_case["currency"],
                theme=test_case["theme"]
            )

            # Save the image
            filename = f"test_quiz_{i+1}_{test_case['theme']}.png"
            output_path = output_dir / filename

            with open(output_path, "wb") as f:
                f.write(image_data)

            logger.info(f"✅ Generated image: {output_path}")

        except Exception as e:
            logger.error(f"❌ Failed to generate image for {test_case['name']}: {e}")
            import traceback
            traceback.print_exc()

    logger.info(f"Test completed. Images saved to: {output_dir}")


if __name__ == "__main__":
    asyncio.run(test_image_generation())
