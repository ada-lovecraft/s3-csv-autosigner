import { S3Client } from "@aws-sdk/client-s3";
import { discoverAwsConfig, validateAwsConfig, type AwsConfig } from "./lib/aws-config.ts";

/**
 * S3 client configuration options
 */
export interface S3ClientOptions {
  /** AWS configuration (will be merged with discovered environment config) */
  awsConfig?: AwsConfig;
  /** Enable verbose logging for configuration discovery */
  verbose?: boolean;
  /** Directory to start .env file discovery from */
  startDir?: string;
}

/**
 * Creates and configures an S3 client instance with intelligent configuration discovery.
 * 
 * This function is a configuration wizard that:
 * 1. Discovers .env files up the directory tree
 * 2. Loads and validates AWS credentials
 * 3. Provides helpful error messages when configuration is missing
 * 4. Falls back to AWS SDK default credential provider chain
 * 
 * @param options - S3 client configuration options
 * @returns Promise<S3Client> - Configured S3 client
 */
export async function createS3Client(options: S3ClientOptions = {}): Promise<S3Client> {
  const { awsConfig = {}, verbose = false, startDir } = options;
  
  // Discover and validate AWS configuration
  const configResult = await discoverAwsConfig(awsConfig, { verbose, startDir });
  
  // Validate configuration if using environment variables
  if (configResult.source === "environment") {
    validateAwsConfig(configResult);
  }
  
  // Build S3 client configuration
  const clientConfig: any = {
    region: configResult.config.region || "us-east-1"
  };
  
  // Only set explicit credentials if we have them
  // Otherwise, let AWS SDK use its default credential provider chain
  if (configResult.config.accessKeyId && configResult.config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: configResult.config.accessKeyId,
      secretAccessKey: configResult.config.secretAccessKey,
      ...(configResult.config.sessionToken && { sessionToken: configResult.config.sessionToken })
    };
  }
  
  return new S3Client(clientConfig);
}

/**
 * Synchronous version of createS3Client for backwards compatibility
 * 
 * WARNING: This bypasses the intelligent configuration discovery.
 * Use createS3Client() for the full experience.
 * 
 * @param config - Basic S3 configuration
 * @returns S3Client - Configured S3 client
 */
export function createS3ClientSync(config: AwsConfig = {}): S3Client {
  const clientConfig: any = {
    region: config.region || process.env.AWS_REGION || "us-east-1"
  };
  
  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      ...(config.sessionToken && { sessionToken: config.sessionToken })
    };
  }
  
  return new S3Client(clientConfig);
}