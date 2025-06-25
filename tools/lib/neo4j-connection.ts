import neo4j, { Driver, Session, auth, Config } from 'neo4j-driver';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

export class Neo4jConnection {
  private driver: Driver | null = null;
  private config: Neo4jConfig;

  constructor(config?: Partial<Neo4jConfig>) {
    this.config = {
      uri: config?.uri || process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: config?.username || process.env.NEO4J_USERNAME || 'neo4j',
      password: config?.password || process.env.NEO4J_PASSWORD || 'cobolanalysis',
      database: config?.database || process.env.NEO4J_DATABASE || 'neo4j'
    };
  }

  async connect(): Promise<void> {
    if (this.driver) {
      return; // Already connected
    }

    try {
      const driverConfig: Config = {
        maxConnectionLifetime: 60000, // 1 minute
        maxConnectionPoolSize: 10,
        connectionAcquisitionTimeout: 60000, // 1 minute
        disableLosslessIntegers: true, // For easier numeric handling
      };

      this.driver = neo4j.driver(
        this.config.uri,
        auth.basic(this.config.username, this.config.password),
        driverConfig
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
    } catch (error) {
      this.driver = null;
      throw new Error(`Failed to connect to Neo4j at ${this.config.uri}: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not connected. Call connect() first.');
    }
    
    return this.driver.session({
      database: this.config.database,
      defaultAccessMode: neo4j.session.READ
    });
  }

  async executeQuery(cypher: string, parameters: Record<string, any> = {}): Promise<any[]> {
    const session = this.getSession();
    
    try {
      // Convert numeric parameters to proper integers
      const processedParams = this.processParameters(parameters);
      const result = await session.run(cypher, processedParams);
      return result.records.map(record => record.toObject());
    } catch (error) {
      throw new Error(`Neo4j query failed: ${error}\nQuery: ${cypher}\nParameters: ${JSON.stringify(parameters)}`);
    } finally {
      await session.close();
    }
  }

  private processParameters(parameters: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'number' && Number.isInteger(value)) {
        processed[key] = neo4j.int(value);
      } else {
        processed[key] = value;
      }
    }
    return processed;
  }

  async executeReadTransaction<T>(
    transactionWork: (tx: any) => Promise<T>
  ): Promise<T> {
    const session = this.getSession();
    
    try {
      return await session.executeRead(transactionWork);
    } finally {
      await session.close();
    }
  }

  isConnected(): boolean {
    return this.driver !== null;
  }

  getConfig(): Neo4jConfig {
    return { ...this.config };
  }
}

// Singleton instance for shared use across tools
let globalConnection: Neo4jConnection | null = null;

export async function getNeo4jConnection(config?: Partial<Neo4jConfig>): Promise<Neo4jConnection> {
  if (!globalConnection) {
    globalConnection = new Neo4jConnection(config);
    await globalConnection.connect();
  }
  return globalConnection;
}

export async function closeGlobalConnection(): Promise<void> {
  if (globalConnection) {
    await globalConnection.disconnect();
    globalConnection = null;
  }
}

// Convenience function for one-off queries
export async function queryNeo4j(
  cypher: string, 
  parameters: Record<string, any> = {}, 
  config?: Partial<Neo4jConfig>
): Promise<any[]> {
  const connection = await getNeo4jConnection(config);
  return await connection.executeQuery(cypher, parameters);
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  await closeGlobalConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeGlobalConnection();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await closeGlobalConnection();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  await closeGlobalConnection();
  process.exit(1);
});