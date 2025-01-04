import axios from 'axios';
import path from 'node:path';
import { VectorDB } from '../../utils/vector_db_utils';
import { v4 as uuidv4 } from 'uuid';

// Response interfaces
interface CompanySearchResult {
    symbol: string;
    name: string;
    currency: string;
    stockExchange: string;
    exchangeShortName: string;
}

interface StockListResult {
    symbol: string;
    name: string;
    price: number;
    exchange: string;
    type: string;
}

interface CompanyProfile {
    symbol: string;
    price: number;
    beta: number;
    volAvg: number;
    mktCap: number;
    description: string;
    companyName: string;
    industry: string;
    sector: string;
    ceo: string;
    website: string;
}

interface FinancialStatement {
    date: string;
    symbol: string;
    reportedCurrency: string;
    [key: string]: string | number | boolean | null;
}

interface FinancialRatio {
    symbol: string;
    date: string;
    period: string;
    // Financial ratios
    currentRatio?: number;
    quickRatio?: number;
    cashRatio?: number;
    grossProfitMargin?: number;
    operatingProfitMargin?: number;
    netProfitMargin?: number;
    returnOnEquity?: number;
    returnOnAssets?: number;
    debtRatio?: number;
    debtEquityRatio?: number;
}

interface KeyMetric {
    symbol: string;
    date: string;
    period: string;
    [key: string]: string | number | boolean | null;
}

interface ChromaMetadata {
    data_type: string;
    symbol?: string;
    query?: string;
    period?: string;
    description?: string;
    timestamp: string;
}

export class FinancialModelingPrepClient {
    private readonly apiKey: string;
    private readonly openAiApiKey: string;
    private readonly vectorDb: VectorDB;

    constructor(apiKey: string, openAiApiKey: string) {
        this.apiKey = apiKey;
        this.openAiApiKey = openAiApiKey;
        this.vectorDb = new VectorDB(
			/*path.join(process.cwd(), 'data', 'lancedb')*/ "/Users/hezhang/repos/demo/financial_advisor/data/lancedb"
		)
    }

    private async get<T>(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
        try {
            const response = await axios.get(`https://financialmodelingprep.com/api/v3${endpoint}`, {
                params: {
                    ...params,
                    apikey: this.apiKey,
                },
            });
            return response.data;
        } catch (error) {
            console.error(`FMP API request failed for ${endpoint}:`, error);
            throw new Error(`FMP API request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async storeInVectorDB(collectionName: string, text: string, metadata: {
        data_type: string;
        symbol?: string;
        query?: string;
        period?: string;
        description?: string;
    }): Promise<void> {
        await this.vectorDb.write(collectionName, {
            id: uuidv4(),
            text,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Company Search API
    async searchCompanies(query: string): Promise<CompanySearchResult[]> {
        const results = await this.get<CompanySearchResult[]>(`/search?query=${encodeURIComponent(query)}`);
        await this.storeInVectorDB('company_search', JSON.stringify(results), {
            data_type: 'company_search',
            query,
        });
        return results.map((r) => ({
            symbol: r.symbol,
            name: r.name,
            stockExchange: r.stockExchange,
            currency: r.currency,
            exchangeShortName: r.exchangeShortName,
        }));
    }

    // Stock List API
    async getStockList(): Promise<StockListResult[]> {
        return this.get<StockListResult[]>('/stock/list');
    }

    // Company Information API
    async getCompanyProfile(symbol: string): Promise<Partial<CompanyProfile>> {
        const profiles = await this.get<CompanyProfile[]>(`/profile/${symbol}`);
        if (!profiles || profiles.length === 0) {
            throw new Error(`No profile found for symbol: ${symbol}`);
        }
        const profile = profiles[0];

        // Store in Vector DB
        await this.storeInVectorDB('company_profiles', JSON.stringify(profile), {
            symbol: profile.symbol,
            data_type: 'company_profile',
            description: profile.companyName,
        });

        // Return summary
        return {
            symbol: profile.symbol,
            companyName: profile.companyName,
            sector: profile.sector,
            industry: profile.industry,
            description: 'Full profile stored in Vector DB. Use vector_db_query to retrieve details.',
        };
    }

    // Financial Statements APIs
    async getIncomeStatement(
        symbol: string,
        period: 'annual' | 'quarter' = 'quarter',
        limit = 5
    ): Promise<string> {
        const data = await this.get<FinancialStatement[]>(`/income-statement/${symbol}`, { period, limit });

        await this.storeInVectorDB('financial_statements', JSON.stringify(data), {
            symbol,
            data_type: 'income_statement',
            period,
        });

        return `Stored ${data.length} income statements for ${symbol} in Vector DB. Use vector_db_query to retrieve details.`;
    }

    async getBalanceSheet(
        symbol: string,
        period: 'annual' | 'quarter' = 'quarter',
        limit = 5
    ): Promise<string> {
        const data = await this.get<FinancialStatement[]>(`/balance-sheet-statement/${symbol}`, { period, limit });

        await this.storeInVectorDB('financial_statements', JSON.stringify(data), {
            symbol,
            data_type: 'balance_sheet',
            period,
        });

        return `Stored ${data.length} balance sheets for ${symbol} in Vector DB. Use vector_db_query to retrieve details.`;
    }

    async getCashFlow(symbol: string, period: 'annual' | 'quarter' = 'quarter', limit = 5): Promise<string> {
        const data = await this.get<FinancialStatement[]>(`/cash-flow-statement/${symbol}`, { period, limit });

        await this.storeInVectorDB('financial_statements', JSON.stringify(data), {
            symbol,
            data_type: 'cash_flow',
            period,
        });

        return `Stored ${data.length} cash flow statements for ${symbol} in Vector DB. Use vector_db_query to retrieve details.`;
    }

    // Statement Analysis APIs
    async getFinancialRatios(
        symbol: string,
        period: 'annual' | 'quarter' = 'quarter',
        limit = 5
    ): Promise<string> {
        const data = await this.get<FinancialRatio[]>(`/ratios/${symbol}`, { period, limit });

        await this.storeInVectorDB('financial_analysis', JSON.stringify(data), {
            symbol,
            data_type: 'financial_ratios',
            period,
        });

        return `Stored ${data.length} financial ratios for ${symbol} in Vector DB. Use vector_db_query to retrieve details.`;
    }

    async getKeyMetrics(symbol: string, period: 'annual' | 'quarter' = 'quarter', limit = 5): Promise<string> {
        const data = await this.get<KeyMetric[]>(`/key-metrics/${symbol}`, { period, limit });

        await this.storeInVectorDB('financial_analysis', JSON.stringify(data), {
            symbol,
            data_type: 'key_metrics',
            period,
        });

        return `Stored ${data.length} key metrics for ${symbol} in Vector DB. Use vector_db_query to retrieve details.`;
    }

    // Helper method to format financial data as a readable string
    formatFinancialData(data: (CompanyProfile | FinancialStatement | FinancialRatio | KeyMetric)[], type: string): string {
        if (!data || data.length === 0) {
            return 'No results found.';
        }

        let output = `\n=== ${type} ===\n`;
        for (const [i, item] of data.entries()) {
            output += `\n--- Entry ${i + 1} ---\n`;
            for (const [key, value] of Object.entries(item)) {
                if (value !== null && value !== undefined) {
                    output += `${key}: ${value}\n`;
                }
            }
        }
        return output;
    }
}
