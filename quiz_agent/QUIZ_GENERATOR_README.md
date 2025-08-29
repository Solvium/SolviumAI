# Robust Quiz Generator

A robust, production-ready quiz generation system that creates high-quality multiple-choice questions using AI. The system includes comprehensive error handling, logging, configuration management, and can run as a standalone application.

## Features

- **Robust Error Handling**: Comprehensive error handling with retry logic and graceful fallbacks
- **Logging**: Detailed logging with configurable levels
- **Configuration Management**: Centralized configuration with environment variable support
- **Async Support**: Full async/await support for better performance
- **Search Integration**: Optional web search integration for current information
- **Multiple Generation Methods**: Both advanced and simple generation approaches
- **Standalone Operation**: Can run independently without external dependencies
- **Command Line Interface**: Built-in CLI for easy usage

## Installation

1. **Install dependencies**:

   ```bash
   pip install -r quiz_requirements.txt
   ```

2. **Set up API keys**:

   - **Google Gemini API Key**: Required for quiz generation
   - **Serper API Key**: Optional, for web search functionality

   You can set these as environment variables:

   ```bash
   export GOOGLE_GEMINI_API_KEY="your_google_api_key"
   export SERPER_API_KEY="your_serper_api_key"  # Optional
   ```

   Or you'll be prompted to enter them when running the application.

## Usage

### Command Line Interface

The quiz generator includes a built-in CLI for easy usage:

```bash
# Basic usage
python src/better_agent.py "Python Programming" --num-questions 3

# With difficulty level
python src/better_agent.py "Machine Learning" --difficulty hard --num-questions 2

# With additional context
python src/better_agent.py "Web Development" --context "Focus on modern frameworks like React and Vue"

# Include current information (requires Serper API key)
python src/better_agent.py "AI" --include-current

# Use simple generation method
python src/better_agent.py "Data Science" --simple

# Set logging level
python src/better_agent.py "Blockchain" --log-level DEBUG
```

### Programmatic Usage

```python
import asyncio
from src.better_agent import AdvancedQuizGenerator, Config

async def main():
    # Create configuration
    config = Config(
        google_api_key="your_api_key",
        serper_api_key="your_serper_key",  # Optional
        temperature=0.4,
        max_retries=3
    )

    # Create generator
    generator = AdvancedQuizGenerator(config)

    # Generate quiz
    questions = await generator.generate_quiz(
        topic="Python Programming",
        num_questions=3,
        difficulty="medium",
        include_current_info=True
    )

    # Process results
    for i, question in enumerate(questions, 1):
        print(f"Question {i}: {question.question}")
        for key, value in question.options.items():
            print(f"  {key}) {value}")
        print(f"Correct Answer: {question.correct_answer}")
        print(f"Explanation: {question.explanation}")

# Run
asyncio.run(main())
```

### Convenience Functions

For simpler usage, you can use the convenience functions:

```python
import asyncio
from src.better_agent import generate_quiz, generate_quiz_simple

async def example():
    # Advanced generation
    result = await generate_quiz(
        topic="Machine Learning",
        num_questions=2,
        difficulty="medium",
        context_text="Focus on neural networks"
    )
    print(result)

    # Simple generation
    result = await generate_quiz_simple(
        topic="Data Science",
        num_questions=1
    )
    print(result)

asyncio.run(example())
```

## Configuration

The `Config` class allows you to customize various aspects of the quiz generator:

```python
from src.better_agent import Config

config = Config(
    google_api_key="your_key",
    serper_api_key="your_serper_key",
    model_name="gemini-2.0-flash",
    temperature=0.4,
    max_tokens=1000,
    search_timeout=8,
    llm_timeout=15,
    max_retries=3,
    log_level="INFO"
)
```

### Configuration Options

- `google_api_key`: Google Gemini API key (required)
- `serper_api_key`: Serper API key for web search (optional)
- `model_name`: AI model to use (default: "gemini-2.0-flash")
- `temperature`: Creativity level (0.0-1.0, default: 0.4)
- `max_tokens`: Maximum tokens for AI responses (default: 1000)
- `search_timeout`: Search API timeout in seconds (default: 8)
- `llm_timeout`: AI model timeout in seconds (default: 15)
- `max_retries`: Maximum retry attempts (default: 3)
- `log_level`: Logging level (default: "INFO")

## Error Handling

The system includes comprehensive error handling:

- **API Failures**: Automatic retry with exponential backoff
- **Network Issues**: Graceful handling of timeouts and connection errors
- **Invalid Inputs**: Validation and sanitization of user inputs
- **Missing Dependencies**: Graceful fallbacks when optional dependencies are missing
- **Rate Limiting**: Automatic handling of API rate limits

## Logging

The system uses Python's built-in logging with configurable levels:

```python
import logging

# Set log level
logging.getLogger("quiz_generator").setLevel(logging.DEBUG)

# Or use the setup function
from src.better_agent import setup_logging
logger = setup_logging("DEBUG")
```

## Testing

Run the test script to verify everything works:

```bash
python test_quiz_generator.py
```

This will run various tests including:

- Basic quiz generation
- Context-based generation
- Error handling
- Different difficulty levels
- Simple generation method

## Troubleshooting

### Common Issues

1. **Import Errors**: Make sure all dependencies are installed

   ```bash
   pip install -r quiz_requirements.txt
   ```

2. **API Key Issues**: Verify your API keys are correct and have sufficient quota

3. **Network Issues**: Check your internet connection and firewall settings

4. **Rate Limiting**: The system automatically handles rate limits, but you may need to wait between requests

### Debug Mode

Enable debug logging to see detailed information:

```bash
python src/better_agent.py "Your Topic" --log-level DEBUG
```

## Architecture

The system is designed with modularity and robustness in mind:

- **SerperSearchTool**: Handles web search with retry logic and error handling
- **AdvancedQuizGenerator**: Main quiz generation engine with comprehensive error handling
- **Config**: Centralized configuration management
- **Convenience Functions**: Simple interfaces for common use cases

## Contributing

When contributing to this project:

1. Follow the existing code style
2. Add comprehensive error handling
3. Include logging for debugging
4. Add tests for new features
5. Update documentation

## License

This project is part of the SolviumAI quiz agent system.
