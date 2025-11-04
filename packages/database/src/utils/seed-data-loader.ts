import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface SeedDataLoaderConfig {
	useS3?: boolean;
	s3Endpoint?: string;
	s3Region?: string;
	s3AccessKeyId?: string;
	s3SecretAccessKey?: string;
	cacheTTL?: number; // milliseconds
}

interface CacheEntry {
	data: Buffer;
	timestamp: number;
	checksum: string;
}

/**
 * Seed Data Loader
 * Loads seed data from either local files or S3 with caching and checksum verification
 */
export class SeedDataLoader {
	private s3Client: S3Client | null = null;
	private cache: Map<string, CacheEntry> = new Map();
	private cacheTTL: number;
	private useS3: boolean;

	constructor(config: SeedDataLoaderConfig = {}) {
		this.useS3 = config.useS3 ?? process.env.SEED_DATA_USE_S3 === "true";
		this.cacheTTL = config.cacheTTL ?? 24 * 60 * 60 * 1000; // 24 hours default

		if (this.useS3) {
			this.s3Client = new S3Client({
				region: config.s3Region || process.env.DO_SPACE_REGION || "nyc3",
				endpoint:
					config.s3Endpoint ||
					process.env.DO_ENDPOINT ||
					"https://nyc3.digitaloceanspaces.com",
				credentials: {
					accessKeyId: config.s3AccessKeyId || process.env.DO_ACCESS_KEY || "",
					secretAccessKey:
						config.s3SecretAccessKey || process.env.DO_SPACE_SECRET || "",
				},
				forcePathStyle: true,
			});
		}
	}

	/**
	 * Calculate SHA256 checksum of data
	 */
	private calculateChecksum(data: Buffer): string {
		return `sha256:${createHash("sha256").update(data).digest("hex")}`;
	}

	/**
	 * Check if cache entry is still valid
	 */
	private isCacheValid(entry: CacheEntry): boolean {
		return Date.now() - entry.timestamp < this.cacheTTL;
	}

	/**
	 * Load data from S3
	 */
	private async loadFromS3(bucket: string, key: string): Promise<Buffer> {
		if (!this.s3Client) {
			throw new Error("S3 client not initialized");
		}

		try {
			const command = new GetObjectCommand({ Bucket: bucket, Key: key });
			const response = await this.s3Client.send(command);

			if (!response.Body) {
				throw new Error(`No data returned from S3 for ${key}`);
			}

			// Convert stream to buffer
			const chunks: Uint8Array[] = [];
			const body = response.Body as unknown as {
				transformToByteArray?: () => Promise<Uint8Array>;
				[Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
			};

			// Try transformToByteArray first (newer SDK versions)
			if (typeof body?.transformToByteArray === "function") {
				return Buffer.from(await body.transformToByteArray());
			}

			// Fallback to async iteration
			if (body && Symbol.asyncIterator in body) {
				for await (const chunk of body as AsyncIterable<Uint8Array>) {
					chunks.push(chunk);
				}
				return Buffer.concat(chunks);
			}

			throw new Error("Unable to read S3 response body");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorCode =
				error instanceof Error && "code" in error ? error.code : "UNKNOWN";
			console.error(
				`  S3 Error Details: Code=${errorCode}, Message=${errorMessage}`,
			);
			console.error(`  Bucket: ${bucket}, Key: ${key}`);
			console.error(`  Credentials loaded: ${!!process.env.DO_ACCESS_KEY}`);
			throw new Error(`Failed to load from S3 (${key}): ${errorMessage}`);
		}
	}

	/**
	 * Load data from local file
	 */
	private async loadFromLocal(filePath: string): Promise<Buffer> {
		try {
			return await readFile(filePath);
		} catch (error) {
			throw new Error(
				`Failed to load from local file (${filePath}): ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Load seed data with caching and optional checksum verification
	 */
	async loadData(
		source: { type: "s3" | "local"; path: string; bucket?: string },
		expectedChecksum?: string,
	): Promise<Buffer> {
		const cacheKey = `${source.type}:${source.path}`;

		// Check cache
		const cached = this.cache.get(cacheKey);
		if (cached && this.isCacheValid(cached)) {
			if (expectedChecksum && cached.checksum !== expectedChecksum) {
				console.warn(
					`⚠️  Checksum mismatch for ${cacheKey} (cached vs expected)`,
				);
			}
			return cached.data;
		}

		// Load data
		let data: Buffer;
		if (source.type === "s3" && this.useS3) {
			if (!source.bucket) {
				throw new Error("Bucket name required for S3 source");
			}
			data = await this.loadFromS3(source.bucket, source.path);
		} else {
			data = await this.loadFromLocal(source.path);
		}

		// Verify checksum if provided
		const checksum = this.calculateChecksum(data);
		if (expectedChecksum && checksum !== expectedChecksum) {
			throw new Error(
				`Checksum mismatch for ${cacheKey}: expected ${expectedChecksum}, got ${checksum}`,
			);
		}

		// Cache the data
		this.cache.set(cacheKey, {
			data,
			timestamp: Date.now(),
			checksum,
		});

		return data;
	}

	/**
	 * Load and parse JSON data
	 */
	async loadJSON<T>(
		source: { type: "s3" | "local"; path: string; bucket?: string },
		expectedChecksum?: string,
	): Promise<T> {
		const data = await this.loadData(source, expectedChecksum);
		return JSON.parse(data.toString("utf-8")) as T;
	}

	/**
	 * Load and parse CSV data
	 */
	async loadCSV(
		source: { type: "s3" | "local"; path: string; bucket?: string },
		expectedChecksum?: string,
	): Promise<string> {
		const data = await this.loadData(source, expectedChecksum);
		return data.toString("utf-8");
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { size: number; entries: number } {
		return {
			size: Array.from(this.cache.values()).reduce(
				(sum, entry) => sum + entry.data.length,
				0,
			),
			entries: this.cache.size,
		};
	}
}

/**
 * Create a seed data loader instance with environment variables
 */
export function createSeedDataLoader(
	config?: SeedDataLoaderConfig,
): SeedDataLoader {
	return new SeedDataLoader(config);
}
