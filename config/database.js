require('dotenv').config();

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'babycare_estoque',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;