const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function buscarEventoSabado() {
  try {
    await client.connect();
    
    console.log('Buscando eventos de sábado do Deboche em fevereiro 2026...\n');
    
    const result = await client.query(`
      SELECT 
        id,
        nome,
        data_evento,
        EXTRACT(dow FROM data_evento) as dia_semana,
        TO_CHAR(data_evento, 'Day') as nome_dia,
        bar_id
      FROM eventos_base
      WHERE bar_id = 4
      AND data_evento >= '2026-02-01'
      AND data_evento < '2026-03-01'
      AND EXTRACT(dow FROM data_evento) = 6
      ORDER BY data_evento
      LIMIT 5
    `);
    
    console.log('Eventos encontrados:');
    result.rows.forEach(evento => {
      console.log(`\nID: ${evento.id}`);
      console.log(`  Nome: ${evento.nome}`);
      console.log(`  Data: ${evento.data_evento}`);
      console.log(`  Dia: ${evento.nome_dia} (dow=${evento.dia_semana})`);
    });
    
    if (result.rows.length > 0) {
      const eventoTeste = result.rows[0];
      console.log(`\n\nVou usar o evento ${eventoTeste.id} para testar`);
      
      // Recalcular
      console.log('\nRecalculando...');
      await client.query('SELECT calculate_evento_metrics($1)', [eventoTeste.id]);
      
      // Buscar resultado
      const resultCalc = await client.query(`
        SELECT percent_b, percent_c, percent_d, real_r, cl_real
        FROM eventos_base
        WHERE id = $1
      `, [eventoTeste.id]);
      
      const updated = resultCalc.rows[0];
      console.log('\n=== RESULTADO ===');
      console.log('Percentuais:');
      console.log('  %Bebidas:', parseFloat(updated.percent_b || 0).toFixed(2) + '%');
      console.log('  %Drinks:', parseFloat(updated.percent_d || 0).toFixed(2) + '%');
      console.log('  %Comida:', parseFloat(updated.percent_c || 0).toFixed(2) + '%');
      const total = parseFloat(updated.percent_b || 0) + parseFloat(updated.percent_c || 0) + parseFloat(updated.percent_d || 0);
      console.log('  Total:', total.toFixed(2) + '%');
    }
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

buscarEventoSabado();