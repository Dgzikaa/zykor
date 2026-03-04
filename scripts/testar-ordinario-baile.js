const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

async function testarOrdinario() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('=== TESTANDO ORDINÁRIO - Baile do Mike (2026-02-28) ===\n');
        
        let result = await client.query('SELECT id, t_coz, t_bar, c_art, c_prod, percent_d FROM eventos_base WHERE id = 750');
        if (result.rows.length > 0) {
            const before = result.rows[0];
            console.log('Antes:', before);
            console.log('\nRecalculando...\n');
            await client.query('SELECT calculate_evento_metrics($1)', [before.id]);
            result = await client.query('SELECT t_coz, t_bar, c_art, c_prod, percent_d FROM eventos_base WHERE id = $1', [before.id]);
            console.log('Depois:', result.rows[0]);
        }
    } catch (err) {
        console.error('ERRO:', err.message);
    } finally {
        await client.end();
    }
}
testarOrdinario();