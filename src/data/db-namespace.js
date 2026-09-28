const DEFAULT_DATABASE_TABLE = "kv_store";

function normalizeDatabaseTableName(value) {
  const tableName = String(value || "").trim();
  if (!tableName) return "";
  if (!/^kv_store(?:_[A-Za-z0-9]+)*$/.test(tableName)) {
    const error = new Error("INVALID_DATABASE_TABLE_NAMESPACE");
    error.code = "INVALID_DATABASE_TABLE_NAMESPACE";
    throw error;
  }
  return tableName;
}

function rewriteDatabaseSql(sql, tableName) {
  const target = normalizeDatabaseTableName(tableName);
  if (!target || target === DEFAULT_DATABASE_TABLE) return String(sql);
  return String(sql).replace(/\bkv_store\b/g, target);
}

function wrapDatabaseTableNamespace(database, tableName) {
  const target = normalizeDatabaseTableName(tableName);
  if (!database || !target || target === DEFAULT_DATABASE_TABLE) return database;
  const wrapped = {
    prepare(sql) {
      return database.prepare(rewriteDatabaseSql(sql, target));
    },
    batch(statements) {
      return database.batch(statements);
    },
    exec(sql) {
      return database.exec(rewriteDatabaseSql(sql, target));
    },
    dump() {
      return database.dump();
    }
  };
  if (typeof database.withSession === "function") {
    wrapped.withSession = bookmarkOrConstraint =>
      wrapDatabaseTableNamespace(database.withSession(bookmarkOrConstraint), target);
  }
  return wrapped;
}

function configuredDatabaseTable(env = {}) {
  return normalizeDatabaseTableName(env?.QQAI_DB_TABLE || env?.V3_TEST_DB_TABLE || "");
}

function withDatabaseTableNamespace(env, tableName) {
  const target = normalizeDatabaseTableName(tableName);
  if (!target || !env?.DB) return env;
  const wrappedEnv = Object.create(env);
  Object.defineProperty(wrappedEnv, "DB", {
    value: wrapDatabaseTableNamespace(env.DB, target),
    enumerable: true,
    configurable: true,
    writable: false
  });
  Object.defineProperty(wrappedEnv, "QQAI_ACTIVE_DB_TABLE", {
    value: target,
    enumerable: true,
    configurable: true,
    writable: false
  });
  return wrappedEnv;
}

function withConfiguredDatabaseNamespace(env) {
  const tableName = configuredDatabaseTable(env);
  return tableName ? withDatabaseTableNamespace(env, tableName) : env;
}

export {
  DEFAULT_DATABASE_TABLE,
  configuredDatabaseTable,
  normalizeDatabaseTableName,
  rewriteDatabaseSql,
  withConfiguredDatabaseNamespace,
  withDatabaseTableNamespace,
  wrapDatabaseTableNamespace
};
