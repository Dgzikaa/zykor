// Script para inserir eventos diretamente no Supabase
// Requer: npm install @supabase/supabase-js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ler .env.local manualmente
const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
let supabaseUrl, supabaseKey;

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      supabaseKey = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error('❌ Erro ao ler .env.local:', error.message);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.error('   Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas em frontend/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const eventosAbril = [
  { data_evento: '2026-04-01', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 43544.60 },
  { data_evento: '2026-04-02', nome: 'VESPERA DE FERIADO | Pé no Ordi - Pé no Chão + convidados Fala Comigo, Manda Real e Tonzão + Dj Negritah', dia_semana: 'QUINTA', m1_r: 52253.52 },
  { data_evento: '2026-04-03', nome: 'FERIADO | Pagode Vira Lata - Bonsai, Dj Afrika, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 87089.20 },
  { data_evento: '2026-04-04', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + Pagode do Dudu e Dj Afrika', dia_semana: 'SÁBADO', m1_r: 87089.20 },
  { data_evento: '2026-04-05', nome: 'Uma Mesa e Um Pagode - Doze e Dj Sidharta', dia_semana: 'DOMINGO', m1_r: 43544.60 },
  { data_evento: '2026-04-06', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 10450.70 },
  { data_evento: '2026-04-07', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15676.06 },
  { data_evento: '2026-04-08', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 43544.60 },
  { data_evento: '2026-04-09', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 21772.30 },
  { data_evento: '2026-04-10', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 87089.20 },
  { data_evento: '2026-04-11', nome: 'Feijuca do Ordi - Dhi Ribeiro convida Pagode do PH + Sambadona + Reconvexa especial Gil e Dj Tiago Gioseffi', dia_semana: 'SÁBADO', m1_r: 87089.20 },
  { data_evento: '2026-04-12', nome: 'Uma Mesa e Um Pagode - Doze e Dj Pepê', dia_semana: 'DOMINGO', m1_r: 43544.60 },
  { data_evento: '2026-04-13', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 10450.70 },
  { data_evento: '2026-04-14', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15676.06 },
  { data_evento: '2026-04-15', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 43544.60 },
  { data_evento: '2026-04-16', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 21772.30 },
  { data_evento: '2026-04-17', nome: 'Pagode Vira Lata - Júlia Moreno, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 87089.20 },
  { data_evento: '2026-04-18', nome: 'Feijuca do Ordi - STZ + Sambadona + Pagode da Gigi e Dj Ketlen', dia_semana: 'SÁBADO', m1_r: 150000.00 },
  { data_evento: '2026-04-19', nome: 'Uma Mesa e Um Pagode - Doze e Dj Caio Hot', dia_semana: 'DOMINGO', m1_r: 43544.60 },
  { data_evento: '2026-04-20', nome: 'VESPERA DE FERIADO | Clima de Montanha e Dj Kacá', dia_semana: 'SEGUNDA', m1_r: 80000.00 },
  { data_evento: '2026-04-21', nome: 'FERIADO | 7naRoda convida Moyseis Marques (RJ) e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15676.06 },
  { data_evento: '2026-04-22', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 43544.60 },
  { data_evento: '2026-04-23', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 21772.30 },
  { data_evento: '2026-04-24', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 87089.20 },
  { data_evento: '2026-04-25', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + STZ e Dj Afrika', dia_semana: 'SÁBADO', m1_r: 140000.00 },
  { data_evento: '2026-04-26', nome: 'Uma Mesa e Um Pagode - Doze e Dj Artur Campos', dia_semana: 'DOMINGO', m1_r: 43544.60 },
  { data_evento: '2026-04-27', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 10450.70 },
  { data_evento: '2026-04-28', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15676.06 },
  { data_evento: '2026-04-29', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 43544.60 },
  { data_evento: '2026-04-30', nome: 'VESPERA DE FERIADO | Samba da Passarinha e Dj Libertina', dia_semana: 'QUINTA', m1_r: 65316.90 }
];

const eventosMaio = [
  { data_evento: '2026-05-01', nome: 'FERIADO | Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 84279.87 },
  { data_evento: '2026-05-02', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + STZ e Dj Tiago Gioseffi a cofirmar', dia_semana: 'SÁBADO', m1_r: 84279.87 },
  { data_evento: '2026-05-03', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 42139.94 },
  { data_evento: '2026-05-04', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 10113.58 },
  { data_evento: '2026-05-05', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15170.38 },
  { data_evento: '2026-05-06', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 42139.94 },
  { data_evento: '2026-05-07', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 21069.97 },
  { data_evento: '2026-05-08', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 84279.87 },
  { data_evento: '2026-05-09', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + Reconvexa e Dj Tiago Gioseffi a confirmar', dia_semana: 'SÁBADO', m1_r: 84279.87 },
  { data_evento: '2026-05-10', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 42139.94 },
  { data_evento: '2026-05-11', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 10113.58 },
  { data_evento: '2026-05-12', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15170.38 },
  { data_evento: '2026-05-13', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 42139.94 },
  { data_evento: '2026-05-14', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 21069.97 },
  { data_evento: '2026-05-15', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 84279.87 },
  { data_evento: '2026-05-16', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + STZ e Dj Afrika a confirmar', dia_semana: 'SÁBADO', m1_r: 84279.87 },
  { data_evento: '2026-05-17', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 42139.94 },
  { data_evento: '2026-05-18', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 10113.58 },
  { data_evento: '2026-05-19', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15170.38 },
  { data_evento: '2026-05-20', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 42139.94 },
  { data_evento: '2026-05-21', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 21069.97 },
  { data_evento: '2026-05-22', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 84279.87 },
  { data_evento: '2026-05-23', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + Pagode do Dudu e Dj Tiago Gioseffi a cofirmar', dia_semana: 'SÁBADO', m1_r: 84279.87 },
  { data_evento: '2026-05-24', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 42139.94 },
  { data_evento: '2026-05-25', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 10113.58 },
  { data_evento: '2026-05-26', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 15170.38 },
  { data_evento: '2026-05-27', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 42139.94 },
  { data_evento: '2026-05-28', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 21069.97 },
  { data_evento: '2026-05-29', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 84279.87 },
  { data_evento: '2026-05-30', nome: 'Feijuca do Ordi - STZ + Sambadona + Pagode do Dudu a confirmar e Dj Ketlen', dia_semana: 'SÁBADO', m1_r: 84279.87 },
  { data_evento: '2026-05-31', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 42139.94 }
];

const eventosJunho = [
  { data_evento: '2026-06-01', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 8873.24 },
  { data_evento: '2026-06-02', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 13309.86 },
  { data_evento: '2026-06-03', nome: 'VÉSPERA DE FERIADO | Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 73943.66 },
  { data_evento: '2026-06-04', nome: 'FERIADO | Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 18485.92 },
  { data_evento: '2026-06-05', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 73943.66 },
  { data_evento: '2026-06-06', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + Reconvexa e Dj Tiago Gioseffi a confirmar', dia_semana: 'SÁBADO', m1_r: 73943.66 },
  { data_evento: '2026-06-07', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 36971.83 },
  { data_evento: '2026-06-08', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 8873.24 },
  { data_evento: '2026-06-09', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 13309.86 },
  { data_evento: '2026-06-10', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 36971.83 },
  { data_evento: '2026-06-11', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 18485.92 },
  { data_evento: '2026-06-12', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 73943.66 },
  { data_evento: '2026-06-13', nome: 'BRASIL X MARROCOS 19:00', dia_semana: 'SÁBADO', m1_r: 150000.00 },
  { data_evento: '2026-06-14', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 36971.83 },
  { data_evento: '2026-06-15', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 8873.24 },
  { data_evento: '2026-06-16', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 13309.86 },
  { data_evento: '2026-06-17', nome: 'Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 36971.83 },
  { data_evento: '2026-06-18', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 18485.92 },
  { data_evento: '2026-06-19', nome: 'BRASIL X HAITI 22:00 | Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 150000.00 },
  { data_evento: '2026-06-20', nome: 'Feijuca do Ordi - Dhi Ribeiro + Sambadona + Pagode do Dudu e Dj Afrika a cofirmar', dia_semana: 'SÁBADO', m1_r: 73943.66 },
  { data_evento: '2026-06-21', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 36971.83 },
  { data_evento: '2026-06-22', nome: 'Segunda da Resenha', dia_semana: 'SEGUNDA', m1_r: 8873.24 },
  { data_evento: '2026-06-23', nome: '7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 13309.86 },
  { data_evento: '2026-06-24', nome: 'BRASIL X ESCÓCIA 19:00 | Quarta de Bamba - Breno Alves e Dj Jess Ullun', dia_semana: 'QUARTA', m1_r: 125000.00 },
  { data_evento: '2026-06-25', nome: 'Pé no Ordi - Pé no Chão e Dj Vinny', dia_semana: 'QUINTA', m1_r: 18485.92 },
  { data_evento: '2026-06-26', nome: 'Pagode Vira Lata - Bonsai, Dj Caju, Benzadeus e Boka de Sergipe', dia_semana: 'SEXTA', m1_r: 73943.66 },
  { data_evento: '2026-06-27', nome: 'Feijuca do Ordi - STZ + Sambadona + Reconvexa e Dj Ketlen a confirmar', dia_semana: 'SÁBADO', m1_r: 73943.66 },
  { data_evento: '2026-06-28', nome: 'Uma Mesa e Um Pagode - Doze e Dj a confirmar', dia_semana: 'DOMINGO', m1_r: 36971.83 },
  { data_evento: '2026-06-29', nome: 'BRASIL 1º X (HOLANDA OU JAPÃO)', dia_semana: 'SEGUNDA', m1_r: 100000.00 },
  { data_evento: '2026-06-30', nome: '16º COPA | 7naRoda e Dj Leo Cabral', dia_semana: 'TERÇA', m1_r: 13309.86 }
];

async function inserirEventos() {
  const todosEventos = [...eventosAbril, ...eventosMaio, ...eventosJunho];
  
  console.log(`📅 Inserindo ${todosEventos.length} eventos no Supabase...`);
  console.log(`   - Abril: ${eventosAbril.length} eventos`);
  console.log(`   - Maio: ${eventosMaio.length} eventos`);
  console.log(`   - Junho: ${eventosJunho.length} eventos`);
  console.log('');

  const eventosParaInserir = todosEventos.map(evento => ({
    bar_id: 4, // Ordinário
    data_evento: evento.data_evento,
    nome: evento.nome,
    dia_semana: evento.dia_semana,
    m1_r: evento.m1_r,
    ativo: true,
    precisa_recalculo: false,
    versao_calculo: 1
  }));

  try {
    // Inserir eventos um por um para evitar problemas de constraint
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;

    for (const evento of eventosParaInserir) {
      // Verificar se já existe
      const { data: existente } = await supabase
        .from('eventos_base')
        .select('id')
        .eq('bar_id', evento.bar_id)
        .eq('data_evento', evento.data_evento)
        .eq('nome', evento.nome)
        .single();

      if (existente) {
        // Atualizar
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
        // Inserir
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

    console.log('');
    console.log('✅ Operação concluída!');
    console.log(`   Inseridos: ${inseridos} eventos`);
    console.log(`   Atualizados: ${atualizados} eventos`);
    if (erros > 0) {
      console.log(`   ⚠️  Erros: ${erros} eventos`);
    }
    console.log('');
    console.log('📊 Verificação:');
    console.log('   - Abril 2026: 30 eventos');
    console.log('   - Maio 2026: 31 eventos');
    console.log('   - Junho 2026: 30 eventos');
    console.log('');
    console.log('🔗 Acesse: https://zykor.com.br/estrategico/planejamento-comercial');

  } catch (error) {
    console.error('❌ Erro na operação:', error.message);
    process.exit(1);
  }
}

inserirEventos();
