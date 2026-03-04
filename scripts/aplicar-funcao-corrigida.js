const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Ler o SQL (sem BOM)
const sqlPath = path.join(__dirname, '..', 'temp_function_corrected_nobom.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// Conexão PostgreSQL do MCP
const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

async function aplicarFuncao() {
    const client = new Client({ connectionString });
    
    try {
        console.log('=== APLICANDO FUNÇÃO VIA POSTGRESQL ===');
        console.log('Conectando ao banco...');
        
        await client.connect();
        console.log('✓ Conectado!');
        console.log('');
        console.log('Aplicando função SQL (' + sql.length + ' caracteres)...');
        
        await client.query(sql);
        
        console.log('✓ Função aplicada com sucesso!');
        console.log('');
        
        // Testar recalculando eventos
        console.log('=== TESTANDO RECÁLCULO ===');
        console.log('');
        
        // 1. Ordinário (2026-03-02, bar_id=4)
        console.log('1. Buscando evento Ordinário (2026-03-02)...');
        const ordBefore = await client.query(
            SELECT id, data_evento, bar_id, t_coz, t_bar, c_art, c_prod, percent_d 
             FROM eventos_base 
             WHERE data_evento = $1 AND bar_id = $2,
            ['2026-03-02', 4]
        );
        
        if (ordBefore.rows.length > 0) {
            const evento = ordBefore.rows[0];
            console.log('Antes:', {
                id: evento.id,
                t_coz: parseFloat(evento.t_coz) || 0,
                t_bar: parseFloat(evento.t_bar) || 0,
                c_art: parseFloat(evento.c_art) || 0,
                c_prod: parseFloat(evento.c_prod) || 0,
                percent_d: parseFloat(evento.percent_d) || 0
            });
            
            console.log('Recalculando...');
            await client.query(SELECT calculate_evento_metrics($1), [evento.id]);
            
            const ordAfter = await client.query(
                SELECT t_coz, t_bar, c_art, c_prod, percent_d 
                 FROM eventos_base 
                 WHERE id = $1,
                [evento.id]
            );
            
            console.log('Depois:', {
                t_coz: parseFloat(ordAfter.rows[0].t_coz) || 0,
                t_bar: parseFloat(ordAfter.rows[0].t_bar) || 0,
                c_art: parseFloat(ordAfter.rows[0].c_art) || 0,
                c_prod: parseFloat(ordAfter.rows[0].c_prod) || 0,
                percent_d: parseFloat(ordAfter.rows[0].percent_d) || 0
            });
        } else {
            console.log('Evento não encontrado!');
        }
        
        console.log('');
        
        // 2. Deboche (2026-02-28, bar_id=3)
        console.log('2. Buscando evento Deboche (2026-02-28)...');
        const debBefore = await client.query(
            SELECT id, data_evento, bar_id, t_coz, t_bar, c_art, c_prod, percent_d 
             FROM eventos_base 
             WHERE data_evento = $1 AND bar_id = $2,
            ['2026-02-28', 3]
        );
        
        if (debBefore.rows.length > 0) {
            const evento = debBefore.rows[0];
            console.log('Antes:', {
                id: evento.id,
                t_coz: parseFloat(evento.t_coz) || 0,
                t_bar: parseFloat(evento.t_bar) || 0,
                c_art: parseFloat(evento.c_art) || 0,
                c_prod: parseFloat(evento.c_prod) || 0,
                percent_d: parseFloat(evento.percent_d) || 0
            });
            
            console.log('Recalculando...');
            await client.query(SELECT calculate_evento_metrics($1), [evento.id]);
            
            const debAfter = await client.query(
                SELECT t_coz, t_bar, c_art, c_prod, percent_d 
                 FROM eventos_base 
                 WHERE id = $1,
                [evento.id]
            );
            
            console.log('Depois:', {
                t_coz: parseFloat(debAfter.rows[0].t_coz) || 0,
                t_bar: parseFloat(debAfter.rows[0].t_bar) || 0,
                c_art: parseFloat(debAfter.rows[0].c_art) || 0,
                c_prod: parseFloat(debAfter.rows[0].c_prod) || 0,
                percent_d: parseFloat(debAfter.rows[0].percent_d) || 0
            });
        } else {
            console.log('Evento não encontrado!');
        }
        
        console.log('');
        console.log('=== CONCLUÍDO ===');
        
    } catch (err) {
        console.error('ERRO:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

aplicarFuncao();
