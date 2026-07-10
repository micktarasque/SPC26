import * as sql from 'mssql';

let poolPromise: Promise<sql.ConnectionPool> | null = null;

/** Lazily-created, process-wide connection pool (reused across warm invocations). */
export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const connectionString = process.env.SQL_CONNECTION_STRING;
    if (!connectionString) {
      return Promise.reject(new Error('SQL_CONNECTION_STRING app setting is not configured.'));
    }
    poolPromise = new sql.ConnectionPool(connectionString)
      .connect()
      .catch(err => {
        // Reset so the next request retries a fresh connection instead of a dead pool.
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

export interface QueryInput {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

/** Run a parameterised query and return the row set. */
export async function query<T = any>(text: string, inputs: QueryInput[] = []): Promise<T[]> {
  const pool = await getPool();
  const request = pool.request();
  for (const i of inputs) request.input(i.name, i.type as any, i.value);
  const result = await request.query(text);
  return result.recordset as T[];
}

/** Run a parameterised statement and return the number of affected rows. */
export async function execute(text: string, inputs: QueryInput[] = []): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  for (const i of inputs) request.input(i.name, i.type as any, i.value);
  const result = await request.query(text);
  return Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((a, b) => a + b, 0)
    : 0;
}

// Re-export mssql types for convenience in function files.
export { sql };
