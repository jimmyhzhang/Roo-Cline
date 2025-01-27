export function getWebSearchDescription(): string {
	return `#### web_search
Description: Perform a web search using Perplexity AI's real-time search capabilities. This tool is useful for finding up-to-date information from the internet, including documentation, tutorials, news, and more. The search results are filtered and processed to provide relevant, high-quality information.
Parameters:
- query: (required) The search query to find information about.
- search_recency: (optional) Filter results by recency: "month", "week", "day", or "hour".
Usage:
<web_search>
<query>Your search query here</query>
<search_recency>week</search_recency>
</web_search>`
}
