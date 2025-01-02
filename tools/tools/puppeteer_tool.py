#!/usr/bin/env python3

import argparse
import asyncio
import base64
import json
import logging
import os
from pyppeteer import launch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


class PuppeteerTool:
    def __init__(self):
        self.browser = None
        self.page = None
        self.console_logs = []
        self.screenshots = {}

    async def ensure_browser(self):
        """Ensure browser is launched and return the page."""
        if not self.browser:
            docker_args = {
                "headless": True,
                "args": ["--no-sandbox", "--single-process", "--no-zygote"],
            }
            npx_args = {"headless": False}

            self.browser = await launch(
                options=docker_args if os.getenv("DOCKER_CONTAINER") else npx_args
            )
            pages = await self.browser.pages()
            self.page = pages[0]

            def handle_console(msg):
                log_entry = f"[{msg.type}] {msg.text}"
                self.console_logs.append(log_entry)
                logger.info(log_entry)

            self.page.on("console", handle_console)

        return self.page

    async def navigate(self, url):
        """Navigate to a URL."""
        page = await self.ensure_browser()
        await page.goto(url)
        return f"Navigated to {url}"

    async def screenshot(self, name, selector=None, width=800, height=600):
        """Take a screenshot of the current page or element."""
        page = await self.ensure_browser()
        await page.setViewport({"width": width, "height": height})

        if selector:
            element = await page.querySelector(selector)
            if not element:
                return {"error": f"Element not found: {selector}"}
            screenshot = await element.screenshot({"encoding": "base64"})
        else:
            screenshot = await page.screenshot(
                {"encoding": "base64", "fullPage": False}
            )

        self.screenshots[name] = screenshot
        return {
            "message": f"Screenshot '{name}' taken at {width}x{height}",
            "image": screenshot,
        }

    async def click(self, selector):
        """Click an element on the page."""
        page = await self.ensure_browser()
        try:
            await page.click(selector)
            return f"Clicked: {selector}"
        except Exception as e:
            return {"error": f"Failed to click {selector}: {str(e)}"}

    async def fill(self, selector, value):
        """Fill out an input field."""
        page = await self.ensure_browser()
        try:
            await page.waitForSelector(selector)
            await page.type(selector, value)
            return f"Filled {selector} with: {value}"
        except Exception as e:
            return {"error": f"Failed to fill {selector}: {str(e)}"}

    async def select(self, selector, value):
        """Select an option from a select element."""
        page = await self.ensure_browser()
        try:
            await page.waitForSelector(selector)
            await page.select(selector, value)
            return f"Selected {selector} with: {value}"
        except Exception as e:
            return {"error": f"Failed to select {selector}: {str(e)}"}

    async def hover(self, selector):
        """Hover over an element."""
        page = await self.ensure_browser()
        try:
            await page.waitForSelector(selector)
            await page.hover(selector)
            return f"Hovered {selector}"
        except Exception as e:
            return {"error": f"Failed to hover {selector}: {str(e)}"}

    async def evaluate(self, script):
        """Execute JavaScript in the browser console."""
        page = await self.ensure_browser()
        try:
            # Setup console capture
            await page.evaluate("""() => {
                window.mcpHelper = {
                    logs: [],
                    originalConsole: { ...console }
                };
                
                ['log', 'info', 'warn', 'error'].forEach(method => {
                    console[method] = (...args) => {
                        window.mcpHelper.logs.push(`[${method}] ${args.join(' ')}`);
                        window.mcpHelper.originalConsole[method](...args);
                    };
                });
            }""")

            # Execute the script
            result = await page.evaluate(script)

            # Get logs and restore console
            logs = await page.evaluate("""() => {
                Object.assign(console, window.mcpHelper.originalConsole);
                const logs = window.mcpHelper.logs;
                delete window.mcpHelper;
                return logs;
            }""")

            return {"result": result, "console": "\n".join(logs)}
        except Exception as e:
            return {"error": f"Script execution failed: {str(e)}"}

    async def close(self):
        """Close the browser."""
        if self.browser:
            await self.browser.close()
            self.browser = None
            self.page = None


async def main():
    parser = argparse.ArgumentParser(description="Puppeteer automation tool")
    parser.add_argument(
        "action",
        choices=[
            "navigate",
            "screenshot",
            "click",
            "fill",
            "select",
            "hover",
            "evaluate",
        ],
    )
    parser.add_argument("--url", help="URL to navigate to")
    parser.add_argument("--selector", help="CSS selector for element")
    parser.add_argument("--value", help="Value for fill/select actions")
    parser.add_argument("--name", help="Name for screenshot")
    parser.add_argument("--width", type=int, default=800, help="Viewport width")
    parser.add_argument("--height", type=int, default=600, help="Viewport height")
    parser.add_argument("--script", help="JavaScript code to execute")

    args = parser.parse_args()

    tool = PuppeteerTool()

    try:
        if args.action == "navigate":
            if not args.url:
                parser.error("--url is required for navigate action")
            result = await tool.navigate(args.url)

        elif args.action == "screenshot":
            if not args.name:
                parser.error("--name is required for screenshot action")
            result = await tool.screenshot(
                args.name, args.selector, args.width, args.height
            )

        elif args.action == "click":
            if not args.selector:
                parser.error("--selector is required for click action")
            result = await tool.click(args.selector)

        elif args.action == "fill":
            if not args.selector or args.value is None:
                parser.error("--selector and --value are required for fill action")
            result = await tool.fill(args.selector, args.value)

        elif args.action == "select":
            if not args.selector or args.value is None:
                parser.error("--selector and --value are required for select action")
            result = await tool.select(args.selector, args.value)

        elif args.action == "hover":
            if not args.selector:
                parser.error("--selector is required for hover action")
            result = await tool.hover(args.selector)

        elif args.action == "evaluate":
            if not args.script:
                parser.error("--script is required for evaluate action")
            result = await tool.evaluate(args.script)

        print(json.dumps(result, indent=2))

    finally:
        await tool.close()


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
