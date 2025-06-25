# Environment Setup

## Claude

## Custom Commands

```
$ mkdir -p .claude/commands/ && cd $1
$ touch context-prime.md
$ zed context-prime.md
```

```markdown
READ README.md, CLAUDE.md, then run `eza -T --git-ignore` and `git ls-files` to understand the context of the project.

use the schema tools from any database related mcp server (postgres, neo4j, etc)

Be sure to also READ: .cursor/rules/**,  $ARGUMENTS and nothing else.
```


### MCP Servers

**mcp-neo4j-cypher**
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

**postgres-mcp:**

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
