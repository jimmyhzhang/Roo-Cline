import axios from 'axios';

export interface MarketStackOptions {
    symbols?: string;
    exchange?: string;
    sort?: 'DESC' | 'ASC';
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
}

export class MarketStackClient {
    private readonly apiKey: string;
    private readonly baseUrl = 'https://api.marketstack.com/v2';

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('API key is required for MarketStack API');
        }
        this.apiKey = apiKey;
    }

    async fetchEodData(options: MarketStackOptions = {}): Promise<string> {
        try {
            const params = {
                access_key: this.apiKey,
                symbols: options.symbols,
                exchange: options.exchange,
                sort: options.sort || 'DESC',
                date_from: options.date_from,
                date_to: options.date_to,
                limit: options.limit || 100,
                offset: options.offset || 0
            };

            const response = await axios.get(`${this.baseUrl}/eod`, { params });

            if (!response.data || !response.data.data || response.data.data.length === 0) {
                return "No results found.";
            }

            let output = "";
            const results = response.data.data;

            for (const [i, result] of results.entries()) {
                output += `\n=== Result ${i + 1} ===\n`;
                output += `Symbol: ${result.symbol}\n`;
                output += `Date: ${result.date}\n`;
                output += `Open: ${result.open}\n`;
                output += `High: ${result.high}\n`;
                output += `Low: ${result.low}\n`;
                output += `Close: ${result.close}\n`;
                output += `Volume: ${result.volume}\n`;
            }

            return output || "No results found.";
        } catch (error) {
            console.error("MarketStack API request failed:", error);
            throw new Error(`MarketStack API request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
} 