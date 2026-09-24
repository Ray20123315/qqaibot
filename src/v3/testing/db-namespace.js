function rewriteV3TestSql(sql, tableName) {
  return String(sql).replace(/\bkv_store\b/g, tableName);
}

function wrapV3TestDatabase(database, tableName) {
  if (!database || !tableName) return database;
  const wrapped = {
    prepare(sql) {
      return database.prepare(rewriteV3TestSql(sql, tableName));
    },
    batch(statements) {
      return database.batch(statements);
    },
    exec(sql) {
      return database.exec(rewriteV3TestSql(sql, tableName));
    },
    dump() {
      return database.dump();
    }
  };
  if (typeof database.withSession === "function") {
    wrapped.withSession = bookmarkOrConstraint => wrapV3TestDatabase(database.withSession(bookmarkOrConstraint), tableName);
  }
  return wrapped;
}

function withV3TestDatabaseNamespace(env) {
  const tableName = String(env?.V3_TEST_DB_TABLE || "").trim();
  if (!tableName) return env;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) throw new Error("INVALID_V3_TEST_DB_TABLE");
  if (!env?.DB) return env;
  return { ...env, DB: wrapV3TestDatabase(env.DB, tableName) };
}

export { rewriteV3TestSql, wrapV3TestDatabase, withV3TestDatabaseNamespace };
