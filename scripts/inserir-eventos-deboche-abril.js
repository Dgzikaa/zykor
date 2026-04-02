const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let supabaseUrl, supabaseKey;
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ABRIL 2026 - DEBOCHE (bar_id = 4)
// Excluindo segundas-feiras (06/04, 13/04, 27/04) que têm M1 = 0
const eventosAbrilDeboche = [
  { data_evento: '2026-04-01', nome: 'Quarta Regular', dia_semana: 'QUARTA', m1_r: 4333.74 },
  { data_evento: '2026-04-02', nome: 'PRÉ FERIADO - DJ Rapha', dia_semana: 'QUINTA', m1_r: 15000.00 },
  { data_evento: '2026-04-03', nome: 'FERIADO - DJ Jay Lee', dia_semana: 'SEXTA', m1_r: 22150.21 },
  { data_evento: '2026-04-04', nome: 'Baile do DJ Mike', dia_semana: 'SÁBADO', m1_r: 23113.26 },
  { data_evento: '2026-04-05', nome: 'DJ Jess Ullun', dia_semana: 'DOMINGO', m1_r: 3370.68 },
  // 06/04 SEGUNDA - NÃO OPERA (M1 = 0)
  { data_evento: '2026-04-07', nome: 'Terça Regular', dia_semana: 'TERÇA', m1_r: 2407.63 },
  { data_evento: '2026-04-08', nome: 'Quarta Regular', dia_semana: 'QUARTA', m1_r: 4333.74 },
  { data_evento: '2026-04-09', nome: 'DJ Rapha', dia_semana: 'QUINTA', m1_r: 5778.32 },
  { data_evento: '2026-04-10', nome: 'DJ Jay Lee', dia_semana: 'SEXTA', m1_r: 22150.21 },
  { data_evento: '2026-04-11', nome: 'Baile do DJ Mike', dia_semana: 'SÁBADO', m1_r: 23113.26 },
  { data_evento: '2026-04-12', nome: 'DJ Cxxju', dia_semana: 'DOMINGO', m1_r: 3370.68 },
  // 13/04 SEGUNDA - NÃO OPERA (M1 = 0)
  { data_evento: '2026-04-14', nome: 'Terça Regular', dia_semana: 'TERÇA', m1_r: 2407.63 },
  { data_evento: '2026-04-15', nome: 'Quarta Regular', dia_semana: 'QUARTA', m1_r: 4333.74 },
  { data_evento: '2026-04-16', nome: 'DJ Rapha', dia_semana: 'QUINTA', m1_r: 5778.32 },
  { data_evento: '2026-04-17', nome: 'DJ Jay Lee', dia_semana: 'SEXTA', m1_r: 22150.21 },
  { data_evento: '2026-04-18', nome: 'Baile do DJ Mike', dia_semana: 'SÁBADO', m1_r: 23113.26 },
  { data_evento: '2026-04-19', nome: 'Pagode com Lucas Alves', dia_semana: 'DOMINGO', m1_r: 9000.00 },
  { data_evento: '2026-04-20', nome: 'PRÉ FERIADO - DJ Cxxju', dia_semana: 'SEGUNDA', m1_r: 6000.00 },
  { data_evento: '2026-04-21', nome: 'FERIADO - DJ Jess Ullun - Final BBB', dia_semana: 'TERÇA', m1_r: 5000.00 },
  { data_evento: '2026-04-22', nome: 'Quarta Regular', dia_semana: 'QUARTA', m1_r: 4333.74 },
  { data_evento: '2026-04-23', nome: 'DJ Rapha', dia_semana: 'QUINTA', m1_r: 5778.32 },
  { data_evento: '2026-04-24', nome: 'DJ Jay Lee', dia_semana: 'SEXTA', m1_r: 22150.21 },
  { data_evento: '2026-04-25', nome: 'Baile do DJ Mike', dia_semana: 'SÁBADO', m1_r: 23113.26 },
  { data_evento: '2026-04-26', nome: 'DJ Cxxju', dia_semana: 'DOMINGO', m1_r: 3370.68 },
  // 27/04 SEGUNDA - NÃO OPERA (M1 = 0)
  { data_evento: '2026-04-28', nome: 'Terça Regular', dia_semana: 'TERÇA', m1_r: 2407.63 },
  { data_evento: '2026-04-29', nome: 'Quarta Regular', dia_semana: 'QUARTA', m1_r: 4333.74 },
  { data_evento: '2026-04-30', nome: 'PRÉ-FERIADO - DJ Rapha', dia_semana: 'QUINTA', m1_r: 15000.00 }
];

async function inserirEventosDeboche() {
  console.log('📅 Inserindo eventos de Abril 2026 - DEBOCHE (bar_id=4)...\n');
  console.log(`   Total: ${eventosAbrilDeboche.length} eventos`);
  console.log('   (Excluindo segundas-feiras 06/04, 13/04 e 27/04 que não operam)\n');

  const eventosParaInserir = eventosAbrilDeboche.map(evento => ({
    bar_id: 4, // Deboche
    data_evento: evento.data_evento,
    nome: evento.nome,
    dia_semana: evento.dia_semana,
    m1_r: evento.m1_r,
    ativo: true,
    precisa_recalculo: false,
    versao_calculo: 1
  }));

  let inseridos = 0;
  let atualizados = 0;
  let erros = 0;

  for (const evento of eventosParaInserir) {
    const { data: existente } = await supabase
      .from('eventos_base')
      .select('id')
      .eq('bar_id', evento.bar_id)
      .eq('data_evento', evento.data_evento)
      .eq('nome', evento.nome)
      .single();

    if (existente) {
      const { error } = await supabase
        .from('eventos_base')
        .update(evento)
        .eq('id', existente.id);

      if (error) {
        console.error(`❌ Erro ao atualizar ${evento.data_evento}:`, error.message);
        erros++;
      } else {
        atualizados++;
      }
    } else {
      const { error } = await supabase
        .from('eventos_base')
        .insert(evento);

      if (error) {
        console.error(`❌ Erro ao inserir ${evento.data_evento}:`, error.message);
        erros++;
      } else {
        inseridos++;
      }
    }
  }

  console.log('\n✅ Operação concluída!');
  console.log(`   Inseridos: ${inseridos} eventos`);
  console.log(`   Atualizados: ${atualizados} eventos`);
  if (erros > 0) {
    console.log(`   ⚠️  Erros: ${erros} eventos`);
  }
  console.log('\n📊 Abril 2026 - Deboche: 27 eventos (30 dias - 3 segundas que não operam)');
  console.log('\n🔗 Acesse: http://localhost:3001/estrategico/planejamento-comercial');
  console.log('   Selecione "Deboche" no seletor de bar');
}

inserirEventosDeboche();
