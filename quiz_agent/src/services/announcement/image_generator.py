"""
Dynamic Quiz Announcement Image Generator

Creates visually appealing announcement images for quiz competitions using PIL.
Images include quiz name and reward amount with a modern, gaming-inspired design.
"""

import asyncio
import io
import logging
import textwrap
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import colorsys

logger = logging.getLogger(__name__)


class QuizImageGenerator:
    """
    Generate dynamic quiz announcement images with modern design elements.
    """

    def __init__(self):
        self.width = 1000  # Increased from 800
        self.height = 700   # Increased from 600
        self.font_cache = {}
        self.template_cache = {}

        # Assets paths
        self.assets_dir = Path(__file__).parent.parent.parent / "assets"
        self.fonts_dir = self.assets_dir / "fonts"
        self.templates_dir = self.assets_dir / "templates"

        # Color schemes
        self.color_schemes = {
            "default": {
                "primary": "#FF6B35",  # Orange
                "secondary": "#F7931E",  # Golden orange
                "accent": "#FFD700",  # Gold
                "background": "#1A1A2E",  # Dark blue
                "text": "#FFFFFF",  # White
                "shadow": "#000000",  # Black
            },
            "crypto": {
                "primary": "#00D4AA",  # Teal
                "secondary": "#0096C7",  # Blue
                "accent": "#48CAE4",  # Light blue
                "background": "#03045E",  # Navy
                "text": "#FFFFFF",
                "shadow": "#000814",
            },
            "gaming": {
                "primary": "#E63946",  # Red
                "secondary": "#F77F00",  # Orange
                "accent": "#FCBF49",  # Yellow
                "background": "#2A0845",  # Purple
                "text": "#FFFFFF",
                "shadow": "#14213D",
            },
            "tech": {
                "primary": "#7209B7",  # Purple
                "secondary": "#A663CC",  # Light purple
                "accent": "#4CC9F0",  # Cyan
                "background": "#0D1B2A",  # Dark blue
                "text": "#FFFFFF",
                "shadow": "#415A77",
            },
        }

    def _get_font_path(self, font_name: str) -> Optional[Path]:
        """Get font path, with fallbacks for system fonts."""
        # Try custom fonts first
        custom_font = self.fonts_dir / font_name
        if custom_font.exists():
            return custom_font

        # System font fallbacks
        system_fonts = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Windows/Fonts/arial.ttf",
        ]

        for font_path in system_fonts:
            if Path(font_path).exists():
                return Path(font_path)

        return None

    def _get_font(self, size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
        """Get font with caching."""
        cache_key = (size, bold)
        if cache_key in self.font_cache:
            return self.font_cache[cache_key]

        font_names = [
            "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
            "arial-bold.ttf" if bold else "arial.ttf",
            "helvetica-bold.ttf" if bold else "helvetica.ttf",
        ]

        font = None
        for font_name in font_names:
            font_path = self._get_font_path(font_name)
            if font_path:
                try:
                    font = ImageFont.truetype(str(font_path), size)
                    break
                except Exception as e:
                    logger.warning(f"Failed to load font {font_path}: {e}")
                    continue

        if not font:
            # Fallback to default font
            try:
                font = ImageFont.load_default()
            except Exception:
                # Ultimate fallback
                font = ImageFont.load_default()

        self.font_cache[cache_key] = font
        return font

    def _create_gradient_background(self, colors: Dict[str, str]) -> Image.Image:
        """Create a gradient background with modern design."""
        img = Image.new("RGB", (self.width, self.height), colors["background"])
        draw = ImageDraw.Draw(img)

        # Create diagonal gradient effect
        for i in range(self.height):
            # Calculate gradient position (0 to 1)
            progress = i / self.height

            # Create color interpolation
            primary_rgb = self._hex_to_rgb(colors["primary"])
            secondary_rgb = self._hex_to_rgb(colors["secondary"])

            # Interpolate colors
            r = int(primary_rgb[0] * (1 - progress) + secondary_rgb[0] * progress)
            g = int(primary_rgb[1] * (1 - progress) + secondary_rgb[1] * progress)
            b = int(primary_rgb[2] * (1 - progress) + secondary_rgb[2] * progress)

            # Add some curve to the gradient
            alpha = int(128 * (0.5 + 0.5 * progress))

            # Draw gradient line
            overlay = Image.new("RGBA", (self.width, 1), (r, g, b, alpha))
            img.paste(overlay, (0, i), overlay)

        return img

    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to RGB tuple."""
        hex_color = hex_color.lstrip("#")
        return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))

    def _add_geometric_shapes(
        self, draw: ImageDraw.Draw, colors: Dict[str, str]
    ) -> None:
        """Add modern geometric design elements."""
        # Add some circles and shapes for visual interest
        accent_rgb = self._hex_to_rgb(colors["accent"])
        secondary_rgb = self._hex_to_rgb(colors["secondary"])

        # Large circle (top right)
        circle_size = 150
        circle_x = self.width - circle_size + 50
        circle_y = -50
        draw.ellipse(
            [circle_x, circle_y, circle_x + circle_size, circle_y + circle_size],
            fill=(*accent_rgb, 80),
        )

        # Medium circle (bottom left)
        circle_size = 100
        circle_x = -30
        circle_y = self.height - circle_size + 30
        draw.ellipse(
            [circle_x, circle_y, circle_x + circle_size, circle_y + circle_size],
            fill=(*secondary_rgb, 60),
        )

        # Small accent shapes
        for i in range(3):
            x = 50 + i * 200
            y = 50 + i * 30
            size = 20 + i * 10
            draw.ellipse([x, y, x + size, y + size], fill=(*accent_rgb, 40))

    def _draw_text_with_shadow(
        self,
        draw: ImageDraw.Draw,
        text: str,
        position: Tuple[int, int],
        font: ImageFont.FreeTypeFont,
        fill_color: str,
        shadow_color: str = "#000000",
        shadow_offset: Tuple[int, int] = (3, 3),
    ) -> None:
        """Draw text with shadow effect."""
        x, y = position
        shadow_x, shadow_y = shadow_offset

        # Draw shadow
        draw.text((x + shadow_x, y + shadow_y), text, font=font, fill=shadow_color)

        # Draw main text
        draw.text((x, y), text, font=font, fill=fill_color)

    def _wrap_text(
        self, text: str, font: ImageFont.FreeTypeFont, max_width: int
    ) -> list:
        """Wrap text to fit within max_width."""
        words = text.split()
        lines = []
        current_line = []

        for word in words:
            test_line = " ".join(current_line + [word])
            bbox = font.getbbox(test_line)
            text_width = bbox[2] - bbox[0]

            if text_width <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                    current_line = [word]
                else:
                    # Word is too long, add it anyway
                    lines.append(word)

        if current_line:
            lines.append(" ".join(current_line))

        return lines

    def _detect_quiz_theme(self, quiz_name: str) -> str:
        """Detect quiz theme based on quiz name for color scheme selection."""
        quiz_lower = quiz_name.lower()

        if any(
            word in quiz_lower
            for word in ["crypto", "blockchain", "bitcoin", "near", "defi", "web3"]
        ):
            return "crypto"
        elif any(word in quiz_lower for word in ["gaming", "game", "esports", "gamer"]):
            return "gaming"
        elif any(
            word in quiz_lower
            for word in ["tech", "technology", "programming", "coding", "ai"]
        ):
            return "tech"
        else:
            return "default"

    async def generate_quiz_announcement(
        self,
        quiz_name: str,
        reward_amount: float = 0.0,
        reward_currency: str = "NEAR",
        theme: Optional[str] = None,
    ) -> bytes:
        """
        Generate a dynamic quiz announcement image.

        Args:
            quiz_name: Name of the quiz
            reward_amount: Reward amount (0 for free quiz)
            reward_currency: Currency symbol (default: NEAR)
            theme: Optional theme override

        Returns:
            bytes: PNG image data
        """
        try:
            # Auto-detect theme if not provided
            if not theme:
                theme = self._detect_quiz_theme(quiz_name)

            colors = self.color_schemes.get(theme, self.color_schemes["default"])

            # Create base image with gradient background
            img = self._create_gradient_background(colors)

            # Create overlay for shapes
            overlay = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)

            # Add geometric shapes
            self._add_geometric_shapes(overlay_draw, colors)

            # Blend overlay with base image
            img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

            # Create main drawing context
            draw = ImageDraw.Draw(img)

            # Title "QUIZ ANNOUNCEMENT"
            title_font = self._get_font(64, bold=True)  # Increased from 52 to 64
            title_text = "QUIZ ANNOUNCEMENT"
            title_bbox = title_font.getbbox(title_text)
            title_width = title_bbox[2] - title_bbox[0]
            title_x = (self.width - title_width) // 2
            title_y = 30  # Moved up from 40

            # Draw title without shadow
            draw.text((title_x, title_y), title_text, font=title_font, fill=colors["accent"])

            # Quiz name (main focus)
            quiz_font = self._get_font(96, bold=True)  # Increased from 72 to 96
            max_quiz_width = self.width - 100  # Leave margin

            # Wrap quiz name if too long
            quiz_lines = self._wrap_text(quiz_name, quiz_font, max_quiz_width)

            # Calculate vertical position for quiz name
            line_height = quiz_font.getbbox("Ay")[3] - quiz_font.getbbox("Ay")[1] + 15
            total_quiz_height = len(quiz_lines) * line_height
            quiz_y_start = (self.height - total_quiz_height) // 2 - 90  # Moved up 70px from -20

            # Draw each line of quiz name without shadow
            for i, line in enumerate(quiz_lines):
                line_bbox = quiz_font.getbbox(line)
                line_width = line_bbox[2] - line_bbox[0]
                line_x = (self.width - line_width) // 2
                line_y = quiz_y_start + i * line_height

                # Draw main text without shadow
                draw.text((line_x, line_y), line, font=quiz_font, fill=colors["text"])

            # Reward information
            reward_y = quiz_y_start + total_quiz_height + 50  # Increased spacing

            if reward_amount > 0:
                reward_text = f"💰 {reward_amount} {reward_currency} REWARD"
                reward_font = self._get_font(60, bold=True)  # Increased from 48 to 60

                reward_bbox = reward_font.getbbox(reward_text)
                reward_width = reward_bbox[2] - reward_bbox[0]
                reward_x = (self.width - reward_width) // 2

                # Create reward background
                padding = 30  # Increased padding
                reward_bg_x1 = reward_x - padding
                reward_bg_y1 = reward_y - 20  # Increased vertical padding
                reward_bg_x2 = reward_x + reward_width + padding
                reward_bg_y2 = reward_y + reward_bbox[3] - reward_bbox[1] + 20

                # Draw reward background with rounded corners effect
                reward_bg_color = self._hex_to_rgb(colors["primary"])
                draw.rounded_rectangle(
                    [reward_bg_x1, reward_bg_y1, reward_bg_x2, reward_bg_y2],
                    radius=25,  # Increased radius
                    fill=(*reward_bg_color, 200),
                )

                # Draw reward text without shadow
                draw.text((reward_x, reward_y), reward_text, font=reward_font, fill=colors["text"])
            else:
                # Free quiz
                free_text = "🎯 FREE QUIZ"
                free_font = self._get_font(56, bold=True)  # Increased from 42 to 56

                free_bbox = free_font.getbbox(free_text)
                free_width = free_bbox[2] - free_bbox[0]
                free_x = (self.width - free_width) // 2

                # Draw free text without shadow
                draw.text((free_x, reward_y), free_text, font=free_font, fill=colors["accent"])

            # Call to action
            cta_y = self.height - 80  # Moved up slightly
            cta_text = "🎮 JOIN THE CHALLENGE!"
            cta_font = self._get_font(36, bold=True)  # Increased from 24 to 36

            cta_bbox = cta_font.getbbox(cta_text)
            cta_width = cta_bbox[2] - cta_bbox[0]
            cta_x = (self.width - cta_width) // 2

            self._draw_text_with_shadow(
                draw,
                cta_text,
                (cta_x, cta_y),
                cta_font,
                colors["secondary"],
                colors["shadow"],
                (4, 4)  # Added shadow offset
            )

            # Convert to bytes
            img_buffer = io.BytesIO()
            img.save(img_buffer, format="PNG", quality=95, optimize=True)
            img_buffer.seek(0)

            logger.info(
                f"Generated quiz announcement image for '{quiz_name}' with {reward_amount} {reward_currency} reward"
            )

            return img_buffer.getvalue()

        except Exception as e:
            logger.error(f"Error generating quiz announcement image: {e}")
            raise

    def generate_quiz_announcement_sync(
        self,
        quiz_name: str,
        reward_amount: float = 0.0,
        reward_currency: str = "NEAR",
        theme: Optional[str] = None,
    ) -> bytes:
        """Synchronous version of generate_quiz_announcement."""
        return asyncio.run(
            self.generate_quiz_announcement(
                quiz_name, reward_amount, reward_currency, theme
            )
        )


# Global instance for reuse
_generator_instance = None


def get_image_generator() -> QuizImageGenerator:
    """Get a singleton instance of the image generator."""
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = QuizImageGenerator()
    return _generator_instance


async def generate_quiz_image(
    quiz_name: str,
    reward_amount: float = 0.0,
    reward_currency: str = "NEAR",
    theme: Optional[str] = None,
) -> bytes:
    """
    Convenience function to generate quiz announcement images.

    Args:
        quiz_name: Name of the quiz
        reward_amount: Reward amount (0 for free quiz)
        reward_currency: Currency symbol
        theme: Optional theme ('crypto', 'gaming', 'tech', 'default')

    Returns:
        bytes: PNG image data
    """
    generator = get_image_generator()
    return await generator.generate_quiz_announcement(
        quiz_name, reward_amount, reward_currency, theme
    )
