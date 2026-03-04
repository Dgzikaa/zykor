const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function testarFuncaoComLogs() {
  try {
    await client.connect();
    
    console.log('Recalculando evento 723 com logs habilitados...\n');
    
    // Habilitar logs de NOTICE
    await client.query('SET client_min_messages TO NOTICE');
    
    // Capturar notices
    client.on('notice', (msg) => {
      console.log('NOTICE:', msg.message);
    });
    
    await client.query('SELECT calculate_evento_metrics($1)', [723]);
    
    console.log('\n✓ Recálculo concluído');
    
    // Buscar valores
    const result = await client.query(`
      SELECT percent_b, percent_c, percent_d
      FROM eventos_base
      WHERE id = 723
    `);
    
    const evento = result.rows[0];
    console.log('\nPercentuais gravados:');
    console.log('  %Bebidas:', parseFloat(evento.percent_b).toFixed(2) + '%');
    console.log('  %Comidas:', parseFloat(evento.percent_c).toFixed(2) + '%');
    console.log('  %Drinks:', parseFloat(evento.percent_d).toFixed(2) + '%');
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

testarFuncaoComLogs();