import * as lancedb from "@lancedb/lancedb"
import type { Table, VectorQuery } from "@lancedb/lancedb"
import { mkdirSync } from "node:fs"
import { Field, Float32, Schema, Utf8 } from "apache-arrow"
import { LanceSchema, getRegistry, type EmbeddingFunction } from "@lancedb/lancedb/embedding"

export interface Document {
	id: string
	text: string
	metadata?: Record<string, unknown>
}

export interface QueryOptions {
	text?: string
	vector?: number[] // Or Float32Array, but LanceDB also works with number[]
	limit?: number
	where?: string
	nprobes?: number
	refineFactor?: number
	distanceType?: "l2" | "cosine" | "dot"
	select?: string[]
	postFilter?: boolean
}

export interface IndexConfig {
	numPartitions?: number
	numSubVectors?: number
	type?: "ivf_pq" | "fts"
}

export class VectorDB {
	private dbPath: string
	private tableName = "documents"
	private vectorDimension = 384 // Default for OpenAI ada-002
	private table: Table | null = null
	private embeddingFunction: EmbeddingFunction | null = null

	constructor(dbPath: string, tableName?: string, vectorDimension?: number) {
		this.dbPath = dbPath
		if (tableName) {this.tableName = tableName}
		if (vectorDimension) {this.vectorDimension = vectorDimension}
		// mkdirSync(this.dbPath, { recursive: true })
	}

	private async initEmbeddingFunction(): Promise<EmbeddingFunction> {
		if (this.embeddingFunction) {
			return this.embeddingFunction
		}

		const func = getRegistry()
			.get("openai")
			?.create({
				apiKey: process.env.OPENAI_API_KEY || "",
				model: "text-embedding-ada-002",
			})

		if (!func) {
			throw new Error("Failed to create embedding function. Please check OPENAI_API_KEY is set.")
		}

		this.embeddingFunction = func
		return func
	}

	private async getTable(): Promise<Table> {
		if (this.table) {
			return this.table
		}

		const db = await lancedb.connect(this.dbPath)
		const func = await this.initEmbeddingFunction()

		try {
			this.table = await db.openTable(this.tableName)
		} catch (error) {
			// Create table if it doesn't exist
			const schema = LanceSchema({
				id: new Utf8(),
				text: func.sourceField(new Utf8()),
				vector: func.vectorField(),
				// If you want 'metadata' as a separate column, you can store it as a string or let LanceDB store it untyped:
				// For a simple approach, treat it as a string column or any column. Example:
				metadata: new Utf8(),
			})

			// Create with some initial row (so that we have a table to alter):
			this.table = await db.createTable(
				this.tableName,
				[
					{
						id: "sample",
						text: "sample",
						metadata: JSON.stringify({}),
					},
				],
				{
					schema, // If you’d like to enforce the above schema
					embeddingFunction: {
						function: func,
						sourceColumn: "text",
						vectorColumn: "vector",
					},
					mode: "overwrite", // or "create", depending on your needs
				}
			)

			// Remove the sample row
			await this.table.delete("id = 'sample'")
		}

		return this.table
	}

	/**
	 * Writes new documents into the table.
	 * @param documents Array of documents to write
	 * @throws Error if table creation or write operation fails
	 */
	async write(collectionName: string, document: Document): Promise<void> {
		if (!document) {
			throw new Error("No document provided")
		}

		const table = await this.getTable()
		try {
			await table.add([{
				id: document.id,
				text: document.text,
				metadata: document.metadata ? JSON.stringify(document.metadata) : "{}",
			}])
		} catch (error) {
			throw new Error(`Failed to write document: ${(error as Error).message}`)
		}
	}

	/**
	 * Creates an index for faster vector search.
	 * @param config Index configuration
	 * @throws Error if index creation fails
	 */
	async createIndex(config?: IndexConfig): Promise<void> {
		const table = await this.getTable()

		try {
			if (config?.type === "fts") {
				await table.createIndex("text")
			} else {
				await table.createIndex("vector", {
					config: lancedb.Index.ivfPq({
						numPartitions: config?.numPartitions || 256,
						numSubVectors: config?.numSubVectors || 16,
					}),
				})
			}
		} catch (error) {
			throw new Error(`Failed to create index: ${(error as Error).message}`)
		}
	}

	/**
	 * Performs vector search with various options.
	 * @param options Search options
	 * @returns Array of search results with scores
	 * @throws Error if search operation fails
	 */
	async query(options: QueryOptions) {
		const table = await this.getTable()
		let query: VectorQuery | lancedb.Query

		try {
			if (options.text) {
				// Text-based or hybrid search
				query = table.query().where(options.text)
			} else if (options.vector) {
				// Pure vector search
				query = table.search(options.vector)
			} else {
				throw new Error("Either text or vector must be provided for search")
			}

			// Apply additional search parameters
			if (options.where) {
				query = query.where(options.where)
			}

			if (options.select) {
				query = query.select(options.select)
			}

			if (options.limit) {
				query = query.limit(options.limit)
			}

			// if (options.distanceType && query instanceof VectorQuery) {
			// 	query = query.distanceType(options.distanceType)
			// }

			// if (options.nprobes && query instanceof VectorQuery) {
			// 	query = query.nprobes(options.nprobes)
			// }

			// if (options.refineFactor && query instanceof VectorQuery) {
			// 	query = query.refineFactor(options.refineFactor)
			// }

			// if (options.postFilter) {
			// 	query = query.postfilter()
			// }

			const results = await query.toArray()

			return results.map((result) => ({
				id: result.id as string,
				text: result.text as string,
				vector: Array.isArray(result.vector) ? [...result.vector] : [],
				metadata: result.metadata ? JSON.parse(result.metadata as string) : {},
				score: result._distance,
			}))
		} catch (error) {
			throw new Error(`Search failed: ${(error as Error).message}`)
		}
	}

	/**
	 * Deletes documents from the table.
	 * @param condition SQL WHERE condition for deletion
	 * @throws Error if deletion fails
	 */
	async delete(condition: string): Promise<void> {
		const table = await this.getTable()
		try {
			await table.delete(condition)
		} catch (error) {
			throw new Error(`Failed to delete documents: ${(error as Error).message}`)
		}
	}

	/**
	 * Drops the table and all its data.
	 * @throws Error if table deletion fails
	 */
	async drop(): Promise<void> {
		const db = await lancedb.connect(this.dbPath)
		try {
			await db.dropTable(this.tableName)
			this.table = null
		} catch (error) {
			throw new Error(`Failed to drop table: ${(error as Error).message}`)
		}
	}
}
