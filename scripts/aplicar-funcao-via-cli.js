const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ler o SQL
const sqlPath = path.join('c:', 'Projects', 'zykor', 'temp_function_corrected.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('=== APLICANDO FUNÇÃO VIA PSQL ===');
console.log('Tamanho:', sql.length, 'caracteres');
console.log('');

// Salvar em arquivo temporário
const tempSqlPath = path.join('c:', 'Projects', 'zykor', 'temp_apply.sql');
fs.writeFileSync(tempSqlPath, sql, 'utf8');

try {
    // Aplicar via supabase db execute
    const cmd = 
px supabase db execute --project-ref uqtgsvujwcbymjmvkjhy --file "";
    console.log('Executando:', cmd);
    console.log('');
    
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
    
    console.log('');
    console.log('✓ Função aplicada com sucesso!');
} catch (err) {
    console.error('ERRO:', err.message);
    process.exit(1);
}
