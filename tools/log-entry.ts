#!/usr/bin/env bun

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface LogEntryOptions {
  title: string;
  summary: string;
  artifactName: string;
  artifactPath: string;
  stdin?: boolean;
}

function formatDateTime(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function formatLogEntry(options: LogEntryOptions): string {
  const { title, summary, artifactName, artifactPath } = options;
  const dateTime = formatDateTime();
  
  return `**${title}**
${dateTime}

${summary}

[${artifactName}](${artifactPath})

---

`;
}

async function readFromStdin(): Promise<string> {
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  
  const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  
  return decoder.decode(combined).trim();
}

function appendToProjectLog(logEntry: string): void {
  const projectLogPath = join(process.cwd(), 'PROJECT_LOG.md');
  
  if (existsSync(projectLogPath)) {
    const existingContent = readFileSync(projectLogPath, 'utf-8');
    writeFileSync(projectLogPath, existingContent + logEntry);
  } else {
    writeFileSync(projectLogPath, logEntry);
  }
}

async function main() {
  const program = new Command();
  
  program
    .name('log-entry')
    .description('Append a formatted log entry to PROJECT_LOG.md')
    .version('1.0.0')
    .requiredOption('-t, --title <title>', 'Entry title')
    .requiredOption('-a, --artifact-name <name>', 'Artifact name')
    .requiredOption('-p, --artifact-path <path>', 'Artifact file path')
    .option('-s, --summary <summary>', 'Entry summary (use --stdin to read from stdin instead)')
    .option('--stdin', 'Read summary from stdin')
    .parse();

  const options = program.opts();
  
  // Validate that either summary or stdin is provided
  if (!options.summary && !options.stdin) {
    console.error('Error: Either --summary or --stdin must be provided');
    process.exit(1);
  }
  
  if (options.summary && options.stdin) {
    console.error('Error: Cannot use both --summary and --stdin options');
    process.exit(1);
  }
  
  let summary: string;
  
  if (options.stdin) {
    try {
      summary = await readFromStdin();
      if (!summary) {
        console.error('Error: No input received from stdin');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error reading from stdin:', error);
      process.exit(1);
    }
  } else {
    summary = options.summary;
  }
  
  const logEntryOptions: LogEntryOptions = {
    title: options.title,
    summary,
    artifactName: options.artifactName,
    artifactPath: options.artifactPath,
  };
  
  try {
    const logEntry = formatLogEntry(logEntryOptions);
    appendToProjectLog(logEntry);
    console.log('Log entry added successfully to PROJECT_LOG.md');
  } catch (error) {
    console.error('Error writing to PROJECT_LOG.md:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}