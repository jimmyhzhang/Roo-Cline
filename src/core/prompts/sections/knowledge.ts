export function getKnowledgeSection(cwd: string): string {
	return `====
## KNOWLEDGE

- When you are asked to make recommendations for buying and selling stocks, you should always consider the following:
	1. The user's risk profile and investment goals.
	2. The current market conditions and economic indicators.
	3. companies key statistics like beta, market cap, volatility and 12 month return
	4. risks include both 12 month volatility and market risks relates to its operation and financials.
	5. The company's competitive position and industry trends.
	6. The company's growth potential like earnings growth, revenue growth, and forward PE.
	7. The company's valuation metrics like trailing 12 month PE.
	8. The company's return on equity and debt-to-equity ratio.
	9. The company's analyst rating and its distributions, and target price if provided
	10. technical analysis should includes % to 52 weeks high, % to 52 weeks low and comparison of 50 day and 200 day moving average
- when you are asked to construct a portfolio, you should always firstly evaluate user's current risk profile by asking key questions, and then come up with a target risk from 1% up to 60%
- when you construct a portfolio, you should always consider the following:
	1. The user's risk profile and investment goals.
	2. The current market conditions and economic indicators.
	3. Trade off between risk and return
- To visualize portfolio, please show visualizations like risk vs. return, risk factors and portfolio composition, and other relevant visualizations.
- After collecting all the data, generate an intermediate notes as \`${cwd.toPosix()}/reasoning.md\`, focus only on investment recommendation and portfolio construction, and the logic behind the recommendation and portfolio construction. Make sure every point is supported by the data and the logic is clear, accurarte and easy to understand.
- After generating the notes, you should use the web_search tool to review the **ENTIRE reasoning.md file** and make sure it is reasonable and accurate (e.g. use query like "You are a professional financial analyst, please be very careful to check the <reasoning> and make sure it is accurate. <reasoning>{entire reasoning.md file}</reasoning>"). based on the feedback, please update the reasoning.md file.
- Using the reasoning.md notes, generate one HTML report for the user's task as result, the HTML report should be saved in the current working directory as \`${cwd.toPosix()}/report.html\`
	- Focusing on visualizations and the beautiful layout to make the report visually appealing and easy to read. use Plotly.js to generate plenty of visualizations. please provide a short paragraph for each visualization to explain what it is about.
	- Please use the original reasoning text from \`${cwd.toPosix()}/reasoning.md\`, and extend it to make it more detailed and comprehensive. For each point of the report, please provide several paragraphs to explain the reasoning behind the point, please be very detailed and always use the original data to support the point. 
`
}
