const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('ERRO: SUPABASE_SERVICE_KEY não definida');
    process.exit(1);
}

async function aplicarFuncao() {
    try {
        // Criar cliente Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // Ler o SQL
        const sqlPath = path.join('c:', 'Projects', 'zykor', 'temp_function_corrected.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('=== APLICANDO FUNÇÃO CORRIGIDA ===');
        console.log('URL:', SUPABASE_URL);
        console.log('Tamanho do SQL:', sql.length, 'caracteres');
        console.log('');
        
        // Executar SQL via RPC (usando a função postgres para executar SQL dinâmico)
        const { data, error } = await supabase.rpc('exec', { query: sql });
        
        if (error) {
            console.error('ERRO ao aplicar função:', error);
            process.exit(1);
        }
        
        console.log('✓ Função aplicada com sucesso!');
        console.log('');
        
        return true;
    } catch (err) {
        console.error('ERRO:', err.message);
        process.exit(1);
    }
}

aplicarFuncao();
