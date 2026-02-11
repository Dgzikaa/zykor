/**
 * Edge Function: CMV Semanal Automático
 * 
 * Roda diariamente para criar/atualizar CMV da semana
 * AUTO: Faturamento (ContaHub), Compras (NIBO), Consumações (ContaHub catch-all)
 * MANUAL: Estoques (Excel), Bonificações, CMV Teórico %, Outros Ajustes, RH
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== UTILS ====================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

function getWeekDates(date: Date): { inicio: string; fim: string } {
  const dayOfWeek = date.getDay();
  const primeiroDia = new Date(date);
  const diasParaSegunda = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  primeiroDia.setDate(date.getDate() + diasParaSegunda);
  const ultimoDia = new Date(primeiroDia);
  ultimoDia.setDate(primeiroDia.getDate() + 6);
  return {
    inicio: primeiroDia.toISOString().split('T')[0],
    fim: ultimoDia.toISOString().split('T')[0]
  };
}

async function fetchAllWithPagination(baseQuery: any) {
  let allRecords: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data: batch } = await baseQuery.range(from, from + batchSize - 1);
    if (batch && batch.length > 0) {
      allRecords = allRecords.concat(batch);
      from += batchSize;
      hasMore = batch.length === batchSize;
    } else {
      hasMore = false;
    }
  }
  return allRecords;
}

// ==================== CATEGORIZAÇÃO DE CONSUMOS ====================

// Nomes dos sócios (lowercase)
const NOMES_SOCIOS = ['diogo', 'diego', 'rodrigo', 'cadu', 'corbal', 'gonza', 'augusto', 'vini', 'lg'];

// Padrões para cada categoria
function isSocio(motivo: string): boolean {
  if (motivo.includes('sócio') || motivo.includes('socio')) return true;
  // "Consuma diogo", "Consuma rodrigo", etc.
  for (const nome of NOMES_SOCIOS) {
    if (motivo.includes(nome)) return true;
  }
  return false;
}

function isBeneficio(motivo: string): boolean {
  return motivo.includes('aniversário') || motivo.includes('aniversario') ||
         motivo.includes('aniversariante') || motivo.includes('benefício') ||
         motivo.includes('beneficio') || motivo.includes('confraternização') ||
         motivo.includes('confraternizacao') || motivo.includes('influenc');
}

function isADM(motivo: string): boolean {
  if (motivo.includes('funcionário') || motivo.includes('funcionario')) return true;
  if (motivo.includes('marketing') || motivo.includes('mkt')) return true;
  if (motivo.includes(' adm') || motivo.startsWith('adm')) return true;
  if (motivo.includes(' casa') || motivo.startsWith('casa')) return true;
  if (motivo.includes(' prod ') || motivo.startsWith('prod ')) return true;
  // Nomes de staff conhecidos
  const staffNames = ['mafe', 'andreia', 'andréia', 'isaias', 'lucia', 'lúcia', 'ana mkt', 'dani mkt', 'ana prod', 'aninha'];
  for (const nome of staffNames) {
    if (motivo.includes(nome)) return true;
  }
  return false;
}

function isRH(motivo: string): boolean {
  return motivo === 'rh' || motivo.includes('recursos humanos');
}

function isIgnorado(motivo: string): boolean {
  return motivo.includes('arredondamento') || motivo === 'teste' ||
         motivo === 'ambev' || motivo === 'caesen' ||
         motivo === 'pv' || motivo === 'slu' ||
         motivo.startsWith('slu');
}

// ==================== BUSCA DE DADOS AUTOMÁTICOS ====================

async function buscarDadosAutomaticos(supabase: any, barId: number, dataInicio: string, dataFim: string) {
  console.log(`\n🔍 Buscando dados automáticos de ${dataInicio} até ${dataFim} (bar_id: ${barId})`);
  
  const resultado: any = {
    total_consumo_socios: 0,
    mesa_beneficios_cliente: 0,
    mesa_banda_dj: 0,
    chegadeira: 0,
    mesa_adm_casa: 0,
    mesa_rh: 0,
    compras_custo_comida: 0,
    compras_custo_bebidas: 0,
    compras_custo_outros: 0,
    compras_custo_drinks: 0,
    faturamento_cmvivel: 0,
    vendas_brutas: 0,
    vendas_liquidas: 0,
  };

  // ========== 1. CONSUMAÇÕES (query única + categorização catch-all) ==========
  try {
    // Buscar TODOS os registros com desconto e motivo preenchido
    const registrosConsumo = await fetchAllWithPagination(
      supabase
        .from('contahub_periodo')
        .select('vr_desconto, motivo')
        .eq('bar_id', barId)
        .gte('dt_gerencial', dataInicio)
        .lte('dt_gerencial', dataFim)
        .neq('vr_desconto', 0)
        .neq('motivo', '')
    );

    if (registrosConsumo && registrosConsumo.length > 0) {
      let countSocio = 0, countBeneficio = 0, countBanda = 0, countADM = 0, countRH = 0, countIgn = 0;

      for (const reg of registrosConsumo) {
        const m = (reg.motivo || '').toLowerCase().trim();
        const desc = Math.abs(parseFloat(reg.vr_desconto) || 0);
        if (desc === 0 || !m) continue;

        if (isSocio(m)) {
          resultado.total_consumo_socios += desc;
          countSocio++;
        } else if (isBeneficio(m)) {
          resultado.mesa_beneficios_cliente += desc;
          countBeneficio++;
        } else if (isADM(m)) {
          resultado.mesa_adm_casa += desc;
          countADM++;
        } else if (isRH(m)) {
          resultado.mesa_rh += desc;
          countRH++;
        } else if (isIgnorado(m)) {
          countIgn++;
          // Skip
        } else {
          // CATCH-ALL: Banda/DJ/Artista
          resultado.mesa_banda_dj += desc;
          countBanda++;
        }
      }

      console.log(`✅ Consumos categorizados (${registrosConsumo.length} registros com desconto):`);
      console.log(`   Sócios: R$ ${resultado.total_consumo_socios.toFixed(2)} (${countSocio})`);
      console.log(`   Benefícios: R$ ${resultado.mesa_beneficios_cliente.toFixed(2)} (${countBeneficio})`);
      console.log(`   Banda/DJ: R$ ${resultado.mesa_banda_dj.toFixed(2)} (${countBanda})`);
      console.log(`   ADM/Func: R$ ${resultado.mesa_adm_casa.toFixed(2)} (${countADM})`);
      console.log(`   RH: R$ ${resultado.mesa_rh.toFixed(2)} (${countRH})`);
      console.log(`   Ignorados: ${countIgn}`);
    }
  } catch (err) {
    console.error('Erro ao buscar consumos:', err);
  }

  // ========== 2. FATURAMENTO (ContaHub) ==========
  try {
    const faturamento = await fetchAllWithPagination(
      supabase
        .from('contahub_periodo')
        .select('vr_repique, vr_pagamentos, vr_couvert')
        .eq('bar_id', barId)
        .gte('dt_gerencial', dataInicio)
        .lte('dt_gerencial', dataFim)
    );
    console.log(`📊 Registros faturamento: ${faturamento?.length || 0}`);

    if (faturamento) {
      resultado.vendas_brutas = faturamento.reduce((sum: number, item: any) => 
        sum + (parseFloat(item.vr_pagamentos) || 0), 0
      );
      const totalCouvert = faturamento.reduce((sum: number, item: any) => 
        sum + (parseFloat(item.vr_couvert) || 0), 0
      );
      const totalGorjeta = faturamento.reduce((sum: number, item: any) => 
        sum + (parseFloat(item.vr_repique) || 0), 0
      );
      // Faturamento Limpo = Bruto - Couvert - Gorjeta
      resultado.vendas_liquidas = resultado.vendas_brutas - totalCouvert - totalGorjeta;
      resultado.faturamento_cmvivel = resultado.vendas_liquidas;

      console.log(`✅ Fat. Bruto: R$ ${resultado.vendas_brutas.toFixed(2)}`);
      console.log(`✅ Fat. Limpo: R$ ${resultado.vendas_liquidas.toFixed(2)} (- couvert R$ ${totalCouvert.toFixed(2)} - gorjeta R$ ${totalGorjeta.toFixed(2)})`);
    }
  } catch (err) {
    console.error('Erro ao buscar faturamento:', err);
  }

  // ========== 3. COMPRAS DO NIBO (data_competencia) ==========
  try {
    const comprasNibo = await fetchAllWithPagination(
      supabase
        .from('nibo_agendamentos')
        .select('categoria_nome, valor')
        .eq('bar_id', barId)
        .eq('tipo', 'Debit')
        .gte('data_competencia', dataInicio)
        .lte('data_competencia', dataFim)
    );

    if (comprasNibo) {
      // Usar filtro case-insensitive para pegar todas as variações
      resultado.compras_custo_comida = comprasNibo
        .filter((item: any) => (item.categoria_nome || '').toUpperCase().includes('CUSTO COMIDA'))
        .reduce((sum: number, item: any) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

      resultado.compras_custo_bebidas = comprasNibo
        .filter((item: any) => (item.categoria_nome || '').toUpperCase().includes('CUSTO BEBIDA'))
        .reduce((sum: number, item: any) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

      resultado.compras_custo_drinks = comprasNibo
        .filter((item: any) => (item.categoria_nome || '').toUpperCase().includes('CUSTO DRINK'))
        .reduce((sum: number, item: any) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

      resultado.compras_custo_outros = comprasNibo
        .filter((item: any) => (item.categoria_nome || '').toUpperCase().includes('CUSTO OUTRO'))
        .reduce((sum: number, item: any) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

      const totalCompras = resultado.compras_custo_comida + resultado.compras_custo_bebidas + resultado.compras_custo_drinks + resultado.compras_custo_outros;
      console.log(`✅ Compras: Cozinha R$ ${resultado.compras_custo_comida.toFixed(2)} | Bebidas R$ ${resultado.compras_custo_bebidas.toFixed(2)} | Drinks R$ ${resultado.compras_custo_drinks.toFixed(2)} | Outros R$ ${resultado.compras_custo_outros.toFixed(2)} | TOTAL R$ ${totalCompras.toFixed(2)}`);
    }
  } catch (err) {
    console.error('Erro ao buscar compras NIBO:', err);
  }

  // NOTA: Estoques NÃO são buscados automaticamente - são manuais (vêm do Excel)

  return resultado;
}

// ==================== CÁLCULO CMV ====================

function calcularCMV(dados: any) {
  // Consumos (% CMV sobre valor bruto do desconto)
  dados.consumo_socios = (dados.total_consumo_socios || 0) * 0.35;
  dados.consumo_beneficios = ((dados.mesa_beneficios_cliente || 0) + (dados.chegadeira || 0)) * 0.33;
  dados.consumo_adm = (dados.mesa_adm_casa || 0) * 0.35;
  dados.consumo_artista = (dados.mesa_banda_dj || 0) * 0.35;
  
  // Estoques (totais dos sub-campos)
  dados.estoque_inicial = (dados.estoque_inicial_cozinha || 0) + 
                          (dados.estoque_inicial_bebidas || 0) + 
                          (dados.estoque_inicial_drinks || 0);
  dados.estoque_final = (dados.estoque_final_cozinha || 0) + 
                         (dados.estoque_final_bebidas || 0) + 
                         (dados.estoque_final_drinks || 0);
  
  // Compras
  dados.compras_periodo = (dados.compras_custo_comida || 0) + 
                          (dados.compras_custo_bebidas || 0) + 
                          (dados.compras_custo_outros || 0) + 
                          (dados.compras_custo_drinks || 0);
  
  // Bonificações
  dados.ajuste_bonificacoes = (dados.bonificacao_contrato_anual || 0) + 
                               (dados.bonificacao_cashback_mensal || 0);
  
  // CMV Real = Est Inicial + Compras - Est Final - Consumos + Bonificações
  const cmvBruto = (dados.estoque_inicial || 0) + 
                   (dados.compras_periodo || 0) - 
                   (dados.estoque_final || 0);
  const totalConsumos = (dados.consumo_socios || 0) + 
                        (dados.consumo_beneficios || 0) + 
                        (dados.consumo_adm || 0) + 
                        (dados.consumo_rh || 0) + 
                        (dados.consumo_artista || 0) + 
                        (dados.outros_ajustes || 0);
  dados.cmv_real = cmvBruto - totalConsumos + (dados.ajuste_bonificacoes || 0);
  
  // CMV Limpo % = CMV R$ / Faturamento CMVível (líquido, usado para meta)
  if ((dados.faturamento_cmvivel || 0) > 0) {
    dados.cmv_limpo_percentual = ((dados.cmv_real || 0) / (dados.faturamento_cmvivel || 1)) * 100;
  } else {
    dados.cmv_limpo_percentual = 0;
  }

  // CMV Real % = CMV R$ / Faturamento Bruto (conforme planilha)
  const fatBruto = dados.vendas_brutas || dados.faturamento_bruto || 0;
  dados.cmv_percentual = fatBruto > 0 ? ((dados.cmv_real || 0) / fatBruto) * 100 : 0;
  
  // Gap
  dados.gap = (dados.cmv_limpo_percentual || 0) - (dados.cmv_teorico_percentual || 0);
  
  return dados;
}

// ==================== HANDLER PRINCIPAL ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 CMV Semanal Automático...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const body = await req.json().catch(() => ({}));
    const offsetSemanas = body.offsetSemanas !== undefined ? body.offsetSemanas : -1;
    const barIdParam = body.bar_id;
    
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + (offsetSemanas * 7));
    const ano = getISOYear(hoje);
    const semana = getWeekNumber(hoje);
    const { inicio, fim } = getWeekDates(hoje);
    
    console.log(`📅 Ano ${ano}, Semana ${semana} (${inicio} - ${fim})`);
    
    // Buscar bares
    let baresParaProcessar: { id: number; nome: string }[] = [];
    if (barIdParam) {
      const { data: bar } = await supabase.from('bars').select('id, nome').eq('id', barIdParam).single();
      if (bar) baresParaProcessar = [bar];
    } else {
      const { data: bares } = await supabase.from('bars').select('id, nome').eq('ativo', true);
      baresParaProcessar = bares || [];
    }
    
    console.log(`🏪 ${baresParaProcessar.length} bar(es)`);
    const resultados: any[] = [];
    
    for (const bar of baresParaProcessar) {
      const barId = bar.id;
      console.log(`\n🏪 ${bar.nome} (bar_id: ${barId})`);
      
      try {
        // Buscar dados automáticos (faturamento, compras, consumos - SEM estoques)
        const dadosAuto = await buscarDadosAutomaticos(supabase, barId, inicio, fim);
        
        // Buscar registro existente para preservar campos manuais
        const { data: existente } = await supabase
          .from('cmv_semanal')
          .select('*')
          .eq('bar_id', barId)
          .eq('ano', ano)
          .eq('semana', semana)
          .single();
        
        // Montar CMV: dados automáticos + campos manuais preservados
        let cmvData: any = {
          bar_id: barId,
          ano,
          semana,
          data_inicio: inicio,
          data_fim: fim,
          // Dados automáticos (faturamento, compras, consumos)
          ...dadosAuto,
          // ESTOQUES: manuais - preservar valores existentes
          estoque_inicial_cozinha: existente?.estoque_inicial_cozinha || 0,
          estoque_inicial_bebidas: existente?.estoque_inicial_bebidas || 0,
          estoque_inicial_drinks: existente?.estoque_inicial_drinks || 0,
          estoque_final_cozinha: existente?.estoque_final_cozinha || 0,
          estoque_final_bebidas: existente?.estoque_final_bebidas || 0,
          estoque_final_drinks: existente?.estoque_final_drinks || 0,
          // Campos manuais preservados
          consumo_rh: existente?.consumo_rh || 0,
          outros_ajustes: existente?.outros_ajustes || 0,
          bonificacao_contrato_anual: existente?.bonificacao_contrato_anual || 0,
          bonificacao_cashback_mensal: existente?.bonificacao_cashback_mensal || 0,
          cmv_teorico_percentual: existente?.cmv_teorico_percentual || 33,
          status: existente?.status || 'rascunho',
          responsavel: 'Sistema Automático',
          updated_at: new Date().toISOString()
        };
        
        // Calcular CMV
        cmvData = calcularCMV(cmvData);
        
        console.log(`📊 ${bar.nome}: Fat R$ ${cmvData.vendas_brutas.toFixed(0)} | Compras R$ ${cmvData.compras_periodo.toFixed(0)} | CMV R$ ${cmvData.cmv_real.toFixed(0)} (${cmvData.cmv_limpo_percentual.toFixed(1)}%)`);
        
        // Salvar
        const { error } = await supabase
          .from('cmv_semanal')
          .upsert(cmvData, { onConflict: 'bar_id,ano,semana' })
          .select()
          .single();
        if (error) throw error;
        
        resultados.push({
          bar_id: barId, bar_nome: bar.nome, success: true,
          vendas_brutas: cmvData.vendas_brutas,
          compras_periodo: cmvData.compras_periodo,
          total_consumo_socios: cmvData.total_consumo_socios,
          mesa_banda_dj: cmvData.mesa_banda_dj,
          mesa_beneficios_cliente: cmvData.mesa_beneficios_cliente,
          mesa_adm_casa: cmvData.mesa_adm_casa,
          cmv_real: cmvData.cmv_real,
          cmv_limpo_percentual: cmvData.cmv_limpo_percentual
        });
        
      } catch (barError: any) {
        console.error(`❌ ${bar.nome}:`, barError.message);
        resultados.push({ bar_id: barId, bar_nome: bar.nome, success: false, error: barError.message });
      }
    }

    const sucessos = resultados.filter(r => r.success).length;
    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV Semana ${semana}/${ano}: ${sucessos}/${baresParaProcessar.length} ok`,
        ano, semana, periodo: { inicio, fim }, resultados
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
