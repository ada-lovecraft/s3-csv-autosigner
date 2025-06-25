# Environment Setup


## Neo4j MCP
```shell
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
```

## Postgresql MCP

```shell
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
