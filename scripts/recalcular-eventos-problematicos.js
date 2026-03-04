/**
 * Script para recalcular eventos problemáticos que dão timeout
 * Usa uma abordagem simplificada para eventos com muitos registros
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVENTOS_PROBLEMATICOS = [445, 389, 395];

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Calcula métricas de forma simplificada para eventos com muitos registros
 */
async function calcularEventoSimplificado(eventoId) {
  console.log(`\n🔄 Processando evento ${eventoId}...`);

  // 1. Buscar dados do evento
  const { data: evento, error: eventoError } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('id', eventoId)
    .single();

  if (eventoError || !evento) {
    console.error(`  ❌ Erro ao buscar evento: ${eventoError?.message}`);
    return false;
  }

  console.log(`  📅 Data: ${evento.data_evento} - ${evento.nome}`);

  try {
    // 2. Buscar dados agregados usando queries diretas (mais confiável)
    console.log(`  🔍 Buscando dados ContaHub Pagamentos...`);
    const { data: pagamentosRaw } = await supabase
      .from('contahub_pagamentos')
      .select('liquido')
      .eq('dt_gerencial', evento.data_evento)
      .eq('bar_id', evento.bar_id)
      .neq('meio', 'Conta Assinada');

    const total_liquido = pagamentosRaw?.reduce((sum, p) => sum + parseFloat(p.liquido || 0), 0) || 0;

    console.log(`  🔍 Buscando dados ContaHub Período...`);
    const { data: periodoRaw } = await supabase
      .from('contahub_periodo')
      .select('pessoas, vr_pagamentos, vr_couvert')
      .eq('dt_gerencial', evento.data_evento)
      .eq('bar_id', evento.bar_id);

    const total_pessoas = periodoRaw?.reduce((sum, p) => sum + parseInt(p.pessoas || 0), 0) || 0;
    const total_pessoas_pagantes =
      periodoRaw?.reduce((sum, p) => (parseFloat(p.vr_pagamentos || 0) > 0 ? sum + parseInt(p.pessoas || 0) : sum), 0) || 0;
    const total_couvert = periodoRaw?.reduce((sum, p) => sum + parseFloat(p.vr_couvert || 0), 0) || 0;
    const total_pagamentos = periodoRaw?.reduce((sum, p) => sum + parseFloat(p.vr_pagamentos || 0), 0) || 0;

    console.log(`  🔍 Buscando dados Nibo...`);
    const { data: niboRaw } = await supabase
      .from('nibo_agendamentos')
      .select('categoria_nome, valor')
      .eq('data_competencia', evento.data_evento);

    const custo_artistico =
      niboRaw?.reduce((sum, n) => (n.categoria_nome === 'Atrações Programação' ? sum + parseFloat(n.valor || 0) : sum), 0) || 0;
    const custo_producao =
      niboRaw?.reduce((sum, n) => (n.categoria_nome === 'Produção Eventos' ? sum + parseFloat(n.valor || 0) : sum), 0) || 0;

    console.log(`  🔍 Buscando dados ContaHub Analítico (pode demorar)...`);
    const { data: analiticoRaw } = await supabase
      .from('contahub_analitico')
      .select('loc_desc, valorfinal')
      .eq('trn_dtgerencial', evento.data_evento)
      .eq('bar_id', evento.bar_id);

    const categorias_bebidas = ['Chopp', 'Baldes', 'Pegue e Pague', 'PP', 'Venda Volante', 'Bar'];
    const categorias_comidas = ['Cozinha', 'Cozinha 1', 'Cozinha 2'];
    const categorias_drinks = ['Preshh', 'Drinks', 'Drinks Autorais', 'Mexido', 'Shot e Dose', 'Batidos'];

    const total_valorfinal = analiticoRaw?.reduce((sum, a) => sum + parseFloat(a.valorfinal || 0), 0) || 0;
    const valor_bebidas =
      analiticoRaw?.reduce((sum, a) => (categorias_bebidas.includes(a.loc_desc) ? sum + parseFloat(a.valorfinal || 0) : sum), 0) || 0;
    const valor_comidas =
      analiticoRaw?.reduce((sum, a) => (categorias_comidas.includes(a.loc_desc) ? sum + parseFloat(a.valorfinal || 0) : sum), 0) || 0;
    const valor_drinks =
      analiticoRaw?.reduce((sum, a) => (categorias_drinks.includes(a.loc_desc) ? sum + parseFloat(a.valorfinal || 0) : sum), 0) || 0;
    const valor_outros =
      analiticoRaw?.reduce(
        (sum, a) =>
          !categorias_bebidas.includes(a.loc_desc) &&
          !categorias_comidas.includes(a.loc_desc) &&
          !categorias_drinks.includes(a.loc_desc)
            ? sum + parseFloat(a.valorfinal || 0)
            : sum,
        0
      ) || 0;

    // Criar objetos compatíveis com o código existente
    const pagamentos = [{ total_liquido }];
    const periodo = [{ total_pessoas, total_pessoas_pagantes, total_couvert, total_pagamentos }];
    const nibo = [{ custo_artistico, custo_producao }];
    const analitico = [{ total_valorfinal, valor_bebidas, valor_comidas, valor_drinks, valor_outros }];

    // 3. Calcular métricas
    const pag = pagamentos?.[0] || {};
    const per = periodo?.[0] || {};
    const nib = nibo?.[0] || {};
    const ana = analitico?.[0] || {};

    const cl_real = parseInt(per.total_pessoas_pagantes) || 0;
    const real_r = parseFloat(pag.total_liquido) || 0;
    const te_real = cl_real > 0 ? (parseFloat(per.total_couvert) || 0) / cl_real : 0;
    const tb_real =
      cl_real > 0
        ? ((parseFloat(per.total_pagamentos) || 0) - (parseFloat(per.total_couvert) || 0)) / cl_real
        : 0;
    const t_medio = te_real + tb_real;
    const lot_max = evento.cl_plan > 0 ? Math.round(evento.cl_plan / 1.3) : 0;

    const total_valorfinal_calc = parseFloat(ana.total_valorfinal) || 0;
    const valor_bebidas_calc = parseFloat(ana.valor_bebidas) || 0;
    const valor_outros_calc = parseFloat(ana.valor_outros) || 0;
    const valor_comidas_calc = parseFloat(ana.valor_comidas) || 0;
    const valor_drinks_calc = parseFloat(ana.valor_drinks) || 0;

    const percent_b = total_valorfinal_calc > 0 ? ((valor_bebidas_calc + valor_outros_calc) / total_valorfinal_calc) * 100 : 0;
    const percent_c = total_valorfinal_calc > 0 ? (valor_comidas_calc / total_valorfinal_calc) * 100 : 0;
    const percent_d = total_valorfinal_calc > 0 ? (valor_drinks_calc / total_valorfinal_calc) * 100 : 0;

    const t_coz = cl_real > 0 ? valor_comidas_calc / cl_real : 0;
    const t_bar = cl_real > 0 ? (valor_bebidas_calc + valor_outros_calc) / cl_real : 0;

    const c_art = parseFloat(nib.custo_artistico) || 0;
    const c_prod = parseFloat(nib.custo_producao) || 0;
    const percent_art_fat = real_r > 0 ? ((c_art + c_prod) / real_r) * 100 : 0;

    console.log(`  💰 Real: R$ ${real_r.toFixed(2)} | Clientes: ${cl_real}`);
    console.log(`  🎨 C.Art: R$ ${c_art.toFixed(2)} | C.Prod: R$ ${c_prod.toFixed(2)}`);

    // 4. Atualizar evento
    console.log(`  💾 Atualizando evento...`);
    const { error: updateError } = await supabase
      .from('eventos_base')
      .update({
        cl_real,
        real_r,
        te_real,
        tb_real,
        t_medio,
        lot_max,
        percent_b,
        percent_c,
        percent_d,
        t_coz,
        t_bar,
        c_art,
        c_prod,
        percent_art_fat,
        calculado_em: new Date().toISOString(),
        precisa_recalculo: false,
        atualizado_em: new Date().toISOString(),
        versao_calculo: 1,
      })
      .eq('id', eventoId);

    if (updateError) {
      console.error(`  ❌ Erro ao atualizar: ${updateError.message}`);
      return false;
    }

    console.log(`  ✅ Evento ${eventoId} atualizado com sucesso!`);
    return true;
  } catch (error) {
    console.error(`  ❌ Erro ao processar evento: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando recálculo de eventos problemáticos...\n');
  console.log(`📋 Eventos a processar: ${EVENTOS_PROBLEMATICOS.join(', ')}\n`);

  let sucesso = 0;
  let erros = 0;

  for (const eventoId of EVENTOS_PROBLEMATICOS) {
    const resultado = await calcularEventoSimplificado(eventoId);
    if (resultado) {
      sucesso++;
    } else {
      erros++;
    }

    // Delay entre eventos
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Total processados: ${EVENTOS_PROBLEMATICOS.length}`);
  console.log(`✅ Sucesso: ${sucesso}`);
  console.log(`❌ Erros: ${erros}`);
  console.log('='.repeat(60));
}

// Executar
main()
  .then(() => {
    console.log('\n✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
