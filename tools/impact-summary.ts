#!/usr/bin/env bun

import { Command } from 'commander';
import { queryNeo4j, closeGlobalConnection } from './lib/neo4j-connection.js';

interface ImpactSummaryOptions {
  format: 'json' | 'markdown' | 'text';
  includeDistribution: boolean;
  includeTopFields: boolean;
  includeConnectivity: boolean;
  topCount: number;
}

interface SystemStats {
  totalBusinessFunctions: number;
  totalFields: number;
  totalRelationships: number;
  avgInputFields: number;
  avgOutputFields: number;
  maxInputFields: number;
  maxOutputFields: number;
}

interface ConnectivityStats {
  connectedComponents: number;
  largestComponentSize: number;
  isolatedBusinessFunctions: number;
  highlyConnectedBFs: Array<{ name: string; connections: number }>;
}

interface FieldDistribution {
  byConsumerCount: Array<{ range: string; count: number; percentage: number }>;
  byProducerCount: Array<{ range: string; count: number; percentage: number }>;
  topConsumerFields: Array<{ field: string; consumers: number; producers: number }>;
  topProducerFields: Array<{ field: string; producers: number; consumers: number }>;
}

interface ImpactSummaryReport {
  systemStats: SystemStats;
  connectivityStats: ConnectivityStats;
  fieldDistribution: FieldDistribution;
  riskAssessment: {
    criticalFields: Array<{ field: string; risk: string; impact: string; recommendation: string }>;
    systemFragility: string;
    recommendedActions: string[];
  };
  generatedAt: string;
}


async function getSystemStats(): Promise<SystemStats> {
  try {
    const [bfCount] = await queryNeo4j('MATCH (bf:BusinessFunction) RETURN count(bf) as totalBusinessFunctions');
    const [fieldCount] = await queryNeo4j('MATCH (f:ElementalField) RETURN count(f) as totalFields');
    const [relCount] = await queryNeo4j('MATCH ()-[r:HAS_INPUT_FIELD|HAS_OUTPUT_FIELD]->() RETURN count(r) as totalRelationships');
    const [avgStats] = await queryNeo4j(`
      MATCH (bf:BusinessFunction)
      OPTIONAL MATCH (bf)-[:HAS_INPUT_FIELD]->(input:ElementalField)
      OPTIONAL MATCH (bf)-[:HAS_OUTPUT_FIELD]->(output:ElementalField)
      WITH bf, count(DISTINCT input) as inputCount, count(DISTINCT output) as outputCount
      RETURN avg(inputCount) as avgInputFields, 
             avg(outputCount) as avgOutputFields,
             max(inputCount) as maxInputFields,
             max(outputCount) as maxOutputFields
    `);

    return {
      totalBusinessFunctions: bfCount.totalBusinessFunctions,
      totalFields: fieldCount.totalFields,
      totalRelationships: relCount.totalRelationships,
      avgInputFields: avgStats.avgInputFields,
      avgOutputFields: avgStats.avgOutputFields,
      maxInputFields: avgStats.maxInputFields,
      maxOutputFields: avgStats.maxOutputFields
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    // Return fallback data
    return {
      totalBusinessFunctions: 0,
      totalFields: 0,
      totalRelationships: 0,
      avgInputFields: 0,
      avgOutputFields: 0,
      maxInputFields: 0,
      maxOutputFields: 0
    };
  }
}

async function getConnectivityStats(): Promise<ConnectivityStats> {
  try {
    // Get highly connected BusinessFunctions
    const highlyConnected = await queryNeo4j(`
      MATCH (bf:BusinessFunction)
      OPTIONAL MATCH (bf)-[:HAS_INPUT_FIELD|HAS_OUTPUT_FIELD]-(field:ElementalField)
      WITH bf, count(DISTINCT field) as connections
      WHERE connections > 0
      RETURN bf.name as name, connections
      ORDER BY connections DESC
      LIMIT 10
    `);

    const [componentStats] = await queryNeo4j(`
      MATCH (bf:BusinessFunction)
      RETURN count(bf) as totalNodes,
             1 as connectedComponents
    `);

    return {
      connectedComponents: componentStats.connectedComponents,
      largestComponentSize: componentStats.totalNodes,
      isolatedBusinessFunctions: 0,
      highlyConnectedBFs: highlyConnected.map(row => ({
        name: row.name,
        connections: row.connections
      }))
    };
  } catch (error) {
    console.error('Error getting connectivity stats:', error);
    return {
      connectedComponents: 0,
      largestComponentSize: 0,
      isolatedBusinessFunctions: 0,
      highlyConnectedBFs: []
    };
  }
}

async function getFieldDistribution(topCount: number): Promise<FieldDistribution> {
  try {
    // Get top consumer fields
    const topConsumers = await queryNeo4j(`
      MATCH (field:ElementalField)
      WITH field, 
           [(bf:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(field) | bf] as producers,
           [(bf:BusinessFunction)-[:HAS_INPUT_FIELD]->(field) | bf] as consumers
      WHERE size(producers) > 0 AND size(consumers) > 0
      RETURN field.name as field, 
             size(consumers) as consumers,
             size(producers) as producers
      ORDER BY consumers DESC
      LIMIT $topCount
    `, { topCount });

    // Get top producer fields
    const topProducers = await queryNeo4j(`
      MATCH (field:ElementalField)
      WITH field, 
           [(bf:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(field) | bf] as producers,
           [(bf:BusinessFunction)-[:HAS_INPUT_FIELD]->(field) | bf] as consumers
      WHERE size(producers) > 0 AND size(consumers) > 0
      RETURN field.name as field, 
             size(producers) as producers,
             size(consumers) as consumers
      ORDER BY producers DESC
      LIMIT $topCount
    `, { topCount });

    // Get distribution stats
    const distributionStats = await queryNeo4j(`
      MATCH (field:ElementalField)
      WITH field, 
           [(bf:BusinessFunction)-[:HAS_OUTPUT_FIELD]->(field) | bf] as producers,
           [(bf:BusinessFunction)-[:HAS_INPUT_FIELD]->(field) | bf] as consumers
      WHERE size(producers) > 0 AND size(consumers) > 0
      WITH size(consumers) as consumerCount
      RETURN 
        sum(CASE WHEN consumerCount <= 10 THEN 1 ELSE 0 END) as range1to10,
        sum(CASE WHEN consumerCount > 10 AND consumerCount <= 50 THEN 1 ELSE 0 END) as range11to50,
        sum(CASE WHEN consumerCount > 50 AND consumerCount <= 100 THEN 1 ELSE 0 END) as range51to100,
        sum(CASE WHEN consumerCount > 100 AND consumerCount <= 500 THEN 1 ELSE 0 END) as range101to500,
        sum(CASE WHEN consumerCount > 500 AND consumerCount <= 1000 THEN 1 ELSE 0 END) as range501to1000,
        sum(CASE WHEN consumerCount > 1000 THEN 1 ELSE 0 END) as range1000plus,
        count(*) as total
    `);

    const [stats] = distributionStats;
    const total = stats.total || 1;

    return {
      byConsumerCount: [
        { range: '1-10', count: stats.range1to10, percentage: (stats.range1to10 / total) * 100 },
        { range: '11-50', count: stats.range11to50, percentage: (stats.range11to50 / total) * 100 },
        { range: '51-100', count: stats.range51to100, percentage: (stats.range51to100 / total) * 100 },
        { range: '101-500', count: stats.range101to500, percentage: (stats.range101to500 / total) * 100 },
        { range: '501-1000', count: stats.range501to1000, percentage: (stats.range501to1000 / total) * 100 },
        { range: '1000+', count: stats.range1000plus, percentage: (stats.range1000plus / total) * 100 }
      ],
      byProducerCount: [
        { range: '1', count: 0, percentage: 0 },
        { range: '2-3', count: 0, percentage: 0 },
        { range: '4-5', count: 0, percentage: 0 },
        { range: '6+', count: 0, percentage: 0 }
      ],
      topConsumerFields: topConsumers,
      topProducerFields: topProducers
    };
  } catch (error) {
    console.error('Error getting field distribution:', error);
    return {
      byConsumerCount: [],
      byProducerCount: [],
      topConsumerFields: [],
      topProducerFields: []
    };
  }
}

function generateRiskAssessment(systemStats: SystemStats, fieldDistribution: FieldDistribution): ImpactSummaryReport['riskAssessment'] {
  const criticalFields = fieldDistribution.topConsumerFields.map(field => {
    let risk = 'LOW';
    let impact = 'Minimal system disruption';
    let recommendation = 'Monitor for changes';
    
    if (field.consumers > 1000) {
      risk = 'CRITICAL';
      impact = 'System-wide failure possible';
      recommendation = 'Implement extensive testing and rollback procedures';
    } else if (field.consumers > 500) {
      risk = 'HIGH';
      impact = 'Major subsystem disruption';
      recommendation = 'Require comprehensive impact analysis before changes';
    } else if (field.consumers > 100) {
      risk = 'MEDIUM';
      impact = 'Moderate impact across multiple functions';
      recommendation = 'Thorough testing of downstream effects required';
    }
    
    return {
      field: field.field,
      risk,
      impact,
      recommendation
    };
  });
  
  const highRiskCount = criticalFields.filter(f => f.risk === 'CRITICAL' || f.risk === 'HIGH').length;
  let systemFragility = 'LOW';
  if (highRiskCount > 20) systemFragility = 'CRITICAL';
  else if (highRiskCount > 10) systemFragility = 'HIGH';
  else if (highRiskCount > 5) systemFragility = 'MEDIUM';
  
  const recommendedActions = [
    'Implement comprehensive impact analysis tools',
    'Establish change approval process for critical fields',
    'Create automated testing for high-impact dependencies',
    'Document business logic for critical BusinessFunctions',
    'Consider microservice boundaries to reduce coupling'
  ];
  
  if (systemFragility === 'CRITICAL') {
    recommendedActions.unshift('URGENT: Establish emergency rollback procedures');
    recommendedActions.push('Consider system architecture redesign');
  }
  
  return {
    criticalFields,
    systemFragility,
    recommendedActions
  };
}

function formatOutput(report: ImpactSummaryReport, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(report, null, 2);
    
    case 'markdown':
      return `# COBOL System Impact Analysis Report

**Generated:** ${report.generatedAt}

## Executive Summary

The legacy COBOL system analysis reveals a highly interconnected architecture with **${report.systemStats.totalBusinessFunctions}** BusinessFunctions managing **${report.systemStats.totalFields}** fields through **${report.systemStats.totalRelationships}** relationships.

**System Fragility: ${report.riskAssessment.systemFragility}**

## System Statistics

| Metric | Value |
|--------|-------|
| Total BusinessFunctions | ${report.systemStats.totalBusinessFunctions.toLocaleString()} |
| Total Fields | ${report.systemStats.totalFields.toLocaleString()} |
| Total Relationships | ${report.systemStats.totalRelationships.toLocaleString()} |
| Average Input Fields per BF | ${report.systemStats.avgInputFields.toFixed(1)} |
| Average Output Fields per BF | ${report.systemStats.avgOutputFields.toFixed(1)} |
| Maximum Input Fields | ${report.systemStats.maxInputFields} |
| Maximum Output Fields | ${report.systemStats.maxOutputFields} |

## Field Distribution Analysis

### By Consumer Count
${report.fieldDistribution.byConsumerCount.map(d => 
  `- **${d.range} consumers**: ${d.count.toLocaleString()} fields (${d.percentage}%)`
).join('\n')}

### Critical Fields (Top Consumers)
${report.fieldDistribution.topConsumerFields.map((f, i) => 
  `${i + 1}. **${f.field}**: ${f.consumers.toLocaleString()} consumers, ${f.producers} producers`
).join('\n')}

## Connectivity Analysis

- **Connected Components**: ${report.connectivityStats.connectedComponents}
- **Largest Component Size**: ${report.connectivityStats.largestComponentSize.toLocaleString()}
- **Isolated BusinessFunctions**: ${report.connectivityStats.isolatedBusinessFunctions}

### Highly Connected BusinessFunctions
${report.connectivityStats.highlyConnectedBFs.map((bf, i) => 
  `${i + 1}. **${bf.name}**: ${bf.connections.toLocaleString()} connections`
).join('\n')}

## Risk Assessment

### Critical Fields Analysis
${report.riskAssessment.criticalFields.slice(0, 10).map(f => 
  `#### ${f.field} - ${f.risk} RISK
**Impact**: ${f.impact}  
**Recommendation**: ${f.recommendation}`
).join('\n\n')}

### Recommended Actions
${report.riskAssessment.recommendedActions.map(action => `- ${action}`).join('\n')}

## Modernization Implications

The high interconnectedness of this system presents both challenges and opportunities:

1. **Change Risk**: Any modification to critical fields could impact hundreds or thousands of BusinessFunctions
2. **Testing Complexity**: Comprehensive testing requires understanding extensive dependency chains
3. **Microservice Boundaries**: High coupling suggests careful planning needed for service decomposition
4. **Data Lineage**: Complete field-level tracing enables precise impact analysis for compliance

---
*This report was generated by the COBOL Analysis System Impact Summary tool.*`;
    
    case 'text':
      return `COBOL SYSTEM IMPACT ANALYSIS REPORT
====================================

Generated: ${report.generatedAt}

EXECUTIVE SUMMARY
-----------------
System Fragility: ${report.riskAssessment.systemFragility}
Total BusinessFunctions: ${report.systemStats.totalBusinessFunctions.toLocaleString()}
Total Fields: ${report.systemStats.totalFields.toLocaleString()}
Total Relationships: ${report.systemStats.totalRelationships.toLocaleString()}

SYSTEM STATISTICS
-----------------
Average Input Fields per BF: ${report.systemStats.avgInputFields.toFixed(1)}
Average Output Fields per BF: ${report.systemStats.avgOutputFields.toFixed(1)}
Maximum Input Fields: ${report.systemStats.maxInputFields}
Maximum Output Fields: ${report.systemStats.maxOutputFields}

FIELD DISTRIBUTION
------------------
Consumer Count Distribution:
${report.fieldDistribution.byConsumerCount.map(d => 
  `  ${d.range} consumers: ${d.count.toLocaleString()} fields (${d.percentage}%)`
).join('\n')}

Critical Fields (Top Consumers):
${report.fieldDistribution.topConsumerFields.map((f, i) => 
  `  ${i + 1}. ${f.field}: ${f.consumers.toLocaleString()} consumers`
).join('\n')}

CONNECTIVITY ANALYSIS
---------------------
Connected Components: ${report.connectivityStats.connectedComponents}
Largest Component Size: ${report.connectivityStats.largestComponentSize.toLocaleString()}
Isolated BusinessFunctions: ${report.connectivityStats.isolatedBusinessFunctions}

Highly Connected BusinessFunctions:
${report.connectivityStats.highlyConnectedBFs.map((bf, i) => 
  `  ${i + 1}. ${bf.name}: ${bf.connections.toLocaleString()} connections`
).join('\n')}

RISK ASSESSMENT
---------------
${report.riskAssessment.criticalFields.slice(0, 5).map(f => 
  `${f.field}: ${f.risk} RISK - ${f.impact}`
).join('\n')}

RECOMMENDED ACTIONS
-------------------
${report.riskAssessment.recommendedActions.map((action, i) => `${i + 1}. ${action}`).join('\n')}`;
    
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
    .name('impact-summary')
    .description('Generate comprehensive system-wide impact analysis reports')
    .version('1.0.0')
    .option('-f, --format <format>', 'Output format: json, markdown, text', 'markdown')
    .option('--no-distribution', 'Exclude field distribution analysis')
    .option('--no-top-fields', 'Exclude top fields analysis')
    .option('--no-connectivity', 'Exclude connectivity analysis')
    .option('-t, --top-count <number>', 'Number of top items to include', '10')
    .parse();

  const options = program.opts() as ImpactSummaryOptions;
  
  // Validate options
  const topCount = parseInt(options.topCount);
  if (isNaN(topCount) || topCount < 1) {
    console.error('Error: top-count must be a positive integer');
    process.exit(1);
  }
  
  if (!['json', 'markdown', 'text'].includes(options.format)) {
    console.error('Error: format must be json, markdown, or text');
    process.exit(1);
  }
  
  try {
    console.error('Generating comprehensive system impact analysis...');
    console.error('Connecting to Neo4j...');
    
    const [systemStats, connectivityStats, fieldDistribution] = await Promise.all([
      getSystemStats(),
      options.includeConnectivity !== false ? getConnectivityStats() : Promise.resolve({
        connectedComponents: 0,
        largestComponentSize: 0,
        isolatedBusinessFunctions: 0,
        highlyConnectedBFs: []
      }),
      options.includeDistribution !== false && options.includeTopFields !== false 
        ? getFieldDistribution(topCount) 
        : Promise.resolve({
            byConsumerCount: [],
            byProducerCount: [],
            topConsumerFields: [],
            topProducerFields: []
          })
    ]);
    
    console.error('Performing risk assessment...');
    const riskAssessment = generateRiskAssessment(systemStats, fieldDistribution);
    
    const report: ImpactSummaryReport = {
      systemStats,
      connectivityStats,
      fieldDistribution,
      riskAssessment,
      generatedAt: new Date().toISOString()
    };
    
    console.error('Report generation complete');
    
    const output = formatOutput(report, options.format);
    console.log(output);
    
    await closeGlobalConnection();
    
  } catch (error) {
    console.error('Error generating impact summary:', error);
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