declare module 'sql.js' {
  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  interface InitSqlJsOptions {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>;
  export type { Database, QueryExecResult, SqlJsStatic };
}
