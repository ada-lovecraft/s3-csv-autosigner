# Publishing Setup

This repository is configured for automatic publishing to NPM when changes are pushed to the main branch.

## Setup Instructions

### 1. Create NPM Account and Package

1. **Sign up for NPM account**: [https://www.npmjs.com/signup](https://www.npmjs.com/signup)
2. **Verify your email** and enable 2FA (required for publishing)
3. **Create access token**:
   - Go to [https://www.npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens)
   - Click "Generate New Token" → "Granular Access Token" 
   - **Token name**: `s3-csv-autosigner-github-actions`
   - **Expiration**: 1 year (or your preference)
   - **Packages and scopes**: Select the package `s3-csv-autosigner` 
   - **Permissions**: `Read and write`
   - Copy the token (you won't see it again!)

### 2. Configure GitHub Repository Secrets

1. **Go to your GitHub repository**
2. **Click Settings → Secrets and variables → Actions**
3. **Add repository secret**:
   - **Name**: `NPM_TOKEN`
   - **Value**: The token you copied from NPM
   - Click "Add secret"

### 3. First Publish (Manual)

For the first publish, you might want to do it manually to ensure everything works:

```bash
# Build the package
bun run build

# Login to NPM (one-time setup)
npm login

# Publish manually for the first time
npm publish

# Verify it worked
npm view s3-csv-autosigner
```

## How Automatic Publishing Works

### Trigger Conditions
- **Push to main branch**: Triggers build and potential publish
- **Manual trigger**: Can be triggered manually via GitHub Actions UI

### Publishing Logic
1. **Build Check**: Ensures the package builds successfully
2. **Version Check**: Only publishes if the version in `package.json` hasn't been published yet
3. **Test Execution**: Runs any available tests (currently optional)
4. **NPM Publish**: Publishes to NPM registry
5. **GitHub Release**: Creates a GitHub release with the version tag

### Version Management
- **Bump version** in `package.json` to trigger a new publish
- **Semantic versioning** recommended:
  - `1.0.1` → `1.0.2` (patch: bug fixes)
  - `1.0.1` → `1.1.0` (minor: new features)
  - `1.0.1` → `2.0.0` (major: breaking changes)

## Workflow Files

### `.github/workflows/publish.yml`
- **Purpose**: Automatic publishing to NPM on main branch pushes
- **Features**: Version checking, NPM publishing, GitHub releases
- **Runs on**: Ubuntu latest with Bun runtime

### `.github/workflows/ci.yml`
- **Purpose**: Continuous integration testing
- **Features**: Multi-Node.js version testing, build verification, package size checks
- **Runs on**: Pull requests and pushes to main/develop

## Troubleshooting

### "Package already exists" Error
- **Problem**: Version in `package.json` already published
- **Solution**: Bump the version number and push again

### "Authentication Required" Error
- **Problem**: NPM_TOKEN secret not configured or expired
- **Solution**: 
  1. Generate new NPM token with correct permissions
  2. Update the `NPM_TOKEN` secret in GitHub repository settings

### "Build Failed" Error
- **Problem**: TypeScript or build errors
- **Solution**: 
  1. Run `bun run build` locally to see the error
  2. Fix the issue and push again

### "Tests Failed" Error
- **Problem**: Test failures blocking publish
- **Solution**: 
  1. Run `bun test` locally to debug
  2. Fix failing tests or mark as non-blocking temporarily

## Manual Override

If you need to publish manually (bypass automation):

```bash
# Build locally
bun run build

# Publish with specific tag
npm publish --tag beta

# Or force publish (use carefully)
npm publish --force
```

## Security Notes

- **NPM_TOKEN**: Never commit this token to the repository
- **2FA Required**: NPM requires 2FA for publishing packages
- **Token Scope**: Use granular tokens limited to specific packages
- **Token Rotation**: Rotate tokens periodically for security