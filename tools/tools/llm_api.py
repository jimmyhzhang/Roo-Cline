#!/usr/bin/env python3

from openai import OpenAI
from anthropic import Anthropic
import argparse
import os
import logging
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Model configurations
OPENAI_MODELS = {
    "gpt-4o": {"provider": "openai", "max_tokens": 4096},
    "gpt-4o-mini": {"provider": "openai", "max_tokens": 8192},
    "o1-mini": {"provider": "openai", "max_tokens": 4096},
}

ANTHROPIC_MODELS = {
    "claude-3-5-sonnet-latest": {"provider": "anthropic", "max_tokens": 4096},
    "claude-3-5-haiku-latest": {"provider": "anthropic", "max_tokens": 8192},
}

DEEPSEEK_MODELS = {
    "deepseek-chat": {"provider": "deepseek", "max_tokens": 8192},
}

PERPLEXITY_MODELS = {
    "llama-3.1-sonar-small-128k-online": {"provider": "perplexity", "max_tokens": 8192},
    "llama-3.1-sonar-medium-128k-online": {"provider": "perplexity", "max_tokens": 8192},
    "llama-3.1-sonar-small-128k-chat": {"provider": "perplexity", "max_tokens": 8192},
    "llama-3.1-sonar-medium-128k-chat": {"provider": "perplexity", "max_tokens": 8192},
}

ALL_MODELS = {**OPENAI_MODELS, **ANTHROPIC_MODELS, **DEEPSEEK_MODELS, **PERPLEXITY_MODELS}


def create_openai_client():
    """Create an OpenAI client."""
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("OPENAI_API_KEY environment variable not set")
            return None
        return OpenAI(api_key=api_key)
    except Exception as e:
        logger.error(f"Error creating OpenAI client: {e}")
        return None


def create_anthropic_client():
    """Create an Anthropic client."""
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            logger.error("ANTHROPIC_API_KEY environment variable not set")
            return None
        return Anthropic(api_key=api_key)
    except Exception as e:
        logger.error(f"Error creating Anthropic client: {e}")
        return None


def create_deepseek_client():
    """Create a DeepSeek client using OpenAI's client with custom base URL."""
    try:
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            logger.error("DEEPSEEK_API_KEY environment variable not set")
            return None
        return OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
    except Exception as e:
        logger.error(f"Error creating DeepSeek client: {e}")
        return None


def query_perplexity(prompt, model, max_tokens=None, search_domain_filter=None, search_recency_filter=None, return_images=False):
    """Query the Perplexity API directly using requests."""
    try:
        api_key = os.getenv("PERPLEXITY_API_KEY")
        if not api_key:
            logger.error("PERPLEXITY_API_KEY environment variable not set")
            return None

        url = "https://api.perplexity.ai/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.7,
        }

        # Add optional parameters for online models
        if model.endswith("-online"):
            if search_domain_filter:
                payload["search_domain_filter"] = search_domain_filter
            if search_recency_filter:
                payload["search_recency_filter"] = search_recency_filter
            if return_images:
                payload["return_images"] = True

        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

        return data["choices"][0]["message"]["content"]

    except Exception as e:
        logger.error(f"Error querying Perplexity API: {e}")
        if response is not None:
            logger.error(f"Response content: {response.text}")
        return None


def query_llm(prompt, model="gpt-4-turbo-preview", client=None, search_domain_filter=None, search_recency_filter=None, return_images=False):
    """
    Query an LLM with the given prompt.

    Args:
        prompt (str): The prompt to send to the LLM
        model (str): The model to use (default: gpt-4-turbo-preview)
        client: Optional pre-configured client
        search_domain_filter (list): Optional list of domains to filter search results (Perplexity only)
        search_recency_filter (str): Optional time filter for search results (Perplexity only)
        return_images (bool): Whether to return images in the response (Perplexity only)

    Returns:
        str: The model's response or None if there's an error
    """
    if model not in ALL_MODELS:
        logger.error(f"Unknown model: {model}")
        return None

    model_config = ALL_MODELS[model]
    provider = model_config["provider"]

    try:
        if provider == "openai":
            if client is None:
                client = create_openai_client()
            if client is None:
                return None

            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            return response.choices[0].message.content

        elif provider == "anthropic":
            if client is None:
                client = create_anthropic_client()
            if client is None:
                return None

            response = client.messages.create(
                model=model,
                max_tokens=model_config["max_tokens"],
                temperature=0.7,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            return response.content[0].text

        elif provider == "deepseek":
            if client is None:
                client = create_deepseek_client()
            if client is None:
                return None

            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            return response.choices[0].message.content

        elif provider == "perplexity":
            return query_perplexity(
                prompt,
                model,
                max_tokens=model_config["max_tokens"],
                search_domain_filter=search_domain_filter,
                search_recency_filter=search_recency_filter,
                return_images=return_images
            )

    except Exception as e:
        logger.error(f"Error querying {provider} LLM: {e}")
        logger.info(
            "Note: If you haven't configured the LLM server or API key, this error is expected."
        )
        logger.info(
            "The LLM functionality is optional and won't affect other features."
        )
        return None


def main():
    parser = argparse.ArgumentParser(description="Query an LLM with a prompt")
    parser.add_argument(
        "--prompt", type=str, help="The prompt to send to the LLM", required=True
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-4-turbo-preview",
        choices=list(ALL_MODELS.keys()),
        help="The model to use (default: gpt-4-turbo-preview)",
    )
    parser.add_argument(
        "--search-domains",
        type=str,
        nargs="+",
        help="List of domains to filter search results (Perplexity online models only)",
    )
    parser.add_argument(
        "--search-recency",
        type=str,
        choices=["month", "week", "day", "hour"],
        help="Time filter for search results (Perplexity online models only)",
    )
    parser.add_argument(
        "--return-images",
        action="store_true",
        help="Return images in the response (Perplexity online models only)",
    )
    args = parser.parse_args()

    response = query_llm(
        args.prompt,
        model=args.model,
        search_domain_filter=args.search_domains,
        search_recency_filter=args.search_recency,
        return_images=args.return_images
    )
    if response:
        print(response)
    else:
        print("Failed to get response from LLM")


if __name__ == "__main__":
    main()
