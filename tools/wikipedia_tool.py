#!/usr/bin/env python3

import argparse
import json
import logging
import requests
from typing import Dict, Any

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class WikipediaTool:
    def __init__(self):
        self.rest_api_base = "https://en.wikipedia.org/api/rest_v1"
        self.mw_api_base = "https://en.wikipedia.org/w/api.php"
        self.headers = {
            "User-Agent": "CursorAgent/1.0 (https://cursor.sh/; support@cursor.sh)"
        }

    def get_page_content(self, title: str, format: str = "json") -> Dict[str, Any]:
        """
        Fetch page content using the REST API.
        """
        url = f"{self.rest_api_base}/page/summary/{title}"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            return {
                "title": data.get("title", ""),
                "extract": data.get("extract", ""),
                "extract_html": data.get("extract_html", ""),
                "url": data.get("content_urls", {}).get("desktop", {}).get("page", ""),
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching page content: {e}")
            return {"error": str(e)}

    def search_articles(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """
        Search Wikipedia articles using the MediaWiki API.
        """
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": limit,
        }
        try:
            response = requests.get(
                self.mw_api_base, params=params, headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
            return {
                "query": query,
                "results": [
                    {
                        "title": result["title"],
                        "snippet": result["snippet"],
                        "pageid": result["pageid"],
                    }
                    for result in data["query"]["search"]
                ],
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Error searching articles: {e}")
            return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Wikipedia content fetching tool")
    parser.add_argument("action", choices=["get", "search"], help="Action to perform")
    parser.add_argument(
        "query", help="Page title for get action, search query for search action"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Number of search results (for search action)",
    )
    parser.add_argument(
        "--format", choices=["json", "text"], default="json", help="Output format"
    )

    args = parser.parse_args()

    tool = WikipediaTool()

    try:
        if args.action == "get":
            result = tool.get_page_content(args.query, args.format)
        else:  # search
            result = tool.search_articles(args.query, args.limit)

        if args.format == "json":
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            if args.action == "get":
                print(f"Title: {result['title']}\n")
                print(result["extract"])
            else:
                print(f"Search results for '{args.query}':\n")
                for item in result["results"]:
                    print(f"- {item['title']}")
                    print(f"  {item['snippet']}\n")

    except Exception as e:
        logger.error(f"Error: {e}")
        exit(1)


if __name__ == "__main__":
    main()
