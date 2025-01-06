import axios from 'axios';

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
    // ... other fields
}

interface FinancialStatement {
    date: string;
    symbol: string;
    reportedCurrency: string;
    // Common fields for all statement types
    [key: string]: any;
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
    // ... other ratios
}

export class FinancialModelingPrepClient {
    private readonly apiKey: string;
    private readonly baseUrl = 'https://financialmodelingprep.com/api/v3';

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('API key is required for Financial Modeling Prep API');
        }
        this.apiKey = apiKey;
    }

    private async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
        try {
            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                params: {
                    ...params,
                    apikey: this.apiKey
                }
            });
            return response.data;
        } catch (error) {
            console.error(`FMP API request failed for ${endpoint}:`, error);
            throw new Error(`FMP API request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Company Search API
    async searchCompanies(query: string): Promise<CompanySearchResult[]> {
        return this.get<CompanySearchResult[]>(`/search?query=${encodeURIComponent(query)}`);
    }

    // Stock List API
    async getStockList(): Promise<StockListResult[]> {
        return this.get<StockListResult[]>('/stock/list');
    }

    // Company Information API
    async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
        const profiles = await this.get<CompanyProfile[]>(`/profile/${symbol}`);
        if (!profiles || profiles.length === 0) {
            throw new Error(`No profile found for symbol: ${symbol}`);
        }
        return profiles[0];
    }

    // Financial Statements APIs
    async getIncomeStatement(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialStatement[]> {
        return this.get<FinancialStatement[]>(`/income-statement/${symbol}`, { period, limit });
    }

    async getIncomeStatementGrowth(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialStatement[]> {
        return this.get<FinancialStatement[]>(`/income-statement-growth/${symbol}`, { period, limit });
    }

    async getBalanceSheet(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialStatement[]> {
        return this.get<FinancialStatement[]>(`/balance-sheet-statement/${symbol}`, { period, limit });
    }

    async getBalanceSheetGrowth(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialStatement[]> {
        return this.get<FinancialStatement[]>(`/balance-sheet-statement-growth/${symbol}`, { period, limit });
    }

    async getCashFlow(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialStatement[]> {
        return this.get<FinancialStatement[]>(`/cash-flow-statement/${symbol}`, { period, limit });
    }
    
    async getCashFlowGrowth(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialStatement[]> {
        return this.get<FinancialStatement[]>(`/cash-flow-statement-growth/${symbol}`, { period, limit });
    }

    // Statement Analysis APIs
    async getFinancialRatios(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialRatio[]> {
        return this.get<FinancialRatio[]>(`/ratios/${symbol}`, { period, limit });
    }

    async getFinancialRatiosTTM(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialRatio[]> {
        return this.get<FinancialRatio[]>(`/ratios-ttm/${symbol}`, { period, limit });
    }

    async getKeyMetrics(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<any[]> {
        return this.get<any[]>(`/key-metrics/${symbol}`, { period, limit });
    }

    async getKeyMetricsTTM(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<any[]> {
        return this.get<any[]>(`/key-metrics-ttm/${symbol}`, { period, limit });
    }

    // Helper method to format financial data as a readable string
    formatFinancialData(data: any[], type: string): string {
        if (!data || data.length === 0) {
            return "No results found.";
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