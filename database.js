const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASS || 'root'),
  database: process.env.DB_NAME || 'dispenser_registration',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
