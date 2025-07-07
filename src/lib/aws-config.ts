/**
 * AWS Configuration Discovery and Validation
 * 
 * Because AWS credentials shouldn't be a fucking mystery.
 * Uses the env-finder to discover .env files and validates AWS configuration.
 */

import { loadDiscoveredEnvFile, validateRequiredEnvVars, showEnvConfiguration } from "./env-finder.ts";
import chalk from "chalk";
import figures from "figures";

/**
 * AWS configuration that can be explicitly provided or discovered from environment
 */
export interface AwsConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  profile?: string;
}

/**
 * Result of AWS configuration discovery and validation
 */
export interface AwsConfigResult {
  config: AwsConfig;
  isValid: boolean;
  missingVars: string[];
  source: "explicit" | "environment" | "aws-sdk-default";
  envFileUsed?: string;
}

/**
 * Standard AWS environment variable names
 */
export const AWS_ENV_VARS = [
  "AWS_REGION",
  "AWS_DEFAULT_REGION", 
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_PROFILE",
  "S3_BUCKET"
] as const;

/**
 * Required AWS environment variables for explicit credential configuration
 */
export const REQUIRED_AWS_VARS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY"
] as const;

/**
 * Required S3-specific environment variables
 */
export const REQUIRED_S3_VARS = [
  "S3_BUCKET"
] as const;

/**
 * Discovers and loads AWS configuration from environment files and variables
 * 
 * This function is smarter than your average config loader:
 * 1. Discovers .env files up the directory tree
 * 2. Loads environment variables 
 * 3. Validates AWS credential configuration
 * 4. Provides helpful error messages when shit goes wrong
 * 
 * @param explicitConfig - Explicitly provided AWS configuration
 * @param options - Discovery options
 * @returns Promise<AwsConfigResult> - Complete AWS configuration result
 */
export async function discoverAwsConfig(
  explicitConfig: AwsConfig = {},
  options: { verbose?: boolean; startDir?: string } = {}
): Promise<AwsConfigResult> {
  const { verbose = false, startDir } = options;
  
  if (verbose) {
    console.log(chalk.blue(`${figures.info} Discovering AWS configuration...`));
  }
  
  // Load .env files if not explicitly disabled
  const envResult = await loadDiscoveredEnvFile({
    startDir,
    verbose,
    envFileNames: [".env.local", ".env", ".env.aws", ".env.production", ".env.development"]
  });
  
  // Build final configuration from explicit config + environment
  const config: AwsConfig = {
    region: explicitConfig.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    accessKeyId: explicitConfig.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: explicitConfig.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: explicitConfig.sessionToken || process.env.AWS_SESSION_TOKEN,
    profile: explicitConfig.profile || process.env.AWS_PROFILE
  };
  
  // Determine configuration source
  let source: AwsConfigResult["source"] = "aws-sdk-default";
  if (explicitConfig.accessKeyId && explicitConfig.secretAccessKey) {
    source = "explicit";
  } else if (config.accessKeyId && config.secretAccessKey) {
    source = "environment";
  }
  
  // Always validate S3_BUCKET regardless of credential source
  const s3MissingVars = REQUIRED_S3_VARS.filter(varName => !process.env[varName]);
  
  // Validate required variables only if we're using explicit credentials
  let isValid = true;
  let missingVars: string[] = [...s3MissingVars];
  
  if (source === "environment") {
    // Check for required environment variables
    const requiredVars: string[] = [...REQUIRED_AWS_VARS];
    if (!config.region) {
      requiredVars.push("AWS_REGION");
    }
    
    const awsMissingVars = requiredVars.filter(varName => !process.env[varName]);
    missingVars.push(...awsMissingVars);
    isValid = missingVars.length === 0;
    
    if (verbose) {
      if (isValid) {
        console.log(chalk.green(`${figures.tick} AWS credentials found in environment variables`));
      } else {
        console.log(chalk.red(`${figures.cross} Missing required environment variables:`));
        missingVars.forEach(varName => {
          console.log(chalk.red(`   ${varName}`));
        });
      }
    }
  } else if (source === "explicit") {
    // Still need S3_BUCKET even with explicit credentials
    isValid = s3MissingVars.length === 0;
    if (verbose) {
      if (isValid) {
        console.log(chalk.green(`${figures.tick} Using explicitly provided AWS credentials`));
      } else {
        console.log(chalk.red(`${figures.cross} Missing required S3 environment variables:`));
        s3MissingVars.forEach(varName => {
          console.log(chalk.red(`   ${varName}`));
        });
      }
    }
  } else {
    // AWS SDK default credential chain - still need S3_BUCKET
    isValid = s3MissingVars.length === 0;
    if (verbose) {
      console.log(chalk.yellow(`${figures.info} Using AWS SDK default credential provider chain`));
      console.log(chalk.dim(`   Will check: environment variables → shared credentials → IAM roles`));
      if (!isValid) {
        console.log(chalk.red(`${figures.cross} Missing required S3 environment variables:`));
        s3MissingVars.forEach(varName => {
          console.log(chalk.red(`   ${varName}`));
        });
      }
    }
  }
  
  if (verbose) {
    showAwsConfiguration(config, source);
  }
  
  return {
    config,
    isValid,
    missingVars,
    source,
    envFileUsed: envResult.envFilePath || undefined
  };
}

/**
 * Validates AWS configuration and throws helpful errors
 * 
 * @param configResult - Result from discoverAwsConfig
 * @throws Error with helpful message if configuration is invalid
 */
export function validateAwsConfig(configResult: AwsConfigResult): void {
  if (!configResult.isValid) {
    const missingVarsMessage = configResult.missingVars.join(", ");
    
    if (configResult.missingVars.includes("S3_BUCKET")) {
      throw new Error(
        `Missing required environment variables: ${missingVarsMessage}.\n` +
        `The S3_BUCKET environment variable is always required.\n` +
        `Please set these in your environment or .env file.`
      );
    } else {
      throw new Error(
        `Missing required AWS environment variables: ${missingVarsMessage}.\n` +
        `Please set these in your environment or .env file, or use explicit configuration.`
      );
    }
  }
}

/**
 * Shows current AWS configuration in a nice format
 * Masks sensitive values for security
 * 
 * @param config - AWS configuration to display
 * @param source - Configuration source
 */
export function showAwsConfiguration(config: AwsConfig, source: AwsConfigResult["source"]): void {
  console.log(chalk.cyan(`\n${figures.info} AWS Configuration (${source}):`));
  console.log(chalk.blue("-".repeat(50)));
  
  const configEntries = [
    { key: "Region", value: config.region || "(using SDK default)" },
    { key: "Access Key ID", value: config.accessKeyId ? maskSensitiveValue(config.accessKeyId) : "(using SDK default)" },
    { key: "Secret Access Key", value: config.secretAccessKey ? maskSensitiveValue(config.secretAccessKey) : "(using SDK default)" },
    { key: "Session Token", value: config.sessionToken ? maskSensitiveValue(config.sessionToken) : "(not set)" },
    { key: "Profile", value: config.profile || "(not set)" }
  ];
  
  configEntries.forEach(({ key, value }) => {
    console.log(`${chalk.blue(key.padEnd(20))}: ${chalk.white(value)}`);
  });
  
  console.log(chalk.blue("-".repeat(50)));
}

/**
 * Masks sensitive values for display
 * Shows first 4 and last 4 characters with asterisks in between
 */
function maskSensitiveValue(value: string): string {
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`;
}

/**
 * Quick utility to show all AWS-related environment variables
 * Useful for debugging configuration issues
 */
export function showAwsEnvironmentVariables(): void {
  showEnvConfiguration([...AWS_ENV_VARS]);
}