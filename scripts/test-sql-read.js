const fs = require('fs');
const path = require('path');

// Ler o SQL
const sqlPath = path.join('c:', 'Projects', 'zykor', 'temp_function_corrected.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('SQL Query Length:', sql.length);
console.log('First 200 chars:', sql.substring(0, 200));
console.log('Last 200 chars:', sql.substring(sql.length - 200));
