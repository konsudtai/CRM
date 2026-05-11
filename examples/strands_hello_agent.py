"""
Simple Strands Agent Example
=============================
A basic agent that uses a custom tool and the built-in calculator.

Usage:
    source .venv/bin/activate
    python examples/strands_hello_agent.py

Requires:
    - strands-agents and strands-agents-tools installed
    - One of: AWS_BEDROCK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY set
"""

from strands import Agent, tool
from strands_tools import calculator


# Define a custom tool using the @tool decorator
@tool
def get_greeting(name: str, language: str = "english") -> str:
    """Generate a greeting for a person in the specified language.

    Args:
        name: The person's name to greet
        language: The language for the greeting (english, spanish, french, thai)
    """
    greetings = {
        "english": f"Hello, {name}! Welcome aboard.",
        "spanish": f"¡Hola, {name}! Bienvenido.",
        "french": f"Bonjour, {name}! Bienvenue.",
        "thai": f"สวัสดี {name}! ยินดีต้อนรับ",
    }
    return greetings.get(language.lower(), f"Hello, {name}!")


# Create the agent with our custom tool + the community calculator tool
agent = Agent(
    tools=[get_greeting, calculator],
    system_prompt="You are a friendly multilingual assistant. Use the greeting tool to welcome users and the calculator for math questions.",
)

# Run a simple conversation
print("=" * 60)
print("Strands Agent Demo")
print("=" * 60)

# First message - uses the greeting tool
response = agent("Please greet Alice in French and then in Thai")
print(f"\n{'=' * 60}")

# Second message - uses the calculator tool (agent remembers context)
response = agent("Now calculate 42 * 17 + 99")
print(f"\n{'=' * 60}")

# Third message - demonstrates conversation memory
response = agent("Who did you greet earlier and what languages did you use?")
print(f"\n{'=' * 60}")
print("Demo complete!")
