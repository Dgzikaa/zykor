const fs = require('fs');

// Ler SQL
const sqlFunction = fs.readFileSync('temp_function.sql', 'utf8');

console.log('=== PASSO 1: APLICAR FUNÇÃO ===');
console.log('');
console.log('MCP Call:');
console.log('Server: project-0-zykor-supabase');
console.log('Tool: execute_sql');
console.log('');
console.log('Arguments:');
console.log(JSON.stringify({
    project_id: 'uqtgsvujwcbymjmvkjhy',
    query: sqlFunction
}, null, 2));
console.log('');
console.log('Tamanho do SQL:', sqlFunction.length, 'caracteres');
console.log('');
console.log('=== Aguardando execução via MCP... ===');
