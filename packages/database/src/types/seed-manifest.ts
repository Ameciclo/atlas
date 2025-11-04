/**
 * Seed Data Manifest Type
 * Defines the structure of the manifest.json file that tracks all seed data sources
 */

export interface SeedFileInfo {
	name: string;
	key: string;
	size: number;
	checksum: string;
	uploadedAt: string;
}

export interface S3Config {
	bucket: string;
	region: string;
	endpoint: string;
	prefix: string;
	files: SeedFileInfo[];
}

export interface DatasetMetadata {
	recordCount?: number;
	years?: number[];
	format: string;
	encoding?: string;
}

export interface Dataset {
	name: string;
	description: string;
	storage: "git" | "s3" | "hybrid";
	s3?: S3Config;
	git?: {
		path: string;
		files: SeedFileInfo[];
	};
	metadata: DatasetMetadata;
}

export interface SeedDataManifest {
	version: string;
	lastUpdated: string;
	datasets: {
		[key: string]: Dataset;
	};
}
