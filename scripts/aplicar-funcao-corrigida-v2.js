const fs = require('fs');
const path = require('path');

// Ler o SQL
const sqlPath = path.join(__dirname, '..', 'temp_function_corrected.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('ERRO: SUPABASE_SERVICE_KEY não definida');
    console.error('Defina com: $env:SUPABASE_SERVICE_KEY = "sua-chave"');
    process.exit(1);
}

async function aplicarFuncao() {
    try {
        console.log('=== APLICANDO FUNÇÃO VIA POSTGREST ===');
        console.log('URL:', SUPABASE_URL);
        console.log('Tamanho do SQL:', sql.length, 'caracteres');
        console.log('');
        
        // Usar a API de SQL direto do Supabase
        // Endpoint: POST /rest/v1/rpc/query
        const response = await fetch(${SUPABASE_URL}/rest/v1/rpc/query, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': Bearer 
            },
            body: JSON.stringify({ query: sql })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('ERRO:', response.status, response.statusText);
            console.error('Detalhes:', errorText);
            
            // Tentar via SQL direto usando pg
            console.log('');
            console.log('Tentando via conexão PostgreSQL direta...');
            
            const { Client } = require('pg');
            const client = new Client({
                connectionString: postgresql://postgres.uqtgsvujwcbymjmvkjhy:@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
            });
            
            await client.connect();
            await client.query(sql);
            await client.end();
            
            console.log('✓ Função aplicada via PostgreSQL direto!');
        } else {
            console.log('✓ Função aplicada via PostgREST!');
        }
        
        console.log('');
        console.log('=== CONCLUÍDO ===');
        
    } catch (err) {
        console.error('ERRO:', err.message);
        console.error(err);
        process.exit(1);
    }
}

aplicarFuncao();
