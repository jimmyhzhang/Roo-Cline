export function getFetchFinancialDataDescription(): string {
	return `#### fetch_financial_data
Description: Fetch financial market data using the Financial Modeling Prep API. This tool provides access to data you need to make recommendations for buying and selling stocks.
datasets:
- CompanyProfile: you can get some basic information about the company, such as its name, ticker, industry, and description.
- IncomeStatementGrowth: you can get the income statement growth of the company, such as revenue growth, earnings growth, and other key metrics.
- FinancialRatiosTTM: Get trailing 12 month financial ratios of the company, such as PE ratio, EV/EBITDA, and other key metrics.
- KeyMetricsTTM: Get trailing 12 month key metrics of the company, such as beta, market cap, volatility and 12 month return.
Parameters:
- symbols: (required) Stock symbols to fetch data for (e.g., "AAPL,MSFT")
- datasets: (required) datasets, such as "CompanyProfile", "IncomeStatementGrowth", "FinancialRatiosTTM", and "KeyMetricsTTM"
Usage:
<fetch_financial_data>
<symbols>AAPL</symbols>
<datasets>CompanyProfile</datasets>
</fetch_financial_data>`
}
