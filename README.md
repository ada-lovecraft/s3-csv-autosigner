# Agentic Data Exploration

An agentic data exploration system for analyzing legacy COBOL applications. This system decomposes monolithic COBOL programs into atomic BusinessFunction units, enabling precise field-level dependency analysis and modernization planning.

## Prerequisites

### Install Bun Runtime

This project uses [Bun](https://bun.sh), a fast all-in-one JavaScript runtime:

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

**Alternative installation methods:**
- **Homebrew:** `brew install bun`
- **npm:** `npm install -g bun`
- **Docker:** `docker pull oven/bun`

Verify installation:
```bash
bun --version
```

### Neo4j Database Setup

The CLI tools require a Neo4j database with COBOL analysis data:

- **Neo4j URI:** `bolt://localhost:7687` (default)
- **Credentials:** `neo4j` / `cobolanalysis` (default)
- **Database:** `neo4j` (default)

Configure via environment variables:
```bash
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="cobolanalysis"
export NEO4J_DATABASE="neo4j"
```

## Installation

Install project dependencies:

```bash
bun install
```

## CLI Tools

The project includes four powerful CLI tools for COBOL system analysis:

### 1. Impact Analysis Tool
Analyze how changing a BusinessFunction's output affects other BusinessFunctions:

```bash
# Analyze impact of a specific output field
bun run tools/impact-analysis.ts -o "FRDM-BLANK-LOSS-CODE" -d 3 -f summary

# Analyze impact of a BusinessFunction by name
bun run tools/impact-analysis.ts -b "BUSINESS-FUNCTION-NAME" -d 2 -f json

# Read BusinessFunction name from stdin
echo "FRDM-BLANK-LOSS-CODE" | bun run tools/impact-analysis.ts --stdin -f csv
```

**Options:**
- `-o, --output-field <field>`: Output field name to analyze
- `-b, --business-function <name>`: BusinessFunction name to analyze  
- `-d, --depth <number>`: Maximum depth for multi-hop analysis (default: 3)
- `-f, --format <format>`: Output format: json, csv, summary (default: summary)
- `--stdin`: Read input from stdin

### 2. Critical Fields Analysis
Identify fields with high impact potential based on consumer count:

```bash
# Find fields with 1000+ consumers
bun run tools/critical-fields.ts -m 1000 -l 10 -f summary

# Sort by impact ratio (consumers per producer)
bun run tools/critical-fields.ts -m 100 -s ratio -f json

# Export to CSV for spreadsheet analysis
bun run tools/critical-fields.ts -m 50 -l 100 -f csv > critical-fields.csv
```

**Options:**
- `-m, --min-consumers <number>`: Minimum consumers to include (default: 1)
- `-l, --limit <number>`: Maximum results to return (default: 50)
- `-s, --sort-by <criteria>`: Sort by consumers, producers, or ratio (default: consumers)
- `-f, --format <format>`: Output format: json, csv, summary (default: summary)

### 3. Dependency Path Tracing
Trace dependency paths between BusinessFunctions:

```bash
# Find shortest path between two BusinessFunctions
bun run tools/dependency-path.ts -s "SOURCE-BF" -t "TARGET-BF" -p shortest

# Find all paths with maximum depth
bun run tools/dependency-path.ts -s "SOURCE-BF" -t "TARGET-BF" -p all -d 5

# Export path analysis to JSON
bun run tools/dependency-path.ts -s "SOURCE-BF" -t "TARGET-BF" -f json > paths.json
```

**Options:**
- `-s, --source <name>`: Source BusinessFunction name (required)
- `-t, --target <name>`: Target BusinessFunction name (required)
- `-d, --max-depth <number>`: Maximum path depth (default: 5)
- `-p, --path-type <type>`: Path type: shortest, all, longest (default: all)
- `-l, --limit <number>`: Maximum paths to return (default: 100)
- `-f, --format <format>`: Output format: json, csv, summary (default: summary)

### 4. System Impact Summary
Generate comprehensive system-wide impact analysis reports:

```bash
# Generate markdown report
bun run tools/impact-summary.ts -f markdown > system-analysis.md

# Generate text report for terminal viewing
bun run tools/impact-summary.ts -f text

# Generate JSON for programmatic analysis
bun run tools/impact-summary.ts -f json > system-data.json
```

**Options:**
- `-f, --format <format>`: Output format: json, markdown, text (default: markdown)
- `--no-distribution`: Exclude field distribution analysis
- `--no-top-fields`: Exclude top fields analysis  
- `--no-connectivity`: Exclude connectivity analysis
- `-t, --top-count <number>`: Number of top items to include (default: 10)

## Example Usage Scenarios

### Risk Assessment Before Changes
```bash
# 1. Check if field is high-risk
bun run tools/critical-fields.ts -m 1000 | grep "FRDM-BLANK-LOSS-CODE"

# 2. Analyze complete impact
bun run tools/impact-analysis.ts -o "FRDM-BLANK-LOSS-CODE" -d 3 -f summary

# 3. Generate change impact report
bun run tools/impact-summary.ts -f markdown > impact-report.md
```

### Modernization Planning
```bash
# Find critical system integration points
bun run tools/critical-fields.ts -s ratio -l 20 -f summary

# Trace dependencies between modules
bun run tools/dependency-path.ts -s "MODULE-A-BF" -t "MODULE-B-BF" -p all

# Generate system overview for architects
bun run tools/impact-summary.ts -f markdown > modernization-plan.md
```

### Compliance Auditing
```bash
# Complete field lineage analysis
bun run tools/impact-analysis.ts -o "SENSITIVE-FIELD" -d 5 -f csv > lineage.csv

# System fragility assessment
bun run tools/impact-summary.ts -f json > compliance-data.json
```

## Architecture

The system uses a **dual database design**:

- **Neo4j Graph Database** (`bolt://localhost:7687`): Stores entity relationships and enables graph traversal queries
- **PostgreSQL Database** (`postgresql://cobol:cobolanalysis@localhost:5432/cobolanalysis`): JSONB metadata, source code, and virtual files

### Core Concepts

- **BusinessFunction**: Atomic business logic units that transform input fields to exactly one output field
- **Field Hierarchy**: Recursive structure where GroupFields contain other Fields, terminating in ElementalFields
- **Impact Analysis**: Trace downstream effects of field changes through dependency chains
- **Risk Assessment**: Quantify change impact based on consumer counts and dependency depth

## Data Model

Current system contains:
- **6,526** BusinessFunctions
- **7,056** Fields  
- **281,157** Relationships
- **1** fully connected component (no isolated functions)

## Contributing

This project uses TypeScript with Bun runtime. Key principles:

- Create small CLI tools following Single Responsibility Principle
- Place tools in `tools/` directory
- Use `commander` package for CLI interfaces
- Default to stdin for input with flag alternatives
- Use `bun add`/`bun remove` for dependency management (never edit package.json directly)

## Development

To run the main application:

```bash
bun run index.ts
```

To create a new CLI tool:

```bash
# Copy existing tool as template
cp tools/impact-analysis.ts tools/new-tool.ts

# Make executable
chmod +x tools/new-tool.ts

# Test
bun run tools/new-tool.ts --help
```

## License

This project was created using `bun init` in bun v1.2.15.