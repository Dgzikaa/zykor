const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

async function buscarOrdinario() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Buscando eventos do Ordinário (bar_id=4) em março/2026...\n');
        
        const result = await client.query(
            'SELECT id, data_evento, nome FROM eventos_base WHERE bar_id = 4 AND data_evento >= $1 AND data_evento < $2 ORDER BY data_evento DESC LIMIT 5',
            ['2026-03-01', '2026-03-04']
        );
        
        console.log('Eventos encontrados:', result.rows);
    } catch (err) {
        console.error('ERRO:', err.message);
    } finally {
        await client.end();
    }
}
buscarOrdinario();