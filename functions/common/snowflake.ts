import { logger } from "./powertools";
import {
  getSnowflakeAccountInfo,
  getSnowflakeWarehouseConfig,
} from "./helpers";
import { createPool } from "snowflake-sdk";
import type { ConnectionOptions } from "snowflake-sdk";

/**
 * A client for Snowflake that can execute SQL statements
 */
class SnowflakeClient {
  private logger: ReturnType<typeof logger.createChild>;
  private connectionPool?: ReturnType<typeof createPool>;
  private connectionOptions?: ConnectionOptions;

  constructor() {
    this.logger = logger.createChild({
      sampleRateValue: 1,
    });
  }

  /**
   * Get the connection options for Snowflake. If they already exist, return them.
   * Otherwise, get them from AppConfig and Secrets Manager
   * @returns The connection options for Snowflake
   */
  private async getConnectionOptions(): Promise<ConnectionOptions> {
    if (this.connectionOptions) return this.connectionOptions;

    try {
      this.connectionOptions = {
        ...(await getSnowflakeAccountInfo()),
        ...(await getSnowflakeWarehouseConfig()),
      };
    } catch (err) {
      this.logger.error("Failed to get connection options", {
        err,
      });
      throw err;
    }

    return this.connectionOptions;
  }

  /**
   * Get a connection pool to Snowflake. If one already exists, return it. Otherwise, create a new one.
   * @returns A connection pool to Snowflake
   */
  private async getConnectionPool(): Promise<ReturnType<typeof createPool>> {
    if (this.connectionPool) return this.connectionPool;

    return createPool(await this.getConnectionOptions(), {
      max: 10,
      min: 0,
    });
  }

  /**
   * Executes a SQL statement against Snowflake.
   *
   * @note At the moment bindings are not supported due to https://github.com/snowflakedb/snowflake-connector-nodejs/issues/55
   *
   * @param sqlText - The SQL statement to execute
   * @param streamResult - Whether to stream the results or not. Defaults to `false`
   */
  public async executeStatement(
    sqlText: string,
    streamResult: boolean = false
  ): Promise<any[] | undefined> {
    const connectionPool = await this.getConnectionPool();
    try {
      return new Promise<any[] | undefined>((resolve, reject) => {
        const pool = connectionPool.use(async (clientConnection) => {
          const connection = clientConnection.execute({
            sqlText,
            streamResult,
            complete: (err, stmt, rows) => {
              if (err) {
                this.logger.error(
                  "failed to execute statement due to the following error: " +
                    err.message
                );
                reject(err);
              }
              this.logger.debug("successfully executed statement", {
                statement: sqlText,
                numberOfRows: rows?.length,
              });

              if (!streamResult) {
                return resolve(rows);
              }

              const stream = stmt.streamRows();
              const data: any[] = [];
              stream.on("data", (row: any) => {
                data.push(row);
              });
              stream.on("end", (row: any) => {
                this.logger.debug("successfully streamed all rows");
                data.push(row);
                resolve(data);
              });
              stream.on("close", () => {
                resolve(data);
              });

              stream.on("error", (err) => {
                this.logger.error("error streaming rows", {
                  details: err,
                });

                reject(err);
              });
            },
          });

          return connection;
        });

        return pool;
      });
    } catch (err) {
      logger.error(`error starting query`, {
        details: sqlText,
        error: err,
      });
      throw err;
    }
  }
}

const snowflakeClient = new SnowflakeClient();

export { SnowflakeClient, snowflakeClient };
