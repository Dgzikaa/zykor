const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

async function testarRecalculo() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('=== TESTANDO RECÁLCULO ===\n');
        
        // 1. Ordinário (2026-03-02, bar_id=4)
        console.log('1. Evento Ordinário (2026-03-02, bar_id=4)');
        let result = await client.query('SELECT id, t_coz, t_bar, c_art, c_prod, percent_d FROM eventos_base WHERE data_evento = $1 AND bar_id = $2', ['2026-03-02', 4]);
        if (result.rows.length > 0) {
            const before = result.rows[0];
            console.log('Antes:', before);
            await client.query('SELECT calculate_evento_metrics($1)', [before.id]);
            result = await client.query('SELECT t_coz, t_bar, c_art, c_prod, percent_d FROM eventos_base WHERE id = $1', [before.id]);
            console.log('Depois:', result.rows[0]);
        }
        
        console.log('');
        
        // 2. Deboche (2026-02-28, bar_id=3)
        console.log('2. Evento Deboche (2026-02-28, bar_id=3)');
        result = await client.query('SELECT id, t_coz, t_bar, c_art, c_prod, percent_d FROM eventos_base WHERE data_evento = $1 AND bar_id = $2', ['2026-02-28', 3]);
        if (result.rows.length > 0) {
            const before = result.rows[0];
            console.log('Antes:', before);
            await client.query('SELECT calculate_evento_metrics($1)', [before.id]);
            result = await client.query('SELECT t_coz, t_bar, c_art, c_prod, percent_d FROM eventos_base WHERE id = $1', [before.id]);
            console.log('Depois:', result.rows[0]);
        }
        
        console.log('\n=== CONCLUÍDO ===');
    } catch (err) {
        console.error('ERRO:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}
testarRecalculo();