const fs = require('fs');

async function main() {
    console.log('=== APLICANDO FUNÇÃO COM HAPPY HOUR E RECALCULANDO EVENTOS ===\n');
    
    // 1. Ler o SQL da função
    const sqlFunction = fs.readFileSync('database/functions/calculate_evento_metrics_with_happy_hour.sql', 'utf8');
    console.log('✓ SQL carregado:', sqlFunction.length, 'caracteres\n');
    
    // 2. Aplicar função via MCP
    console.log('PASSO 1: Aplicar função via MCP execute_sql');
    console.log('Server: project-0-zykor-supabase');
    console.log('Tool: execute_sql');
    console.log('Params: { project_id: "uqtgsvujwcbymjmvkjhy", query: <SQL> }\n');
    
    // 3. Recalcular eventos de fevereiro do Deboche
    console.log('PASSO 2: Recalcular eventos de fevereiro do Deboche (bar_id = 1)');
    const sqlRecalcular = `
        SELECT 
            id,
            nome,
            data_evento,
            calculate_evento_metrics(id) as resultado
        FROM eventos_base
        WHERE bar_id = 1
        AND data_evento >= '2026-02-01'
        AND data_evento < '2026-03-01'
        AND EXTRACT(dow FROM data_evento) != 0
        ORDER BY data_evento;
    `;
    console.log('Query:', sqlRecalcular);
    
    // 4. Verificar resultados
    console.log('\nPASSO 3: Verificar eventos com percent_happy_hour > 0');
    const sqlVerificar = `
        SELECT 
            COUNT(*) as total_eventos,
            COUNT(CASE WHEN percent_happy_hour > 0 THEN 1 END) as eventos_com_happy_hour,
            AVG(percent_happy_hour) as media_happy_hour,
            MAX(percent_happy_hour) as max_happy_hour
        FROM eventos_base
        WHERE bar_id = 1
        AND data_evento >= '2026-02-01'
        AND data_evento < '2026-03-01'
        AND EXTRACT(dow FROM data_evento) != 0;
    `;
    console.log('Query:', sqlVerificar);
    
    console.log('\n=== INSTRUÇÕES PARA EXECUTAR VIA MCP ===');
    console.log('1. Usar CallMcpTool com server: project-0-zykor-supabase, tool: execute_sql');
    console.log('2. Passar o SQL da função como query');
    console.log('3. Executar query de recálculo');
    console.log('4. Executar query de verificação');
}

main().catch(console.error);
