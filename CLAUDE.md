# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an agentic data exploration system for analyzing legacy COBOL applications. The system decomposes monolithic COBOL programs into atomic BusinessFunction units, enabling precise field-level dependency analysis and modernization planning.

## Project Principles

- This is an exploratory project. Never try to maintain "legacy" functionality.
- Create small cli tools that satisfy the Single Responsibility Paradigm. place these tools in the @tools/ directory
- All code should be written in typescript.
- This project uses the `bun` runtime, and as such, a build step is never required.
- Use the `commander` node package to streamline cli tool creation
- Cli tools should be configurable via arguments and flags
- Cli tools should default to stdin for input but should provide flags and arguments to allow for other capabilities
- Don't ever edit the package.json file directly when adding or removing dependencies. always use the `bun add` or `bun remove` commands

## Architecture

### Dual Database Design

The system uses two complementary databases:

**Neo4j Graph Database** (`bolt://localhost:7687`):
- Stores entity relationships and enables graph traversal queries
- Models data flow hierarchy: CompilationUnit → Module → DataFile → Record → Field
- Tracks BusinessFunction I/O relationships for field lineage analysis
- Current data: 1 CompilationUnit, 36 Modules, 6,526 BusinessFunctions, 7,056 Fields

**PostgreSQL Database** (`postgresql://cobol:cobolanalysis@localhost:5432/cobolanalysis`):
- `entitydescriptions`: JSONB metadata for all entities (959 records)
- `sourcefiles`: Original COBOL source code (103 files)
- `virtualfiles`: Assembled BusinessFunction code (6,526 virtual files)
- `substitutions`: Code substitution tracking for virtual file assembly

### Core Concepts

**BusinessFunction**: Atomic business logic units that transform input fields to exactly one output field. Each has:
- Naming pattern: `[INPUT_FIELD_1,INPUT_FIELD_2] -> OUTPUT_GROUP:OUTPUT_FIELD`
- Virtual COBOL code assembled from scattered source locations
- Complete field dependency tracking

**Field Hierarchy**: Recursive structure where GroupFields contain other Fields, terminating in ElementalFields (primitives).

## MCP Server Configuration

The system requires two MCP servers to be configured:

```bash
# Neo4j MCP
claude mcp add-json cobol-neo4j '{
  "command": "uvx",
  "args": [ "mcp-neo4j-cypher@0.2.3", "--transport", "stdio"  ],
  "env": {
    "NEO4J_URI": "bolt://localhost:7687",
    "NEO4J_USERNAME": "neo4j",
    "NEO4J_PASSWORD": "cobolanalysis",
    "NEO4J_DATABASE": "neo4j"
  }
}'

# PostgreSQL MCP
claude mcp add-json cobol-postgres '{
  "command": "uvx",
  "args": [
    "postgres-mcp",
    "--access-mode=unrestricted"
  ],
  "env": {
    "DATABASE_URI": "postgresql://cobol:cobolanalysis@localhost:5432/cobolanalysis"
  }
}'
```

## Common Query Patterns

### Neo4j Graph Queries

**Field Dependency Analysis**:
```cypher
// Forward impact: find all fields affected by changing SOURCE-FIELD
MATCH (source:ElementalField {name: "SOURCE-FIELD"})
MATCH path = (source)-[:HAS_INPUT_FIELD*1..10]-(bf:BusinessFunction)-[:HAS_OUTPUT_FIELD*1..10]-(affected:ElementalField)
RETURN DISTINCT affected.name, length(path) as impactDepth
```

**Backward Dependency Tracing**:
```cypher
// Find all fields that influence TARGET-FIELD
MATCH (target:ElementalField {name: "TARGET-FIELD"})
MATCH path = (source:ElementalField)-[:HAS_INPUT_FIELD*1..10]-(bf:BusinessFunction)-[:HAS_OUTPUT_FIELD*1..10]-(target)
RETURN DISTINCT source.name, length(path) as dependencyDepth
```

**Complete DataFile Structure**:
```cypher
MATCH (dataFile:DataFile)
OPTIONAL MATCH (dataFile)-[:HAS_RECORD]->(record:Record)
OPTIONAL MATCH (record)-[:HAS_FIELD]->(groupField:GroupField)
OPTIONAL MATCH (groupField)-[:HAS_FIELD]->(groupedElemental:ElementalField)
// ... (see ai_docs/slim-neo4j-schema.md for complete pattern)
```

### PostgreSQL Queries

**Entity Metadata**:
```sql
-- Get entity descriptions by type
SELECT "entityType", COUNT(*) as count
FROM entitydescriptions
GROUP BY "entityType"
ORDER BY count DESC;
```

**Virtual File Content**:
```sql
-- Get BusinessFunction virtual code
SELECT vf.content
FROM virtualfiles vf
WHERE vf.businessfunctionid = 'FieldLevelBusinessFunction_123';
```

## Key Constraints

- **Single Output Principle**: Every BusinessFunction produces exactly one output field
- **Complete Influence**: All input fields must affect the output value
- **Field Hierarchy**: Use base classes `(f:Field)` and `(bf:BusinessFunction)` for queries
- **Recursive Relationships**: Fields can contain other Fields via `HAS_FIELD` relationships

## Documentation Structure

- `ai_docs/02-businessfunction-architecture.md`: Comprehensive technical architecture
- `ai_docs/slim-neo4j-schema.md`: Neo4j schema reference and query patterns
- `claude-setup.md`: MCP server configuration

## Analysis Capabilities

The system enables:
- **Impact Analysis**: Trace downstream effects of field changes
- **Dependency Mapping**: Identify all factors influencing a field
- **Business Rule Documentation**: Extract business logic from scattered COBOL code
- **Modernization Planning**: Identify microservice boundaries and API contracts
- **Compliance Auditing**: Complete field lineage for regulatory requirements
