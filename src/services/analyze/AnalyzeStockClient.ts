import { Anthropic } from "@anthropic-ai/sdk"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"
import os from "os"

export interface AnalyzeStockResult {
	analysis: string
	plots?: string[] // Base64 encoded images
	metrics?: Record<string, number>
}

export class AnalyzeStockClient {
	private anthropic: Anthropic
	private cwd: string

	constructor(apiKey: string, cwd: string) {
		this.anthropic = new Anthropic({
			apiKey,
		})
		this.cwd = cwd
	}

	async analyze(financialData: string, webSearchData: string): Promise<AnalyzeStockResult> {
		// Ask Claude to generate Python analysis code
		const response = await this.anthropic.messages.create({
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 8000,
			messages: [
				{
					role: "user",
					content: `You are a Python code generator. Your task is to generate Python code for stock analysis based on the provided data. The code will be directly written to a .py file and executed, so provide ONLY the raw Python code without any markdown formatting, comments, or explanations.

Use pandas, numpy, scipy, statsmodels, pyfolio, yfinance and scikit-learn libraries to:
1. Process and clean the data
2. Perform statistical analysis
3. Generate visualizations
4. Calculate key metrics and risk measures
5. Save plots as PNG files
6. Return a comprehensive analysis as JSON

Financial Data:
${financialData}

Web Search Data:
${webSearchData}

Remember: Output ONLY the raw Python code, no markdown code blocks or other formatting.`,
				},
			],
		})

		const pythonCode = response.content[0].type === "text" ? response.content[0].text : ""

		// Create a temporary directory for the analysis
		const tmpDir = await fs.mkdtemp(path.join(this.cwd, "stock-analysis-"))
		const scriptPath = path.join(tmpDir, "analysis.py")
		await fs.writeFile(scriptPath, pythonCode)

		// Run the Python script
		const pythonProcess = spawn("/Users/hezhang/repos/demo/financial_advisor/env/bin/python3", [scriptPath])

		let output = ""
		let error = ""

		pythonProcess.stdout.on("data", (data) => {
			output += data.toString()
		})

		pythonProcess.stderr.on("data", (data) => {
			error += data.toString()
		})

		await new Promise((resolve, reject) => {
			pythonProcess.on("close", (code) => {
				if (code === 0) {
					resolve(code)
				} else {
					reject(new Error(`Python script failed with code ${code}\nError: ${error}`))
				}
			})
		})

		// Read generated plots
		const plots: string[] = []
		try {
			const files = await fs.readdir(tmpDir)
			for (const file of files) {
				if (file.endsWith(".png")) {
					const plotPath = path.join(tmpDir, file)
					const plotData = await fs.readFile(plotPath)
					plots.push(plotData.toString("base64"))
				}
			}
		} catch (err) {
			console.error("Error reading plots:", err)
		}

		// Clean up
		await fs.rm(tmpDir, { recursive: true, force: true })

		return {
			analysis: output,
			plots,
			metrics: JSON.parse(output).metrics, // Assuming Python code outputs JSON with metrics
		}
	}
}
