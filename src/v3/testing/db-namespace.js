import {
  rewriteDatabaseSql,
  withDatabaseTableNamespace,
  wrapDatabaseTableNamespace
} from "../../data/db-namespace.js";

function rewriteV3TestSql(sql, tableName) {
  return rewriteDatabaseSql(sql, tableName);
}

function wrapV3TestDatabase(database, tableName) {
  return wrapDatabaseTableNamespace(database, tableName);
}

function withV3TestDatabaseNamespace(env) {
  const tableName = String(env?.V3_TEST_DB_TABLE || "").trim();
  if (!tableName) return env;
  try {
    return withDatabaseTableNamespace(env, tableName);
  } catch (error) {
    if (String(error?.code || error?.message || "") === "INVALID_DATABASE_TABLE_NAMESPACE") {
      throw new Error("INVALID_V3_TEST_DB_TABLE");
    }
    throw error;
  }
}

export { rewriteV3TestSql, wrapV3TestDatabase, withV3TestDatabaseNamespace };
