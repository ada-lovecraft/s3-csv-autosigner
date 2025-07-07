/**
 * S3 CSV Autosigner Library
 * 
 * A library for uploading CSV files to S3 and generating presigned URLs.
 * Built with Bun and TypeScript because we have standards.
 */

export { uploadCsvFiles, uploadSingleCsv } from "./csv-uploader.ts";
export { createS3Client, createS3ClientSync } from "./s3-client.ts";
export type { CsvUploadResult, UploadOptions, CsvFile } from "./types.ts";

// AWS configuration utilities
export { discoverAwsConfig, validateAwsConfig, showAwsConfiguration, showAwsEnvironmentVariables } from "./lib/aws-config.ts";
export type { AwsConfig, AwsConfigResult } from "./lib/aws-config.ts";

// Environment discovery utilities
export { discoverEnvFile, loadDiscoveredEnvFile, findEnvFile, validateRequiredEnvVars } from "./lib/env-finder.ts";
export type { EnvDiscoveryConfig, EnvDiscoveryResult } from "./lib/env-finder.ts";

// Re-export for convenience
export type { S3Client } from "@aws-sdk/client-s3";