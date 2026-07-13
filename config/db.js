const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool instead of a single connection.
// A pool is better because it handles multiple simultaneous requests efficiently
// by reusing connections instead of opening/closing a new one every time.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('Database connected successfully!');
    connection.release(); // Always release the connection back to the pool
  })
  .catch(err => {
    console.error('Error connecting to the database:', err.message);
    console.error('Please make sure MySQL is running and credentials in .env are correct.');
  });

module.exports = pool;
