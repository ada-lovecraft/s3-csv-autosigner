import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client } from "./s3-client.ts";
import type { CsvUploadResult, UploadOptions } from "./types.ts";
import { readFileSync, existsSync, statSync } from "fs";
import { basename } from "path";

/**
 * Uploads CSV files to S3 and generates presigned download URLs.
 * 
 * This function is a volatile little bastard that takes your CSV files,
 * throws them at S3, and gives you back download URLs that'll work for an hour.
 * Perfect for when you need to share data but don't want to deal with
 * authentication nightmares.
 */
export async function uploadCsvFiles(
  csvFilePaths: string[],
  options: UploadOptions = {}
): Promise<CsvUploadResult[]> {
  const bucket = options.bucket || process.env.S3_BUCKET;
  
  if (!bucket) {
    throw new Error(
      "S3 bucket must be specified either via 'bucket' option or S3_BUCKET environment variable"
    );
  }
  
  const { keyPrefix = "csv-uploads", expiresIn = 3600 } = options;
  
  // Validate all files exist before starting uploads
  const invalidFiles = csvFilePaths.filter(filePath => {
    if (!existsSync(filePath)) return true;
    if (!statSync(filePath).isFile()) return true;
    return false;
  });
  
  if (invalidFiles.length > 0) {
    throw new Error(`Invalid file paths: ${invalidFiles.join(", ")}`);
  }

  const s3Client = await createS3Client({
    awsConfig: {
      region: options.region,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      sessionToken: options.sessionToken
    },
    verbose: options.verbose,
    startDir: options.startDir
  });

  const results: CsvUploadResult[] = [];

  // Process files in parallel because life is too short for sequential uploads
  const uploadPromises = csvFilePaths.map(async (localPath) => {
    const fileName = basename(localPath);
    const key = `${keyPrefix}/${fileName}`;
    
    try {
      // Read file data
      const fileData = readFileSync(localPath);
      
      // Upload to S3
      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileData,
        ContentType: "text/csv"
      });
      
      await s3Client.send(putCommand);
      
      // Generate presigned URL for downloading the uploaded file
      const presignedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        }),
        { expiresIn }
      );
      
      return {
        localPath,
        fileName,
        presignedUrl
      };
    } catch (error) {
      throw new Error(`Failed to upload ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  try {
    const uploadResults = await Promise.all(uploadPromises);
    results.push(...uploadResults);
  } catch (error) {
    throw new Error(`Batch upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return results;
}

/**
 * Convenience function for uploading a single CSV file.
 * Because sometimes you just have one file and don't want to wrap it in an array.
 */
export async function uploadSingleCsv(
  csvFilePath: string,
  options: UploadOptions = {}
): Promise<CsvUploadResult> {
  const results = await uploadCsvFiles([csvFilePath], options);
  const result = results[0];
  if (!result) {
    throw new Error(`Failed to upload file: ${csvFilePath}`);
  }
  return result;
}