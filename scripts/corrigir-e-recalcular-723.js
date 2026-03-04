const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function corrigirDataEvento() {
  try {
    await client.connect();
    
    console.log('Corrigindo data do evento 723...\n');
    
    // Verificar data atual
    const antes = await client.query('SELECT data_evento, EXTRACT(dow FROM data_evento) as dow FROM eventos_base WHERE id = 723');
    console.log('ANTES:');
    console.log('  Data:', antes.rows[0].data_evento);
    console.log('  Dia da semana:', antes.rows[0].dow, '(0=domingo, 6=sábado)');
    
    // Corrigir para sábado (remover as 3 horas extras)
    await client.query(`
      UPDATE eventos_base 
      SET data_evento = '2026-02-01'::date
      WHERE id = 723
    `);
    
    // Verificar depois
    const depois = await client.query('SELECT data_evento, EXTRACT(dow FROM data_evento) as dow FROM eventos_base WHERE id = 723');
    console.log('\nDEPOIS:');
    console.log('  Data:', depois.rows[0].data_evento);
    console.log('  Dia da semana:', depois.rows[0].dow, '(0=domingo, 6=sábado)');
    
    // Recalcular
    console.log('\nRecalculando métricas...');
    await client.query('SELECT calculate_evento_metrics(723)');
    
    // Buscar resultado
    const result = await client.query(`
      SELECT percent_b, percent_c, percent_d, real_r, cl_real
      FROM eventos_base
      WHERE id = 723
    `);
    
    const updated = result.rows[0];
    console.log('\n=== RESULTADO ===');
    console.log('Evento: 723 - Pagode Lucas Alves + Final Super Copa');
    console.log('Data: 01/02/2026 (Deboche)');
    console.log('\nPercentuais:');
    console.log('  %Bebidas:', parseFloat(updated.percent_b || 0).toFixed(2) + '%');
    console.log('  %Drinks:', parseFloat(updated.percent_d || 0).toFixed(2) + '%');
    console.log('  %Comida:', parseFloat(updated.percent_c || 0).toFixed(2) + '%');
    const total = parseFloat(updated.percent_b || 0) + parseFloat(updated.percent_c || 0) + parseFloat(updated.percent_d || 0);
    console.log('  Total:', total.toFixed(2) + '%');
    console.log('\nReceita Real: R$', parseFloat(updated.real_r || 0).toFixed(2));
    console.log('Clientes Real:', updated.cl_real);
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

corrigirDataEvento();