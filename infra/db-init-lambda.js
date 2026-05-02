const { Client } = require('pg');
exports.handler = async (event) => {
  let sql = event.sql || '';
  if (event.sql_base64) {
    sql = Buffer.from(event.sql_base64, 'base64').toString('utf-8');
  }
  if (!sql.trim()) return { statusCode: 400, body: 'No SQL' };
  const client = new Client({
    host: process.env.DB_HOST,
    port: 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 90000,
  });
  try {
    await client.connect();
    await client.query(sql);
    await client.end();
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    try { await client.end(); } catch(e) {}
    return { statusCode: 500, body: err.message };
  }
};
