const fs = require('fs');
const path = require('path');

// Ler o SQL corrigido
const sqlPath = path.join('c:', 'Projects', 'zykor', 'temp_function_corrected.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('=== APLICANDO FUNÇÃO CORRIGIDA ===');
console.log('Tamanho do SQL:', sql.length, 'caracteres');
console.log('');
console.log('Primeiras 300 caracteres:');
console.log(sql.substring(0, 300));
console.log('');
console.log('...SQL completo preparado para aplicação via MCP...');
console.log('');
console.log('Use o CallMcpTool com:');
console.log('- server_name: project-0-zykor-supabase');
console.log('- tool_name: apply_migration');
console.log('- arguments:');
console.log('  - project_id: uqtgsvujwcbymjmvkjhy');
console.log('  - name: fix_calculate_evento_metrics_tempo_custos');
console.log('  - query: [conteúdo do arquivo temp_function_corrected.sql]');
