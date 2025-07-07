# S3 CSV Autosigner

*A library for uploading CSV files to S3 and generating presigned URLs, because dealing with file uploads shouldn't require a PhD in AWS archaeology.*

---

## What The Hell Is This?

This is a TypeScript library that takes your CSV files, throws them at S3, and gives you back presigned URLs that actually work. It's built with Bun (because we have standards) and comes with automatic configuration discovery that's smarter than most DevOps engineers.

**What it does:**
→ Uploads CSV files to S3 in parallel (because life is too short for sequential uploads)  
→ Generates presigned URLs for sharing without authentication nightmares  
→ Automatically discovers `.env` files up your directory tree like a caffeinated spider  
→ Validates AWS credentials and gives you helpful error messages instead of cryptic bullshit  
→ Provides both programmatic API and CLI tools  

**What it doesn't do:**
→ Read your mind (you still need to provide a bucket name)  
→ Fix your AWS bill (that's between you and Bezos)  
→ Work with other file types (it's in the fucking name: CSV Autosigner)  

---

## Quick Start (30 Second Version)

```bash
# Install dependencies
bun install

# Set up your environment (see AWS Setup below if you're lost)
echo "AWS_ACCESS_KEY_ID=your_key_here" > .env
echo "AWS_SECRET_ACCESS_KEY=your_secret_here" >> .env
echo "AWS_REGION=us-east-1" >> .env

# Upload some CSV files
import { uploadCsvFiles } from './index.ts';

const results = await uploadCsvFiles(
  ['./data/sales.csv', './data/customers.csv'],
  { bucket: 'my-csv-bucket', verbose: true }
);

console.log(results); // Array of {localPath, fileName, presignedUrl}
```

Done. Your CSV files are now in S3 and you have presigned URLs. Go forth and prosper.

---

## AWS Setup (For Those Who Haven't Sold Their Soul to Bezos Yet)

### Step 1: Create S3 Bucket (First Things First)

Before we create IAM policies that reference a bucket, let's actually create the damn bucket:

```bash
# Using AWS CLI (if you have it)
aws s3 mb s3://your-csv-bucket --region us-east-1

# Or use the console like a civilized human
# https://console.aws.amazon.com/s3/
```

**Important**: Remember your bucket name - you'll need it for the IAM policy in the next step. Pick something unique because S3 bucket names are globally unique across all of AWS (thanks, Bezos).

### Step 2: Create an IAM User (Don't Use Root, You Absolute Madlad)

1. **Sign into AWS Console**: [https://console.aws.amazon.com/iam/](https://console.aws.amazon.com/iam/)
2. **Navigate to Users**: Click "Users" in the left sidebar
3. **Create User**: Click "Create user" button
4. **Username**: Pick something memorable like `csv-uploader-bot`
5. **Access Type**: Select "Programmatic access" (no console access needed)
6. **Permissions**: Attach policies directly → Create policy

### Step 3: Create IAM Policy (The Boring But Critical Part)

Create a custom policy with this JSON (replace `your-csv-bucket` with the bucket name you just created):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-csv-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::your-csv-bucket"
    }
  ]
}
```

**Policy Name**: `CSV-Uploader-S3-Access` (or whatever doesn't make you hate yourself)

### Step 4: Generate Access Keys (The Sacred Ritual)

1. **Select Your User**: Click on the user you just created
2. **Security Credentials Tab**: Click it
3. **Create Access Key**: Click the button
4. **Use Case**: Select "Application running outside AWS"
5. **Download CSV**: DOWNLOAD THE FUCKING CSV FILE. You cannot get the secret key again.
6. **Store Safely**: Put it somewhere secure, not in your Downloads folder

### Step 5: Set Up Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your actual AWS credentials:

```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_SESSION_TOKEN=optional-for-temporary-creds
```

**SECURITY WARNING**: Add `.env` to your `.gitignore` file. If you commit AWS credentials to a public repo, you'll get charged for Bitcoin mining before you can say "whoops".

---

## Installation & Usage

### Installation

```bash
# Using npm (the universal way)
npm install s3-csv-autosigner

# Using bun (recommended because we're not animals)
bun add s3-csv-autosigner

# Using yarn (if you're into that)
yarn add s3-csv-autosigner
```

**Requirements**: Node.js 18.0.0 or higher. This library is ESM-only and built with modern JavaScript standards.

### Programmatic API

#### Upload Multiple Files

```typescript
import { uploadCsvFiles } from 's3-csv-autosigner';

const results = await uploadCsvFiles(
  ['./data/file1.csv', './data/file2.csv', './data/file3.csv'],
  {
    bucket: 'my-csv-bucket',
    keyPrefix: 'uploads/2024',     // Optional: folder in bucket
    expiresIn: 3600,               // Optional: URL expiration (seconds)
    verbose: true                  // Optional: show configuration details
  }
);

// Results is an array of:
// {
//   localPath: './data/file1.csv',
//   fileName: 'file1.csv',
//   presignedUrl: 'https://s3.amazonaws.com/...'
// }
```

#### Upload Single File

```typescript
import { uploadSingleCsv } from 's3-csv-autosigner';

const result = await uploadSingleCsv('./important-data.csv', {
  bucket: 'my-csv-bucket',
  keyPrefix: 'critical-data',
  expiresIn: 7200  // 2 hours
});

console.log(`Upload complete: ${result.presignedUrl}`);
```

#### Explicit AWS Configuration

```typescript
const results = await uploadCsvFiles(csvFiles, {
  bucket: 'my-csv-bucket',
  // Override automatic discovery
  accessKeyId: 'AKIA...',
  secretAccessKey: 'wJal...',
  region: 'us-west-2',
  sessionToken: 'optional-temp-token'
});
```

### Configuration Discovery (The Magic)

This library automatically discovers configuration in this order:

1. **Explicit parameters** passed to functions
2. **Environment variables** from discovered `.env` files
3. **AWS SDK defaults** (shared credentials, IAM roles, etc.)

#### Environment File Discovery

The library crawls up your directory tree looking for:
- `.env.local` (highest priority)
- `.env`
- `.env.aws`
- `.env.production`
- `.env.development`

It searches up to 10 directory levels, so it'll find your `.env` file even if you're buried deep in subdirectories.

#### Debug Configuration

```typescript
import { showAwsEnvironmentVariables } from 's3-csv-autosigner';

// Show current AWS environment variables
showAwsEnvironmentVariables();

// Upload with verbose logging
const results = await uploadCsvFiles(files, {
  bucket: 'my-bucket',
  verbose: true  // Shows configuration discovery process
});
```

---

## CLI Tools (Coming Soon)

Because sometimes you just want to upload files without writing code:

```bash
# Upload files from command line
csv-upload ./data/*.csv --bucket my-csv-bucket --prefix uploads/

# Generate presigned URLs for existing files
csv-presign s3://my-bucket/data.csv --expires 1h
```

---

## API Reference

### `uploadCsvFiles(filePaths, options)`

Uploads multiple CSV files to S3 and returns presigned URLs.

**Parameters:**
- `filePaths`: `string[]` - Array of local file paths to upload
- `options`: `UploadOptions` - Configuration object

**Returns:** `Promise<CsvUploadResult[]>`

### `uploadSingleCsv(filePath, options)`

Uploads a single CSV file to S3 and returns a presigned URL.

**Parameters:**
- `filePath`: `string` - Local file path to upload
- `options`: `UploadOptions` - Configuration object

**Returns:** `Promise<CsvUploadResult>`

### `UploadOptions`

```typescript
interface UploadOptions {
  bucket: string;                    // S3 bucket name (required)
  keyPrefix?: string;                // S3 key prefix (default: "csv-uploads")
  expiresIn?: number;                // URL expiration in seconds (default: 3600)
  region?: string;                   // AWS region
  accessKeyId?: string;              // AWS access key ID
  secretAccessKey?: string;          // AWS secret access key
  sessionToken?: string;             // AWS session token (for temporary creds)
  verbose?: boolean;                 // Enable detailed logging (default: false)
  startDir?: string;                 // Directory to start .env search from
}
```

### `CsvUploadResult`

```typescript
interface CsvUploadResult {
  localPath: string;                 // Original local file path
  fileName: string;                  // File name (basename of local path)
  presignedUrl: string;              // Generated presigned URL
}
```

---

## Troubleshooting (When Shit Goes Wrong)

### Error: "Missing required AWS environment variables"

**Problem**: You don't have AWS credentials configured.

**Solution**: 
1. Check your `.env` file exists and has `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
2. Use `verbose: true` to see what configuration is being discovered
3. Run `showAwsEnvironmentVariables()` to see current environment state

### Error: "Access Denied" or "Forbidden"

**Problem**: Your IAM user doesn't have permission to upload to the bucket.

**Solution**:
1. Check your IAM policy includes `s3:PutObject` permission
2. Verify the bucket name is correct
3. Make sure the bucket exists in the specified region

### Error: "No such bucket"

**Problem**: The bucket doesn't exist or you're looking in the wrong region.

**Solution**:
1. Create the bucket: `aws s3 mb s3://your-bucket-name`
2. Check the bucket region matches your `AWS_REGION`
3. Verify bucket name spelling (S3 is unforgiving)

### Error: "Invalid file paths"

**Problem**: One or more CSV files don't exist or aren't readable.

**Solution**:
1. Check file paths are correct and files exist
2. Verify you have read permissions on the files
3. Make sure files are actually files, not directories

### Performance Issues

**Problem**: Uploads are slow as molasses.

**Solutions**:
1. Check your internet connection (revolutionary, I know)
2. Use smaller batch sizes if uploading many files
3. Choose an S3 region closer to your location
4. Consider S3 Transfer Acceleration for large files

### "The Secret Access Key I Downloaded Doesn't Work"

**Problem**: AWS is being AWS.

**Solutions**:
1. Make sure you didn't add extra spaces when copying keys
2. Generate new access keys (old ones might be disabled)
3. Check your IAM user still exists and has policies attached
4. Try using the AWS CLI to test credentials: `aws sts get-caller-identity`

---

## Examples

### Basic Upload

```typescript
import { uploadCsvFiles } from './index.ts';

const files = ['sales-2024.csv', 'customers.csv'];
const results = await uploadCsvFiles(files, {
  bucket: 'company-data-bucket'
});

results.forEach(result => {
  console.log(`${result.fileName}: ${result.presignedUrl}`);
});
```

### Production Setup with Error Handling

```typescript
import { uploadCsvFiles, validateAwsConfig } from './index.ts';

async function uploadData() {
  try {
    const results = await uploadCsvFiles(
      ['./exports/daily-report.csv'],
      {
        bucket: 'production-data-bucket',
        keyPrefix: `reports/${new Date().toISOString().split('T')[0]}`,
        expiresIn: 86400, // 24 hours
        verbose: process.env.NODE_ENV === 'development'
      }
    );
    
    // Send URLs to clients, save to database, etc.
    await notifyClientsOfNewData(results);
    
  } catch (error) {
    console.error('Upload failed:', error.message);
    
    // Handle specific error types
    if (error.message.includes('Missing required AWS')) {
      console.error('Check your AWS credentials configuration');
    } else if (error.message.includes('Access Denied')) {
      console.error('Check your IAM permissions');
    }
    
    throw error; // Re-throw for monitoring systems
  }
}
```

### Development vs Production Configuration

```typescript
// .env.development
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...dev
AWS_SECRET_ACCESS_KEY=...dev

// .env.production  
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=AKIA...prod
AWS_SECRET_ACCESS_KEY=...prod

// Your code automatically picks up the right config
const results = await uploadCsvFiles(files, {
  bucket: process.env.NODE_ENV === 'production' 
    ? 'prod-csv-bucket' 
    : 'dev-csv-bucket',
  verbose: process.env.NODE_ENV === 'development'
});
```

---

## Contributing

Want to help make this library even more chaotically useful? Here's how:

### Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/s3-csv-autosigner
cd s3-csv-autosigner

# Install dependencies 
bun install

# Run tests
bun test

# Run example
bun example.ts
```

### Project Principles

- **Bun first**: We use Bun for everything. No Node.js unless absolutely necessary.
- **TypeScript always**: All code is TypeScript. JavaScript is for barbarians.
- **Single responsibility**: Each tool does one thing well.
- **Helpful errors**: Error messages should help users fix problems, not send them to Stack Overflow.
- **Configuration discovery**: Smart defaults, but allow explicit overrides.

### Code Style

- Clean, readable code with descriptive variable names
- Comments that explain *why*, not *what*
- Error handling that doesn't suck
- Tests for everything that matters

### Submitting Changes

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if needed
5. Run the linter: `bun run lint`
6. Submit a pull request with a clear description

---

## License

MIT License - Do whatever you want with this code, just don't blame me when it works too well.

---

## Support

If this library saved your sanity, consider:
- ⭐ Starring the repo
- 🐛 Filing issues for bugs
- 💡 Suggesting improvements
- ☕ Buying me coffee (if you can find my Venmo)

For bugs, feature requests, or existential crises, file an issue on GitHub.

---

*Built with ❤️, ☕, and an unhealthy amount of profanity by someone who's spent too much time fighting with AWS.*