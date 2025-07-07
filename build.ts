/**
 * Build script for S3 CSV Autosigner library
 * Uses Bun's native bundler with bun-dts plugin for TypeScript declarations
 */

import { dts } from "bun-dts";

console.log("🔨 Building S3 CSV Autosigner library...");

const result = await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  plugins: [
    dts({
      // Generate TypeScript declarations
      output: {
        noBanner: true,
      },
    }),
  ],
});

if (!result.success) {
  console.error("❌ Build failed:");
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
}

console.log("✅ Build completed successfully!");
console.log(`📦 Generated ${result.outputs.length} output files:`);
for (const output of result.outputs) {
  const size = (output.size / 1024).toFixed(1);
  const filename = output.path.split('/').pop();
  console.log(`   ${filename} (${size} KB)`);
}

// Check for TypeScript declarations
const fs = require("fs");
if (fs.existsSync("./dist/index.d.ts")) {
  const dtsSize = (fs.statSync("./dist/index.d.ts").size / 1024).toFixed(1);
  console.log(`   index.d.ts (${dtsSize} KB) - TypeScript declarations`);
}

console.log("\n🚀 Ready for npm publishing!");