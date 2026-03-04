const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function verificarData() {
  try {
    await client.connect();
    
    console.log('Verificando data do evento 723...\n');
    
    const result = await client.query(`
      SELECT 
        data_evento,
        EXTRACT(dow FROM data_evento) as dia_semana,
        TO_CHAR(data_evento, 'Day') as nome_dia,
        bar_id
      FROM eventos_base
      WHERE id = 723
    `);
    
    const evento = result.rows[0];
    console.log('Data evento:', evento.data_evento);
    console.log('Dia da semana (0=domingo):', evento.dia_semana);
    console.log('Nome do dia:', evento.nome_dia);
    console.log('Bar ID:', evento.bar_id);
    
    console.log('\n\nTestando condição da função:');
    console.log('EXTRACT(dow FROM data_evento) = 0:', evento.dia_semana == 0 ? 'SIM (É DOMINGO)' : 'NÃO');
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

verificarData();