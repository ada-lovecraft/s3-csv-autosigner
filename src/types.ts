export interface CsvUploadResult {
  localPath: string;
  fileName: string;
  presignedUrl: string;
}

export interface UploadOptions {
  /** S3 bucket name (defaults to S3_BUCKET environment variable) */
  bucket?: string;
  keyPrefix?: string;
  expiresIn?: number;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** Enable verbose logging for configuration discovery and upload process */
  verbose?: boolean;
  /** Directory to start .env file discovery from */
  startDir?: string;
}

export interface CsvFile {
  localPath: string;
  fileName: string;
}