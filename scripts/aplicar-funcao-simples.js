const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'temp_function_corrected_nobom.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

async function aplicarFuncao() {
    const client = new Client({ connectionString });
    try {
        console.log('Conectando...');
        await client.connect();
        console.log('Aplicando função...');
        await client.query(sql);
        console.log('Função aplicada com sucesso!');
    } catch (err) {
        console.error('ERRO:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}
aplicarFuncao();