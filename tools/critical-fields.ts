#!/usr/bin/env bun

import { Command } from 'commander';
import { queryNeo4j, closeGlobalConnection } from './lib/neo4j-connection.js';

interface CriticalFieldsOptions {
  minConsumers: number;
  format: 'json' | 'csv' | 'summary';
  limit: number;
  sortBy: 'consumers' | 'producers' | 'ratio';
}

interface FieldImpactData {
  fieldName: string;
  producerCount: number;
  consumerCount: number;
  impactRatio: number; // consumers / producers
  totalConnections: number;
}

interface CriticalFieldsSummary {
  totalFields: number;
  highImpactFields: FieldImpactData[];
  averageConsumers: number;
  maxConsumers: number;
  distributionStats: {
    lowImpact: number; // < 10 consumers
    mediumImpact: number; // 10-100 consumers
    highImpact: number; // 100-1000 consumers
    criticalImpact: number; // > 1000 consumers
  };
}


async function analyzeCriticalFields(minConsumers: number, limit: number, sortBy: string): Promise<FieldImpactData[]> {
  const cypher = `
    MATCH (field:ElementalField)
    WITH field, 
         [(bf:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(field) | bf] as producers,
         [(bf:BusinessFunction)-[:HAS_INPUT_FIELD]->(field) | bf] as consumers
    WHERE size(producers) > 0 AND size(consumers) >= $minConsumers
    WITH field.name as fieldName,
         size(producers) as producerCount,
         size(consumers) as consumerCount
    RETURN fieldName, 
           producerCount, 
           consumerCount,
           toFloat(consumerCount) / toFloat(producerCount) as impactRatio,
           producerCount + consumerCount as totalConnections
    ORDER BY ${getSortClause(sortBy)} DESC
    LIMIT $limit
  `;

  const results = await queryNeo4j(cypher, { minConsumers, limit });
  return results.map(row => ({
    fieldName: row.fieldName,
    producerCount: row.producerCount,
    consumerCount: row.consumerCount,
    impactRatio: row.impactRatio || (row.consumerCount / Math.max(row.producerCount, 1)),
    totalConnections: row.totalConnections || (row.producerCount + row.consumerCount)
  }));
}

function getSortClause(sortBy: string): string {
  switch (sortBy) {
    case 'consumers':
      return 'consumerCount';
    case 'producers':
      return 'producerCount';
    case 'ratio':
      return 'impactRatio';
    default:
      return 'consumerCount';
  }
}

async function getFieldDistributionStats(): Promise<CriticalFieldsSummary['distributionStats']> {
  const cypher = `
    MATCH (field:ElementalField)
    WITH field, 
         [(bf:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(field) | bf] as producers,
         [(bf:BusinessFunction)-[:HAS_INPUT_FIELD]->(field) | bf] as consumers
    WHERE size(producers) > 0 AND size(consumers) > 0
    WITH size(consumers) as consumerCount
    RETURN 
      sum(CASE WHEN consumerCount < 10 THEN 1 ELSE 0 END) as lowImpact,
      sum(CASE WHEN consumerCount >= 10 AND consumerCount < 100 THEN 1 ELSE 0 END) as mediumImpact,
      sum(CASE WHEN consumerCount >= 100 AND consumerCount < 1000 THEN 1 ELSE 0 END) as highImpact,
      sum(CASE WHEN consumerCount >= 1000 THEN 1 ELSE 0 END) as criticalImpact
  `;

  const results = await queryNeo4j(cypher);
  if (results.length > 0) {
    return results[0];
  }
  
  // Return empty data if query fails
  return {
    lowImpact: 0,
    mediumImpact: 0,
    highImpact: 0,
    criticalImpact: 0
  };
}

function generateSummary(fields: FieldImpactData[], distributionStats: CriticalFieldsSummary['distributionStats']): CriticalFieldsSummary {
  const totalFields = fields.length;
  const averageConsumers = fields.reduce((sum, f) => sum + f.consumerCount, 0) / totalFields;
  const maxConsumers = Math.max(...fields.map(f => f.consumerCount));
  
  return {
    totalFields,
    highImpactFields: fields.slice(0, 10), // Top 10
    averageConsumers,
    maxConsumers,
    distributionStats
  };
}

function formatOutput(fields: FieldImpactData[], format: string, summary?: CriticalFieldsSummary): string {
  switch (format) {
    case 'json':
      return JSON.stringify({ fields, summary }, null, 2);
    
    case 'csv':
      const headers = 'Field Name,Producer Count,Consumer Count,Impact Ratio,Total Connections';
      const rows = fields.map(f => 
        `"${f.fieldName}",${f.producerCount},${f.consumerCount},${f.impactRatio.toFixed(2)},${f.totalConnections}`
      );
      return [headers, ...rows].join('\n');
    
    case 'summary':
      if (!summary) {
        throw new Error('Summary data required for summary format');
      }
      
      return `Critical Fields Analysis
========================

Total Analyzed Fields: ${summary.totalFields}
Average Consumer Count: ${summary.averageConsumers.toFixed(1)}
Maximum Consumer Count: ${summary.maxConsumers}

Impact Distribution:
  Low Impact (< 10 consumers): ${summary.distributionStats.lowImpact}
  Medium Impact (10-100 consumers): ${summary.distributionStats.mediumImpact}
  High Impact (100-1000 consumers): ${summary.distributionStats.highImpact}
  Critical Impact (> 1000 consumers): ${summary.distributionStats.criticalImpact}

Top Critical Fields:
${summary.highImpactFields.map((f, i) => 
  `${i + 1}. ${f.fieldName}
     Consumers: ${f.consumerCount}, Producers: ${f.producerCount}
     Impact Ratio: ${f.impactRatio.toFixed(2)} (consumers per producer)`
).join('\n')}

Risk Assessment:
${summary.highImpactFields.slice(0, 5).map(f => {
  let risk = 'LOW';
  if (f.consumerCount > 1000) risk = 'CRITICAL';
  else if (f.consumerCount > 500) risk = 'HIGH';
  else if (f.consumerCount > 100) risk = 'MEDIUM';
  
  return `  ${f.fieldName}: ${risk} RISK (${f.consumerCount} affected BusinessFunctions)`;
}).join('\n')}`;
    
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
    .name('critical-fields')
    .description('Identify fields with high impact potential based on consumer count')
    .version('1.0.0')
    .option('-m, --min-consumers <number>', 'Minimum number of consumers to include', '1')
    .option('-l, --limit <number>', 'Maximum number of results to return', '50')
    .option('-s, --sort-by <criteria>', 'Sort by: consumers, producers, ratio', 'consumers')
    .option('-f, --format <format>', 'Output format: json, csv, summary', 'summary')
    .parse();

  const options = program.opts() as CriticalFieldsOptions;
  
  // Validate options
  const minConsumers = parseInt(options.minConsumers);
  if (isNaN(minConsumers) || minConsumers < 0) {
    console.error('Error: min-consumers must be a non-negative integer');
    process.exit(1);
  }
  
  const limit = parseInt(options.limit);
  if (isNaN(limit) || limit < 1) {
    console.error('Error: limit must be a positive integer');
    process.exit(1);
  }
  
  if (!['consumers', 'producers', 'ratio'].includes(options.sortBy)) {
    console.error('Error: sort-by must be consumers, producers, or ratio');
    process.exit(1);
  }
  
  if (!['json', 'csv', 'summary'].includes(options.format)) {
    console.error('Error: format must be json, csv, or summary');
    process.exit(1);
  }
  
  try {
    console.error(`Analyzing critical fields with minimum ${minConsumers} consumers`);
    console.error(`Sorting by: ${options.sortBy}, Limit: ${limit}`);
    console.error('Connecting to Neo4j...');
    
    const fields = await analyzeCriticalFields(minConsumers, limit, options.sortBy);
    console.error(`Found ${fields.length} critical fields`);
    
    let summary: CriticalFieldsSummary | undefined;
    if (options.format === 'summary') {
      const distributionStats = await getFieldDistributionStats();
      summary = generateSummary(fields, distributionStats);
    }
    
    const output = formatOutput(fields, options.format, summary);
    console.log(output);
    
    await closeGlobalConnection();
    
  } catch (error) {
    console.error('Error during critical fields analysis:', error);
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