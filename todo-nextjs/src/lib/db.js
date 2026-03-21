import postgres from 'postgres';

const sql = postgres(process.env.DB9_CONNECTION_STRING, {
  ssl: 'require',
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
