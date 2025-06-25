#!/usr/bin/env bun

import { Command } from 'commander';
import { queryNeo4j, closeGlobalConnection } from './lib/neo4j-connection.js';

interface ImpactAnalysisOptions {
  businessFunction?: string;
  outputField?: string;
  depth: number;
  format: 'json' | 'csv' | 'summary';
  stdin?: boolean;
}

interface ImpactResult {
  sourceBusinessFunction: string;
  sourceOutputField: string;
  affectedBusinessFunction: string;
  affectedOutputField: string;
  impactDepth: number;
  pathFields: string[];
}

interface ImpactSummary {
  totalAffectedBusinessFunctions: number;
  maxDepth: number;
  criticalPaths: ImpactResult[];
  fieldImpactCounts: Record<string, number>;
}


async function analyzeDirectImpact(identifier: string, isOutputField: boolean): Promise<ImpactResult[]> {
  const cypher = isOutputField
    ? `
      MATCH (source_bf:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(output_field:ElementalField {name: $identifier})
      MATCH (output_field)<-[:HAS_INPUT_FIELD]-(affected_bf:BusinessFunction)
      RETURN source_bf.name as sourceBusinessFunction,
             source_bf.outputName as sourceOutputField,
             affected_bf.name as affectedBusinessFunction,
             affected_bf.outputName as affectedOutputField,
             1 as impactDepth,
             [output_field.name] as pathFields
    `
    : `
      MATCH (source_bf:BusinessFunction {name: $identifier})
      MATCH (source_bf)-[:HAS_OUTPUT_FIELD]->(output_field:ElementalField)<-[:HAS_INPUT_FIELD]-(affected_bf:BusinessFunction)
      RETURN source_bf.name as sourceBusinessFunction,
             source_bf.outputName as sourceOutputField,
             affected_bf.name as affectedBusinessFunction,
             affected_bf.outputName as affectedOutputField,
             1 as impactDepth,
             [output_field.name] as pathFields
    `;

  const results = await queryNeo4j(cypher, { identifier });
  return results.map(row => ({
    sourceBusinessFunction: row.sourceBusinessFunction,
    sourceOutputField: row.sourceOutputField,
    affectedBusinessFunction: row.affectedBusinessFunction,
    affectedOutputField: row.affectedOutputField,
    impactDepth: row.impactDepth,
    pathFields: row.pathFields
  }));
}

async function analyzeMultiHopImpact(identifier: string, isOutputField: boolean, maxDepth: number): Promise<ImpactResult[]> {
  const results: ImpactResult[] = [];
  
  for (let depth = 1; depth <= maxDepth; depth++) {
    const cypher = isOutputField
      ? `
        MATCH path = (source_bf:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(start_field:ElementalField {name: $identifier})
        ${Array.from({ length: depth }, (_, i) => 
          `MATCH (${i === 0 ? 'start_field' : `field${i}`})<-[:HAS_INPUT_FIELD]-(bf${i + 1}:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(field${i + 1}:ElementalField)`
        ).join('\n        ')}
        MATCH (field${depth})<-[:HAS_INPUT_FIELD]-(final_bf:BusinessFunction)
        RETURN source_bf.name as sourceBusinessFunction,
               source_bf.outputName as sourceOutputField,
               final_bf.name as affectedBusinessFunction,
               final_bf.outputName as affectedOutputField,
               ${depth + 1} as impactDepth,
               [start_field.name] + ${Array.from({ length: depth }, (_, i) => `field${i + 1}.name`).join(' + ')} as pathFields
        LIMIT 100
      `
      : `
        MATCH (source_bf:BusinessFunction {name: $identifier})
        MATCH path = (source_bf)-[:HAS_OUTPUT_FIELD]->(start_field:ElementalField)
        ${Array.from({ length: depth }, (_, i) => 
          `MATCH (${i === 0 ? 'start_field' : `field${i}`})<-[:HAS_INPUT_FIELD]-(bf${i + 1}:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(field${i + 1}:ElementalField)`
        ).join('\n        ')}
        MATCH (field${depth})<-[:HAS_INPUT_FIELD]-(final_bf:BusinessFunction)
        RETURN source_bf.name as sourceBusinessFunction,
               source_bf.outputName as sourceOutputField,
               final_bf.name as affectedBusinessFunction,
               final_bf.outputName as affectedOutputField,
               ${depth + 1} as impactDepth,
               [start_field.name] + ${Array.from({ length: depth }, (_, i) => `field${i + 1}.name`).join(' + ')} as pathFields
        LIMIT 100
      `;

    const depthResults = await queryNeo4j(cypher, { identifier });
    results.push(...depthResults.map(row => ({
      sourceBusinessFunction: row.sourceBusinessFunction,
      sourceOutputField: row.sourceOutputField,
      affectedBusinessFunction: row.affectedBusinessFunction,
      affectedOutputField: row.affectedOutputField,
      impactDepth: row.impactDepth,
      pathFields: row.pathFields
    })));
  }
  
  return results;
}

function generateSummary(results: ImpactResult[]): ImpactSummary {
  const uniqueBusinessFunctions = new Set(results.map(r => r.affectedBusinessFunction));
  const maxDepth = Math.max(...results.map(r => r.impactDepth), 0);
  
  const fieldImpactCounts: Record<string, number> = {};
  results.forEach(result => {
    result.pathFields.forEach(field => {
      fieldImpactCounts[field] = (fieldImpactCounts[field] || 0) + 1;
    });
  });
  
  const criticalPaths = results
    .filter(r => r.impactDepth === maxDepth)
    .slice(0, 10); // Top 10 critical paths

  return {
    totalAffectedBusinessFunctions: uniqueBusinessFunctions.size,
    maxDepth,
    criticalPaths,
    fieldImpactCounts
  };
}

function formatOutput(results: ImpactResult[], format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    
    case 'csv':
      const headers = 'Source BusinessFunction,Source Output Field,Affected BusinessFunction,Affected Output Field,Impact Depth,Path Fields';
      const rows = results.map(r => 
        `"${r.sourceBusinessFunction}","${r.sourceOutputField}","${r.affectedBusinessFunction}","${r.affectedOutputField}",${r.impactDepth},"${r.pathFields.join(' -> ')}"`
      );
      return [headers, ...rows].join('\n');
    
    case 'summary':
      const summary = generateSummary(results);
      return `Impact Analysis Summary
========================

Total Affected BusinessFunctions: ${summary.totalAffectedBusinessFunctions}
Maximum Impact Depth: ${summary.maxDepth}

Top Field Impact Counts:
${Object.entries(summary.fieldImpactCounts)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([field, count]) => `  ${field}: ${count} impacts`)
  .join('\n')}

Critical Paths (Max Depth):
${summary.criticalPaths.map(p => 
  `  ${p.sourceOutputField} -> ${p.pathFields.join(' -> ')} -> ${p.affectedOutputField}`
).join('\n')}`;
    
    default:
      throw new Error(`Unknown format: ${format}`);
  }
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

async function main() {
  const program = new Command();
  
  // Ensure clean shutdown
  process.on('exit', async () => {
    await closeGlobalConnection();
  });
  
  program
    .name('impact-analysis')
    .description('Analyze the impact of changing a BusinessFunction output on other BusinessFunctions')
    .version('1.0.0')
    .option('-b, --business-function <name>', 'BusinessFunction name to analyze')
    .option('-o, --output-field <field>', 'Output field name to analyze')
    .option('-d, --depth <number>', 'Maximum depth for multi-hop analysis', '3')
    .option('-f, --format <format>', 'Output format: json, csv, summary', 'summary')
    .option('--stdin', 'Read BusinessFunction name or output field from stdin')
    .parse();

  const options = program.opts() as ImpactAnalysisOptions;
  
  // Validate input
  let identifier: string;
  let isOutputField: boolean;
  
  if (options.stdin) {
    try {
      identifier = await readFromStdin();
      if (!identifier) {
        console.error('Error: No input received from stdin');
        process.exit(1);
      }
      // Assume it's an output field if it doesn't contain the BusinessFunction naming pattern
      isOutputField = !identifier.includes('->');
    } catch (error) {
      console.error('Error reading from stdin:', error);
      process.exit(1);
    }
  } else if (options.businessFunction) {
    identifier = options.businessFunction;
    isOutputField = false;
  } else if (options.outputField) {
    identifier = options.outputField;
    isOutputField = true;
  } else {
    console.error('Error: Either --business-function, --output-field, or --stdin must be provided');
    process.exit(1);
  }
  
  const depth = parseInt(options.depth);
  if (isNaN(depth) || depth < 1) {
    console.error('Error: Depth must be a positive integer');
    process.exit(1);
  }
  
  if (!['json', 'csv', 'summary'].includes(options.format)) {
    console.error('Error: Format must be json, csv, or summary');
    process.exit(1);
  }
  
  try {
    console.error(`Analyzing impact of ${isOutputField ? 'output field' : 'BusinessFunction'}: ${identifier}`);
    console.error(`Maximum depth: ${depth}`);
    console.error('Connecting to Neo4j...');
    
    let results: ImpactResult[];
    
    if (depth === 1) {
      results = await analyzeDirectImpact(identifier, isOutputField);
    } else {
      results = await analyzeMultiHopImpact(identifier, isOutputField, depth);
    }
    
    console.error(`Found ${results.length} impact relationships`);
    
    const output = formatOutput(results, options.format);
    console.log(output);
    
    await closeGlobalConnection();
    
  } catch (error) {
    console.error('Error during impact analysis:', error);
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