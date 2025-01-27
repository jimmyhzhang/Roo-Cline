import * as vscode from "vscode"

export interface PerplexitySearchOptions {
	model?: string
	searchDomains?: string[]
	searchRecency?: "month" | "week" | "day" | "hour"
	returnImages?: boolean
}

export class PerplexityClient {
	private apiKey: string | undefined

	constructor() {
		this.apiKey = process.env.PERPLEXITY_API_KEY
	}

	async search(prompt: string, options: PerplexitySearchOptions = {}): Promise<string> {
		if (!this.apiKey) {
			throw new Error("PERPLEXITY_API_KEY environment variable not set")
		}

		const {
			model = "llama-3.1-sonar-small-128k-online",
			searchDomains,
			searchRecency,
			returnImages = false,
		} = options

		const url = "https://api.perplexity.ai/chat/completions"
		const headers = {
			Authorization: `Bearer ${this.apiKey}`,
			"Content-Type": "application/json",
		}

		const payload: any = {
			model,
			messages: [{ role: "user", content: prompt }],
			temperature: 0.7,
		}

		if (searchDomains) {
			payload.search_domain_filter = searchDomains
		}
		if (searchRecency) {
			payload.search_recency_filter = searchRecency
		}
		if (returnImages) {
			payload.return_images = true
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
			})

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`Perplexity API error (${response.status}): ${errorText}`)
			}

			const data = await response.json()
			return data.choices[0].message.content
		} catch (error) {
			console.error("Error querying Perplexity API:", error)
			throw error
		}
	}
}
