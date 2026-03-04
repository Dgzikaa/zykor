const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

async function buscarEventosComDados() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Buscando eventos do Ordinário com dados...\n');
        
        const result = await client.query(
            `SELECT id, data_evento, nome, t_coz, t_bar, c_art, c_prod 
             FROM eventos_base 
             WHERE bar_id = 4 
             AND (t_coz > 0 OR t_bar > 0 OR c_art > 0 OR c_prod > 0)
             ORDER BY data_evento DESC 
             LIMIT 3`
        );
        
        console.log('Eventos encontrados:', result.rows);
    } catch (err) {
        console.error('ERRO:', err.message);
    } finally {
        await client.end();
    }
}
buscarEventosComDados();