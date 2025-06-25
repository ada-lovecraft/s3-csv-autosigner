#!/usr/bin/env bun

import { Command } from 'commander';
import { queryNeo4j, closeGlobalConnection } from './lib/neo4j-connection.js';

interface DependencyPathOptions {
  source: string;
  target: string;
  maxDepth: number;
  pathType: 'shortest' | 'all' | 'longest';
  format: 'json' | 'csv' | 'summary';
  limit: number;
}

interface DependencyPath {
  sourceBusinessFunction: string;
  targetBusinessFunction: string;
  pathLength: number;
  businessFunctions: string[];
  fields: string[];
  pathDescription: string;
}

interface PathAnalysisSummary {
  totalPaths: number;
  shortestPath: DependencyPath | null;
  longestPath: DependencyPath | null;
  averagePathLength: number;
  commonIntermediateFields: Array<{ field: string; frequency: number }>;
  criticalBusinessFunctions: Array<{ businessFunction: string; pathCount: number }>;
}


async function findDependencyPaths(source: string, target: string, maxDepth: number, pathType: string, limit: number): Promise<DependencyPath[]> {
  let cypher: string;
  
  switch (pathType) {
    case 'shortest':
      cypher = `
        MATCH (source:BusinessFunction {name: $source})
        MATCH (target:BusinessFunction {name: $target})
        MATCH path = shortestPath((source)-[*1..${maxDepth * 2}]-(target))
        WHERE all(r in relationships(path) WHERE type(r) IN ['HAS_OUTPUT_FIELD', 'HAS_INPUT_FIELD'])
        WITH path, 
             [n in nodes(path) WHERE n:BusinessFunction | n.name] as businessFunctions,
             [n in nodes(path) WHERE n:ElementalField | n.name] as fields,
             length(path) / 2 as pathLength
        RETURN businessFunctions[0] as sourceBusinessFunction,
               businessFunctions[-1] as targetBusinessFunction,
               pathLength,
               businessFunctions,
               fields
        LIMIT $limit
      `;
      break;
    
    case 'all':
      cypher = `
        MATCH (source:BusinessFunction {name: $source})
        MATCH (target:BusinessFunction {name: $target})
        MATCH path = (source)-[*1..${maxDepth * 2}]-(target)
        WHERE all(r in relationships(path) WHERE type(r) IN ['HAS_OUTPUT_FIELD', 'HAS_INPUT_FIELD'])
        AND length(path) <= ${maxDepth * 2}
        WITH path,
             [n in nodes(path) WHERE n:BusinessFunction | n.name] as businessFunctions,
             [n in nodes(path) WHERE n:ElementalField | n.name] as fields,
             length(path) / 2 as pathLength
        RETURN businessFunctions[0] as sourceBusinessFunction,
               businessFunctions[-1] as targetBusinessFunction,
               pathLength,
               businessFunctions,
               fields
        ORDER BY pathLength ASC
        LIMIT $limit
      `;
      break;
    
    case 'longest':
      cypher = `
        MATCH (source:BusinessFunction {name: $source})
        MATCH (target:BusinessFunction {name: $target})
        MATCH path = (source)-[*1..${maxDepth * 2}]-(target)
        WHERE all(r in relationships(path) WHERE type(r) IN ['HAS_OUTPUT_FIELD', 'HAS_INPUT_FIELD'])
        WITH path,
             [n in nodes(path) WHERE n:BusinessFunction | n.name] as businessFunctions,
             [n in nodes(path) WHERE n:ElementalField | n.name] as fields,
             length(path) / 2 as pathLength
        RETURN businessFunctions[0] as sourceBusinessFunction,
               businessFunctions[-1] as targetBusinessFunction,
               pathLength,
               businessFunctions,
               fields
        ORDER BY pathLength DESC
        LIMIT $limit
      `;
      break;
    
    default:
      throw new Error(`Unknown path type: ${pathType}`);
  }

  const results = await queryNeo4j(cypher, { source, target, limit });
  return results.map(row => ({
    sourceBusinessFunction: row.sourceBusinessFunction,
    targetBusinessFunction: row.targetBusinessFunction,
    pathLength: row.pathLength,
    businessFunctions: row.businessFunctions,
    fields: row.fields,
    pathDescription: generatePathDescription(row.businessFunctions, row.fields)
  }));
}

function generatePathDescription(businessFunctions: string[], fields: string[]): string {
  if (businessFunctions.length === 0) return '';
  
  const parts: string[] = [];
  for (let i = 0; i < businessFunctions.length - 1; i++) {
    parts.push(businessFunctions[i]);
    if (i < fields.length) {
      parts.push(`--[${fields[i]}]-->`);
    } else {
      parts.push('-->');
    }
  }
  parts.push(businessFunctions[businessFunctions.length - 1]);
  
  return parts.join(' ');
}

function generateSummary(paths: DependencyPath[]): PathAnalysisSummary {
  if (paths.length === 0) {
    return {
      totalPaths: 0,
      shortestPath: null,
      longestPath: null,
      averagePathLength: 0,
      commonIntermediateFields: [],
      criticalBusinessFunctions: []
    };
  }
  
  const shortestPath = paths.reduce((min, path) => 
    path.pathLength < min.pathLength ? path : min
  );
  
  const longestPath = paths.reduce((max, path) => 
    path.pathLength > max.pathLength ? path : max
  );
  
  const averagePathLength = paths.reduce((sum, path) => sum + path.pathLength, 0) / paths.length;
  
  // Count field frequency
  const fieldCounts: Record<string, number> = {};
  paths.forEach(path => {
    path.fields.forEach(field => {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    });
  });
  
  const commonIntermediateFields = Object.entries(fieldCounts)
    .map(([field, frequency]) => ({ field, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
  
  // Count BusinessFunction frequency (excluding source and target)
  const bfCounts: Record<string, number> = {};
  paths.forEach(path => {
    const intermediateBFs = path.businessFunctions.slice(1, -1); // Exclude first and last
    intermediateBFs.forEach(bf => {
      bfCounts[bf] = (bfCounts[bf] || 0) + 1;
    });
  });
  
  const criticalBusinessFunctions = Object.entries(bfCounts)
    .map(([businessFunction, pathCount]) => ({ businessFunction, pathCount }))
    .sort((a, b) => b.pathCount - a.pathCount)
    .slice(0, 10);
  
  return {
    totalPaths: paths.length,
    shortestPath,
    longestPath,
    averagePathLength,
    commonIntermediateFields,
    criticalBusinessFunctions
  };
}

function formatOutput(paths: DependencyPath[], format: string, summary?: PathAnalysisSummary): string {
  switch (format) {
    case 'json':
      return JSON.stringify({ paths, summary }, null, 2);
    
    case 'csv':
      const headers = 'Source BusinessFunction,Target BusinessFunction,Path Length,Path Description';
      const rows = paths.map(p => 
        `"${p.sourceBusinessFunction}","${p.targetBusinessFunction}",${p.pathLength},"${p.pathDescription}"`
      );
      return [headers, ...rows].join('\n');
    
    case 'summary':
      if (!summary) {
        throw new Error('Summary data required for summary format');
      }
      
      return `Dependency Path Analysis
========================

Total Paths Found: ${summary.totalPaths}
${summary.shortestPath ? `Shortest Path Length: ${summary.shortestPath.pathLength}` : 'No paths found'}
${summary.longestPath ? `Longest Path Length: ${summary.longestPath.pathLength}` : ''}
Average Path Length: ${summary.averagePathLength.toFixed(1)}

${summary.shortestPath ? `Shortest Path:
${summary.shortestPath.pathDescription}` : ''}

${summary.longestPath && summary.longestPath !== summary.shortestPath ? `
Longest Path:
${summary.longestPath.pathDescription}` : ''}

Most Common Intermediate Fields:
${summary.commonIntermediateFields.map(f => 
  `  ${f.field} (appears in ${f.frequency} paths)`
).join('\n')}

Critical Intermediate BusinessFunctions:
${summary.criticalBusinessFunctions.map(bf => 
  `  ${bf.businessFunction} (appears in ${bf.pathCount} paths)`
).join('\n')}

All Paths:
${paths.slice(0, 20).map((p, i) => 
  `${i + 1}. Length ${p.pathLength}: ${p.pathDescription}`
).join('\n')}${paths.length > 20 ? `\n... and ${paths.length - 20} more paths` : ''}`;
    
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

async function main() {
  const program = new Command();
  
  // Ensure clean shutdown
  process.on('exit', async () => {
    await closeGlobalConnection();
  });
  
  program
    .name('dependency-path')
    .description('Trace dependency paths between two BusinessFunctions')
    .version('1.0.0')
    .requiredOption('-s, --source <name>', 'Source BusinessFunction name')
    .requiredOption('-t, --target <name>', 'Target BusinessFunction name')
    .option('-d, --max-depth <number>', 'Maximum path depth to search', '5')
    .option('-p, --path-type <type>', 'Path type: shortest, all, longest', 'all')
    .option('-l, --limit <number>', 'Maximum number of paths to return', '100')
    .option('-f, --format <format>', 'Output format: json, csv, summary', 'summary')
    .parse();

  const options = program.opts() as DependencyPathOptions;
  
  // Validate options
  const maxDepth = parseInt(options.maxDepth);
  if (isNaN(maxDepth) || maxDepth < 1) {
    console.error('Error: max-depth must be a positive integer');
    process.exit(1);
  }
  
  const limit = parseInt(options.limit);
  if (isNaN(limit) || limit < 1) {
    console.error('Error: limit must be a positive integer');
    process.exit(1);
  }
  
  if (!['shortest', 'all', 'longest'].includes(options.pathType)) {
    console.error('Error: path-type must be shortest, all, or longest');
    process.exit(1);
  }
  
  if (!['json', 'csv', 'summary'].includes(options.format)) {
    console.error('Error: format must be json, csv, or summary');
    process.exit(1);
  }
  
  if (options.source === options.target) {
    console.error('Error: source and target BusinessFunctions must be different');
    process.exit(1);
  }
  
  try {
    console.error(`Tracing paths from "${options.source}" to "${options.target}"`);
    console.error(`Path type: ${options.pathType}, Max depth: ${maxDepth}, Limit: ${limit}`);
    console.error('Connecting to Neo4j...');
    
    const paths = await findDependencyPaths(
      options.source, 
      options.target, 
      maxDepth, 
      options.pathType, 
      limit
    );
    
    console.error(`Found ${paths.length} dependency paths`);
    
    let summary: PathAnalysisSummary | undefined;
    if (options.format === 'summary') {
      summary = generateSummary(paths);
    }
    
    const output = formatOutput(paths, options.format, summary);
    console.log(output);
    
    await closeGlobalConnection();
    
  } catch (error) {
    console.error('Error during dependency path analysis:', error);
    await closeGlobalConnection();
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}