#!/usr/bin/env bun

/**
 * Example usage of the S3 CSV Autosigner library.
 * 
 * Run with: bun example.ts
 * 
 * The library will automatically discover and load .env files from:
 * - Current directory
 * - Parent directories up the tree
 * - Standard AWS environment variables
 * 
 * Or you can provide explicit AWS configuration.
 */

import { uploadCsvFiles, showAwsEnvironmentVariables } from "./index.ts";
import { readdirSync } from "fs";
import { join } from "path";

async function main() {
  try {
    // Show current AWS environment configuration
    console.log("🔍 Current AWS Environment:");
    showAwsEnvironmentVariables();
    
    // Discover all CSV files in the data directory
    const dataDir = "./data";
    console.log(`\n📁 Scanning ${dataDir} for CSV files...`);
    
    const allFiles = readdirSync(dataDir);
    const csvFiles = allFiles
      .filter(file => file.toLowerCase().endsWith('.csv'))
      .map(file => join(dataDir, file))
      .sort(); // Sort for consistent ordering
    
    console.log(`📊 Found ${csvFiles.length} CSV files:`);
    csvFiles.forEach((file, index) => {
      const fileName = file.split('/').pop();
      console.log(`   ${index + 1}. ${fileName}`);
    });
    
    if (csvFiles.length === 0) {
      console.log("⚠️  No CSV files found in data directory!");
      return;
    }

    console.log("\n🚀 Uploading ALL CSV files to S3 with batch processing...");
    
    const startTime = Date.now();
    
    // S3_BUCKET environment variable is used automatically
    const results = await uploadCsvFiles(csvFiles, {
      keyPrefix: `batch-upload/${new Date().toISOString().split('T')[0]}`, // Date-based folder
      expiresIn: 7200, // 2 hours for batch uploads
      verbose: true // Show configuration discovery process
    });
    
    const endTime = Date.now();
    const uploadTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n🎉 BATCH UPLOAD COMPLETED!");
    console.log(`⏱️  Total upload time: ${uploadTime} seconds`);
    console.log(`📁 Files uploaded: ${results.length}`);
    console.log(`📋 Average time per file: ${(parseFloat(uploadTime) / results.length).toFixed(2)} seconds`);
    
    console.log("\n📄 Upload Results:");
    console.log("=".repeat(80));
    results.forEach((result, index) => {
      console.log(`${index + 1}. 📄 ${result.fileName}`);
      console.log(`   📍 Local: ${result.localPath}`);
      console.log(`   🔗 URL: ${result.presignedUrl.substring(0, 100)}...`);
      console.log("");
    });
    
    console.log("\n📊 Upload Summary:");
    console.log(`✓ Successfully uploaded ${results.length} CSV files`);
    console.log(`✓ All files stored in S3 with 2-hour presigned URLs`);
    console.log(`✓ Files organized in batch-upload/${new Date().toISOString().split('T')[0]}/ folder`);
    console.log(`✓ Parallel upload completed in ${uploadTime} seconds`);
    
    console.log("\n🚀 Ready to share these URLs or integrate with your application!");

  } catch (error) {
    console.error("💥 Upload failed:", error instanceof Error ? error.message : String(error));
    console.error("\n💡 Troubleshooting tips:");
    console.error("   - Check your .env file has AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET");
    console.error("   - Verify your AWS credentials are valid");
    console.error("   - Make sure the S3 bucket exists and you have write permissions");
    console.error("   - Run with verbose: true to see detailed configuration discovery");
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (import.meta.main) {
  main();
}