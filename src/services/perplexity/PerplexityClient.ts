import * as vscode from "vscode"
import { spawn } from 'node:child_process';
import path from 'node:path';
import { VectorDB } from '../../utils/vector_db_utils';
import { v4 as uuidv4 } from 'uuid';

export interface PerplexitySearchOptions {
    model?: string
    searchDomains?: string[]
    searchRecency?: "month" | "week" | "day" | "hour"
    returnImages?: boolean
}

export class PerplexityClient {
    private apiKey: string | undefined
    private readonly vectorDb: VectorDB;

    constructor() {
        this.apiKey = process.env.PERPLEXITY_API_KEY
        this.vectorDb = new VectorDB(
			/*path.join(process.cwd(), 'data', 'lancedb')*/ "/Users/hezhang/repos/demo/financial_advisor/data/lancedb"
		)
    }

    private async storeInVectorDB(text: string, metadata: {
        data_type: string;
        query: string;
        model: string;
        search_domains?: string[];
        search_recency?: string;
    }): Promise<void> {
        await this.vectorDb.write('perplexity_search', {
            id: uuidv4(),
            text,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        });
    }

    async search(prompt: string, options: PerplexitySearchOptions = {}): Promise<string> {
        if (!this.apiKey) {
            throw new Error("PERPLEXITY_API_KEY environment variable not set")
        }

        const {
            model = "llama-3.1-sonar-small-128k-online",
            searchDomains,
            searchRecency,
            returnImages = false
        } = options

        const url = "https://api.perplexity.ai/chat/completions"
        const headers = {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
        }

        const payload: {
            model: string;
            messages: { role: string; content: string; }[];
            temperature: number;
            search_recency_filter?: string;
            search_domain_filter?: string[];
            return_images?: boolean;
        } = {
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        }

        // if (searchDomains) {
        //     payload.search_domain_filter = searchDomains
        // }
        if (searchRecency) {
            payload.search_recency_filter = searchRecency
        }
        // if (returnImages) {
        //     payload.return_images = true
        // }

        try {
            const response = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Perplexity API error (${response.status}): ${errorText}`)
            }

            const data = await response.json()
            const fullContent = data.choices[0].message.content

            // Store in Vector DB
            await this.storeInVectorDB(fullContent, {
                data_type: 'search_result',
                query: prompt,
                model,
                search_domains: searchDomains,
                search_recency: searchRecency
            });

            // Return a summary (first 200 characters)
            const summary = fullContent.slice(0, 200)
            return `Full response stored in Vector DB. Summary: ${summary}...`

        } catch (error) {
            console.error("Error querying Perplexity API:", error)
            throw error
        }
    }
} 