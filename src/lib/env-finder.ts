/**
 * Smart .env file discovery utility that crawls up the directory tree
 * Because configuration files shouldn't be harder to find than your keys
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import figures from 'figures';

/**
 * Configuration for .env file discovery
 */
export interface EnvDiscoveryConfig {
  /** Starting directory for search (defaults to process.cwd()) */
  startDir?: string;
  /** Maximum levels to search up the directory tree */
  maxLevels?: number;
  /** Names of .env files to look for (in priority order) */
  envFileNames?: string[];
  /** Whether to show verbose output during discovery */
  verbose?: boolean;
}

/**
 * Result of .env file discovery
 */
export interface EnvDiscoveryResult {
  /** Path to the discovered .env file (null if none found) */
  envFilePath: string | null;
  /** Directory containing the .env file */
  envDirectory: string | null;
  /** Name of the .env file that was found */
  envFileName: string | null;
  /** All .env files found during search (for debugging) */
  allFound: string[];
  /** Number of directories searched */
  searchedLevels: number;
}

/**
 * Default configuration for .env discovery
 * Because sensible defaults are like good documentation - rare but precious
 */
const getDefaultConfig = (): Required<EnvDiscoveryConfig> => ({
  startDir: process.cwd(),
  maxLevels: 10, // Should be enough to find any reasonable project root
  envFileNames: ['.env.local', '.env', '.env.production', '.env.development'],
  verbose: false
});

/**
 * Discovers .env files by crawling up the directory tree
 * Starts from current directory and searches upward until it finds an .env file
 * or reaches the filesystem root or max search levels
 * 
 * @param config - Configuration for the discovery process
 * @returns Promise<EnvDiscoveryResult> - Results of the discovery process
 */
export async function discoverEnvFile(config: EnvDiscoveryConfig = {}): Promise<EnvDiscoveryResult> {
  const defaultConfig = getDefaultConfig();
  const finalConfig = { 
    ...defaultConfig, 
    ...config,
    // Ensure startDir is always defined
    startDir: config.startDir || defaultConfig.startDir
  };
  const { startDir, maxLevels, envFileNames, verbose } = finalConfig;
  
  if (verbose) {
    console.log(chalk.blue(`${figures.info} Searching for .env files starting from: ${startDir}`));
    console.log(chalk.dim(`   Looking for: ${envFileNames.join(', ')}`));
  }
  
  const result: EnvDiscoveryResult = {
    envFilePath: null,
    envDirectory: null,
    envFileName: null,
    allFound: [],
    searchedLevels: 0
  };
  
  let currentDir = path.resolve(startDir);
  const rootDir = path.parse(currentDir).root;
  
  // Search up the directory tree like a caffeinated spider
  for (let level = 0; level < maxLevels; level++) {
    result.searchedLevels = level + 1;
    
    if (verbose) {
      console.log(chalk.dim(`   Searching level ${level + 1}: ${currentDir}`));
    }
    
    // Check each .env file name in priority order
    for (const envFileName of envFileNames) {
      const envFilePath = path.join(currentDir, envFileName);
      
      try {
        // Check if file exists and is readable
        await fs.promises.access(envFilePath, fs.constants.R_OK);
        
        // Found a readable .env file!
        result.allFound.push(envFilePath);
        
        if (!result.envFilePath) {
          // This is the first (highest priority) .env file we found
          result.envFilePath = envFilePath;
          result.envDirectory = currentDir;
          result.envFileName = envFileName;
          
          if (verbose) {
            console.log(chalk.green(`${figures.tick} Found .env file: ${envFilePath}`));
          }
        } else if (verbose) {
          console.log(chalk.dim(`   Also found: ${envFilePath}`));
        }
        
      } catch (error) {
        // File doesn't exist or isn't readable, keep searching
        continue;
      }
    }
    
    // If we found at least one .env file, we can stop searching
    // (unless verbose mode is on and we want to show all files)
    if (result.envFilePath && !verbose) {
      break;
    }
    
    // Move up one directory level
    const parentDir = path.dirname(currentDir);
    
    // Stop if we've reached the filesystem root
    if (parentDir === currentDir || currentDir === rootDir) {
      if (verbose) {
        console.log(chalk.dim(`   Reached filesystem root, stopping search`));
      }
      break;
    }
    
    currentDir = parentDir;
  }
  
  if (verbose) {
    if (result.envFilePath) {
      console.log(chalk.green(`${figures.tick} Using .env file: ${result.envFilePath}`));
    } else {
      console.log(chalk.yellow(`${figures.warning} No .env file found after searching ${result.searchedLevels} levels`));
    }
  }
  
  return result;
}

/**
 * Loads and applies .env file variables to process.env
 * Uses the discovery mechanism to find the closest .env file
 * 
 * @param config - Configuration for discovery and loading
 * @returns Promise<EnvDiscoveryResult> - Results including which file was loaded
 */
export async function loadDiscoveredEnvFile(config: EnvDiscoveryConfig = {}): Promise<EnvDiscoveryResult> {
  const result = await discoverEnvFile(config);
  
  if (result.envFilePath) {
    try {
      // Dynamically import dotenv to load the discovered file
      const { config: dotenvConfig } = await import('dotenv');
      
      // Load the specific .env file we discovered
      const dotenvResult = dotenvConfig({ path: result.envFilePath });
      
      if (dotenvResult.error) {
        if (config.verbose) {
          console.log(chalk.red(`${figures.cross} Failed to load .env file: ${dotenvResult.error.message}`));
        }
      } else if (config.verbose) {
        const loadedKeys = Object.keys(dotenvResult.parsed || {});
        console.log(chalk.green(`${figures.tick} Loaded ${loadedKeys.length} environment variables`));
        if (loadedKeys.length > 0) {
          console.log(chalk.dim(`   Variables: ${loadedKeys.join(', ')}`));
        }
      }
      
    } catch (error) {
      if (config.verbose) {
        console.log(chalk.red(`${figures.cross} Error loading .env file: ${error}`));
      }
    }
  }
  
  return result;
}

/**
 * Quick utility to just get the path of the closest .env file
 * For when you don't need all the bells and whistles
 * 
 * @param startDir - Directory to start searching from
 * @returns Promise<string | null> - Path to .env file or null if not found
 */
export async function findEnvFile(startDir?: string): Promise<string | null> {
  const result = await discoverEnvFile({ startDir, verbose: false });
  return result.envFilePath;
}

/**
 * Validates that required environment variables are present
 * Useful for checking configuration after loading .env files
 * 
 * @param requiredVars - Array of required environment variable names
 * @param verbose - Whether to show detailed output
 * @returns boolean - True if all required variables are present
 */
export function validateRequiredEnvVars(requiredVars: string[], verbose: boolean = false): boolean {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    if (verbose) {
      console.log(chalk.red(`${figures.cross} Missing required environment variables:`));
      missing.forEach(varName => {
        console.log(chalk.red(`   ${varName}`));
      });
    }
    return false;
  }
  
  if (verbose && requiredVars.length > 0) {
    console.log(chalk.green(`${figures.tick} All required environment variables are present`));
  }
  
  return true;
}

/**
 * Shows current environment configuration in a nice format
 * Useful for debugging configuration issues
 * 
 * @param envVars - Array of environment variable names to display
 */
export function showEnvConfiguration(envVars: string[]): void {
  console.log(chalk.cyan(`\n${figures.info} Environment Configuration:`));
  console.log(chalk.blue('-'.repeat(40)));
  
  envVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      // Mask sensitive values (passwords, tokens, etc.)
      const isSensitive = varName.toLowerCase().includes('password') || 
                         varName.toLowerCase().includes('token') || 
                         varName.toLowerCase().includes('secret');
      
      const displayValue = isSensitive ? '*'.repeat(Math.min(value.length, 8)) : value;
      console.log(`${chalk.blue(varName.padEnd(20))}: ${chalk.white(displayValue)}`);
    } else {
      console.log(`${chalk.blue(varName.padEnd(20))}: ${chalk.dim('(not set)')}`);
    }
  });
  
  console.log(chalk.blue('-'.repeat(40)));
}