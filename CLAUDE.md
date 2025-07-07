# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an S3 autosigner library that uploads CSV files to S3 and generates pre-signed links. The project is currently in a major refactor state with most existing code marked for deletion.

**Key Details:**
- Runtime: Bun (not Node.js)
- Language: TypeScript
- CLI Framework: Commander.js
- Project Type: Library with both programmatic API and global CLI
- Main Entry: `index.ts`

## Development Commands

**Core Commands:**
- `bun install` - Install dependencies
- `bun run <script>` - Run package.json scripts
- `bun <file.ts>` - Execute TypeScript files directly
- `bun test` - Run tests
- `bun --hot <file.ts>` - Run with hot reload

**Build & Development:**
- No build step required (Bun handles TypeScript directly)
- Use `bun` instead of `node`, `npm`, `yarn`, or `pnpm`
- Environment variables are automatically loaded from `.env`

## Architecture & Structure

**Current State:**
- Project is in heavy refactor mode with most files marked for deletion
- Core structure: `index.ts` (entry point), `src/` (main code), `tools/` (CLI utilities)

**S3 Implementation Pattern:**
- Uses AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- Core workflow: Upload CSV → Generate presigned URL for future access
- Uploads to S3 with `PutObjectCommand`
- Generates presigned URLs with 1-hour expiration (configurable)
- ContentType set to "text/csv" for all uploads
- Example implementation in `ai_docs/s3-node-example.md`

**Configuration System:**
- Automatic .env file discovery up the directory tree
- Smart AWS credential detection and validation
- Verbose logging for configuration troubleshooting
- Fallback to AWS SDK default credential provider chain
- Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_SESSION_TOKEN`
- Priority order: explicit config → environment variables → AWS SDK defaults
- Uses `src/lib/env-finder.ts` for environment discovery
- Uses `src/lib/aws-config.ts` for AWS credential management

**CLI Tools Architecture:**
- Single Responsibility Principle - each tool does one thing
- Place CLI tools in `tools/` directory
- Use Commander.js for argument parsing
- Default to stdin input with flags for other capabilities
- Tools should be configurable via arguments and flags

**TypeScript Configuration:**
- Strict mode enabled with modern ES features
- Bundler module resolution
- No emit (Bun handles compilation)
- Import TypeScript extensions allowed

## Bun-Specific Guidelines

**Preferred APIs:**
- `Bun.serve()` for HTTP servers (not Express)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.redis` for Redis (not ioredis)
- `Bun.sql` for Postgres (not pg)
- Built-in WebSocket (not ws library)
- `Bun.$\`command\`` for shell commands (not execa)

**Frontend Integration:**
- HTML imports with `Bun.serve()`
- Direct imports of .tsx/.jsx files in HTML
- CSS bundling via `<link>` tags
- Hot module replacement available

## Project Principles

- Exploratory project - don't maintain legacy functionality
- Use `bun add`/`bun remove` for dependency management (never edit package.json directly)
- TypeScript for all code
- Commander.js for CLI tools
- CLI tools configurable via arguments/flags with stdin defaults