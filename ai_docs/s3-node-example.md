```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

async function uploadCsvAndPresign({ bucket, key, filePath }) {
  const s3 = new S3Client({ region: "us-east-1" });
  const csvData = fs.readFileSync(filePath);

  // Upload the CSV
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: csvData,
    ContentType: "text/csv",
  }));
  console.log("✅ CSV uploaded");

  // Generate presigned URL for future PUT
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "text/csv" }),
    { expiresIn: 3600 }
  );
  console.log("🔗 Presigned URL:", url);
  return url;
}

// Usage example:
uploadCsvAndPresign({
  bucket: "my-csv-bucket",
  key: `exports/${path.basename("mydata.csv")}`,
  filePath: "./mydata.csv"
}).then(url => /* send to client or log */);

```