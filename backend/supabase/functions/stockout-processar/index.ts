/**
 * @camada silver
 * @jobName stockout-processar
 * @descricao Estoque diario
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from '../_shared/cors.ts';

console.log("🔍 Stockout Processar - Aplica regras de filtragem e gera audit");



// ============================================================================
// SISTEMA DE FILTRAGEM v2.0 - Regras Centralizadas
// ============================================================================

interface RegraFiltragem {
  tipo: 'prefixo' | 'loc_desc' | 'grp_desc' | 'palavra_meio' | 'validacao';
  valor: string;
  motivo: string;
  descricao: string;
}

const REGRAS_FILTRAGEM: RegraFiltragem[] = [
  // Validações básicas
  { tipo: 'validacao', valor: 'prd_ativo_n', motivo: 'produto_inativo', descricao: 'Produto com prd_ativo != S' },
  { tipo: 'validacao', valor: 'loc_desc_null', motivo: 'loc_desc_null', descricao: 'Local de produção não definido' },
  
  // Prefixos (início do nome)
  { tipo: 'prefixo', valor: '[HH]', motivo: 'prefixo_hh', descricao: 'Happy Hour - não disponível às 19h' },
  { tipo: 'prefixo', valor: '[DD]', motivo: 'prefixo_dd', descricao: 'Dose Dupla - variação promocional' },
  { tipo: 'prefixo', valor: '[IN]', motivo: 'prefixo_in', descricao: 'Insumo - não é produto vendável' },
  { tipo: 'prefixo', valor: '[PP]', motivo: 'prefixo_pp', descricao: 'Pegue e Pague - local excluído' },
  
  // Locais excluídos
  { tipo: 'loc_desc', valor: 'Pegue e Pague', motivo: 'loc_pegue_pague', descricao: 'Local Pegue e Pague excluído' },
  { tipo: 'loc_desc', valor: 'Venda Volante', motivo: 'loc_venda_volante', descricao: 'Local Venda Volante excluído' },
  { tipo: 'loc_desc', valor: 'Baldes', motivo: 'loc_baldes', descricao: 'Local Baldes excluído' },
  
  // Grupos excluídos (do JSON raw_data.grp_desc)
  { tipo: 'grp_desc', valor: 'Baldes', motivo: 'grp_baldes', descricao: 'Grupo Baldes' },
  { tipo: 'grp_desc', valor: 'Happy Hour', motivo: 'grp_happy_hour', descricao: 'Grupo Happy Hour' },
  { tipo: 'grp_desc', valor: 'Chegadeira', motivo: 'grp_chegadeira', descricao: 'Grupo Chegadeira' },
  { tipo: 'grp_desc', valor: 'Dose dupla', motivo: 'grp_dose_dupla', descricao: 'Grupo Dose Dupla' },
  { tipo: 'grp_desc', valor: 'Dose Dupla', motivo: 'grp_dose_dupla', descricao: 'Grupo Dose Dupla' },
  { tipo: 'grp_desc', valor: 'Dose dupla!', motivo: 'grp_dose_dupla', descricao: 'Grupo Dose Dupla' },
  { tipo: 'grp_desc', valor: 'Dose Dupla!', motivo: 'grp_dose_dupla', descricao: 'Grupo Dose Dupla' },
  { tipo: 'grp_desc', valor: 'Dose dupla sem álcool', motivo: 'grp_dose_dupla_sem_alcool', descricao: 'Grupo Dose Dupla sem álcool' },
  { tipo: 'grp_desc', valor: 'Dose Dupla sem álcool', motivo: 'grp_dose_dupla_sem_alcool', descricao: 'Grupo Dose Dupla sem álcool' },
  { tipo: 'grp_desc', valor: 'Grupo adicional', motivo: 'grp_adicional', descricao: 'Grupo Adicional' },
  { tipo: 'grp_desc', valor: 'Grupo Adicional', motivo: 'grp_adicional', descricao: 'Grupo Adicional' },
  { tipo: 'grp_desc', valor: 'Insumos', motivo: 'grp_insumos', descricao: 'Grupo Insumos' },
  { tipo: 'grp_desc', valor: 'Promo chivas', motivo: 'grp_promo_chivas', descricao: 'Grupo Promo Chivas' },
  { tipo: 'grp_desc', valor: 'Promo Chivas', motivo: 'grp_promo_chivas', descricao: 'Grupo Promo Chivas' },
  { tipo: 'grp_desc', valor: 'Uso interno', motivo: 'grp_uso_interno', descricao: 'Grupo Uso Interno' },
  { tipo: 'grp_desc', valor: 'Uso Interno', motivo: 'grp_uso_interno', descricao: 'Grupo Uso Interno' },
  { tipo: 'grp_desc', valor: 'Pegue e Pague', motivo: 'grp_pegue_pague', descricao: 'Grupo Pegue e Pague' },
  
  // Palavras no meio do nome
  { tipo: 'palavra_meio', valor: 'Happy Hour', motivo: 'palavra_happy_hour', descricao: 'Contém "Happy Hour" no nome' },
  { tipo: 'palavra_meio', valor: 'HappyHour', motivo: 'palavra_happy_hour', descricao: 'Contém "HappyHour" no nome' },
  { tipo: 'palavra_meio', valor: 'Happy-Hour', motivo: 'palavra_happy_hour', descricao: 'Contém "Happy-Hour" no nome' },
  { tipo: 'palavra_meio', valor: ' HH', motivo: 'palavra_hh', descricao: 'Contém " HH" no nome' },
  { tipo: 'palavra_meio', valor: 'Dose Dupla', motivo: 'palavra_dose_dupla', descricao: 'Contém "Dose Dupla" no nome' },
  { tipo: 'palavra_meio', valor: 'Dose Dulpa', motivo: 'palavra_dose_dupla', descricao: 'Contém "Dose Dulpa" (typo)' },
  { tipo: 'palavra_meio', valor: 'Balde', motivo: 'palavra_balde', descricao: 'Contém "Balde" no nome' },
  { tipo: 'palavra_meio', valor: 'Garrafa', motivo: 'palavra_garrafa', descricao: 'Contém "Garrafa" no nome' },
  { tipo: 'palavra_meio', valor: 'Combo ', motivo: 'palavra_combo', descricao: 'Combo promocional' },
  { tipo: 'palavra_meio', valor: 'Adicional', motivo: 'palavra_adicional', descricao: 'Contém "Adicional" no nome' },
  { tipo: 'palavra_meio', valor: 'Embalagem', motivo: 'palavra_embalagem', descricao: 'Contém "Embalagem" no nome' },
];

interface ResultadoFiltragem {
  incluido: boolean;
  motivo: string;
  regra: string;
  ordem: number;
}

function aplicarRegrasFiltragem(produto: any, ordemInicial: number = 1): ResultadoFiltragem {
  let ordem = ordemInicial;
  
  // Validação 1: prd_ativo
  if (produto.prd_ativo !== 'S') {
    return { 
      incluido: false, 
      motivo: 'produto_inativo', 
      regra: 'prd_ativo_check',
      ordem: ordem
    };
  }
  
  // Validação 2: loc_desc null
  if (!produto.loc_desc) {
    return { 
      incluido: false, 
      motivo: 'loc_desc_null', 
      regra: 'loc_desc_check',
      ordem: ordem + 1
    };
  }
  
  const prdDesc = (produto.prd_desc || '').toLowerCase();
  const locDesc = (produto.loc_desc || '').toLowerCase();
  const grpDesc = (produto.raw_data?.grp_desc || '').toLowerCase();
  
  // Aplicar cada regra na ordem
  for (const regra of REGRAS_FILTRAGEM) {
    if (regra.tipo === 'validacao') {
      continue;
    }
    
    if (regra.tipo === 'prefixo') {
      if (produto.prd_desc?.startsWith(regra.valor)) {
        return { 
          incluido: false, 
          motivo: regra.motivo, 
          regra: `rule_${regra.motivo}`,
          ordem: ordem
        };
      }
    }
    
    if (regra.tipo === 'loc_desc') {
      if (locDesc === regra.valor.toLowerCase()) {
        return { 
          incluido: false, 
          motivo: regra.motivo, 
          regra: `rule_${regra.motivo}`,
          ordem: ordem
        };
      }
    }
    
    if (regra.tipo === 'grp_desc') {
      if (grpDesc === regra.valor.toLowerCase()) {
        return { 
          incluido: false, 
          motivo: regra.motivo, 
          regra: `rule_${regra.motivo}`,
          ordem: ordem
        };
      }
    }
    
    if (regra.tipo === 'palavra_meio') {
      if (prdDesc.includes(regra.valor.toLowerCase())) {
        return { 
          incluido: false, 
          motivo: regra.motivo, 
          regra: `rule_${regra.motivo}`,
          ordem: ordem
        };
      }
    }
    
    ordem++;
  }
  
  return { incluido: true, motivo: '', regra: '', ordem: 0 };
}

function calcularCategoriaMix(produto: any, barId: number): string {
  const locDesc = (produto.loc_desc || '').toLowerCase();
  
  if (barId === 3) {
    if (['bar', 'shot', 'dose', 'chopp'].some(loc => locDesc.includes(loc))) return 'BEBIDA';
    if (['batidos', 'montados', 'mexido', 'preshh'].some(loc => locDesc.includes(loc))) return 'DRINK';
    if (locDesc.includes('cozinha')) return 'COMIDA';
  } else if (barId === 4) {
    if (locDesc === 'salao') return 'BEBIDA';
    if (locDesc === 'bar') return 'DRINK';
    if (locDesc.includes('cozinha')) return 'COMIDA';
  }
  
  return 'OUTRO';
}

function calcularCategoriaLocal(categoriaMix: string): string {
  if (categoriaMix === 'BEBIDA') return 'Bar';
  if (categoriaMix === 'DRINK') return 'Drinks';
  if (categoriaMix === 'COMIDA') return 'Comidas';
  return 'Outro';
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ success: false, error: 'Variáveis do Supabase não encontradas' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { bar_id, data_date } = await req.json();
    
    if (!bar_id || !data_date) {
      throw new Error('bar_id e data_date são obrigatórios');
    }

    console.log(`🔍 Processando stockout RAW: bar_id=${bar_id}, data=${data_date}`);
    
    const startProcessing = Date.now();
    
    // Buscar dados RAW
    const { data: rawData, error: errorRaw } = await supabase
      .from('contahub_stockout_raw')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('data_consulta', data_date);
    
    if (errorRaw) {
      throw new Error(`Erro ao buscar dados RAW: ${errorRaw.message}`);
    }
    
    if (!rawData || rawData.length === 0) {
      throw new Error(`Nenhum dado RAW encontrado para bar_id=${bar_id}, data=${data_date}`);
    }
    
    console.log(`📦 ${rawData.length} produtos RAW encontrados`);
    
    // Limpar dados processados antigos para esta data
    await supabase
      .from('contahub_stockout_processado')
      .delete()
      .eq('bar_id', bar_id)
      .eq('data_consulta', data_date);
    
    // Processar cada produto
    const processedRecords = [];
    let incluidos = 0;
    let excluidos = 0;
    const exclusionStats: Record<string, number> = {};
    
    for (const raw of rawData) {
      const resultado = aplicarRegrasFiltragem(raw);
      const categoriaMix = calcularCategoriaMix(raw, bar_id);
      const categoriaLocal = calcularCategoriaLocal(categoriaMix);
      
      processedRecords.push({
        raw_id: raw.id,
        bar_id: bar_id,
        data_consulta: data_date,
        hora_coleta: raw.hora_consulta_real,
        prd: raw.prd,
        prd_desc: raw.prd_desc,
        prd_venda: raw.prd_venda,
        prd_ativo: raw.prd_ativo,
        prd_precovenda: raw.prd_precovenda,
        prd_estoque: raw.prd_estoque,
        loc_desc: raw.loc_desc,
        categoria_mix: categoriaMix,
        categoria_local: categoriaLocal,
        incluido: resultado.incluido,
        motivo_exclusao: resultado.motivo || null,
        regra_aplicada: resultado.regra || null,
        ordem_aplicacao: resultado.ordem || null,
        versao_regras: '2.0'
      });
      
      if (resultado.incluido) {
        incluidos++;
      } else {
        excluidos++;
        exclusionStats[resultado.motivo] = (exclusionStats[resultado.motivo] || 0) + 1;
      }
    }
    
    // Salvar dados processados
    const { error: errorProcessed } = await supabase
      .from('contahub_stockout_processado')
      .insert(processedRecords);
    
    if (errorProcessed) {
      throw new Error(`Erro ao salvar processados: ${errorProcessed.message}`);
    }
    
    console.log(`✅ ${processedRecords.length} produtos processados (${incluidos} incluídos, ${excluidos} excluídos)`);
    
    // Calcular estatísticas para audit
    const produtosIncluidos = processedRecords.filter(p => p.incluido);
    const produtosDisponiveis = produtosIncluidos.filter(p => p.prd_venda === 'S').length;
    const produtosIndisponiveis = produtosIncluidos.filter(p => p.prd_venda === 'N').length;
    const percentualStockout = incluidos > 0 ? ((produtosIndisponiveis / incluidos) * 100).toFixed(2) : '0.00';
    const percentualExcluido = rawData.length > 0 ? ((excluidos / rawData.length) * 100).toFixed(2) : '0.00';
    
    const stockoutPorCategoria: Record<string, any> = {};
    for (const categoria of ['Bar', 'Drinks', 'Comidas']) {
      const produtosCategoria = produtosIncluidos.filter(p => p.categoria_local === categoria);
      const totalCategoria = produtosCategoria.length;
      const stockoutCategoria = produtosCategoria.filter(p => p.prd_venda === 'N').length;
      
      stockoutPorCategoria[categoria] = {
        total: totalCategoria,
        disponiveis: totalCategoria - stockoutCategoria,
        stockout: stockoutCategoria,
        percentual: totalCategoria > 0 ? ((stockoutCategoria / totalCategoria) * 100).toFixed(2) : '0.00'
      };
    }
    
    // Limpar audit antigo
    await supabase
      .from('contahub_stockout_audit')
      .delete()
      .eq('bar_id', bar_id)
      .eq('data_consulta', data_date);
    
    // Salvar audit
    const auditRecord = {
      bar_id: bar_id,
      data_consulta: data_date,
      hora_processamento: new Date().toISOString(),
      total_produtos_raw: rawData.length,
      total_incluidos: incluidos,
      total_excluidos: excluidos,
      percentual_excluido: parseFloat(percentualExcluido),
      exclusoes_por_motivo: exclusionStats,
      exclusoes_por_regra: exclusionStats,
      percentual_stockout: parseFloat(percentualStockout),
      produtos_disponiveis: produtosDisponiveis,
      produtos_indisponiveis: produtosIndisponiveis,
      stockout_por_categoria: stockoutPorCategoria,
      versao_regras: '2.0',
      tempo_processamento_ms: Date.now() - startProcessing
    };
    
    const { error: errorAudit } = await supabase
      .from('contahub_stockout_audit')
      .insert(auditRecord);
    
    if (errorAudit) {
      console.error('⚠️ Erro ao salvar audit:', errorAudit);
    } else {
      console.log(`✅ Audit salvo com sucesso`);
    }
    
    const summary = {
      bar_id,
      data_date,
      total_raw: rawData.length,
      total_incluidos: incluidos,
      total_excluidos: excluidos,
      percentual_excluido: `${percentualExcluido}%`,
      percentual_stockout: `${percentualStockout}%`,
      produtos_disponiveis: produtosDisponiveis,
      produtos_indisponiveis: produtosIndisponiveis,
      stockout_por_categoria: stockoutPorCategoria,
      exclusoes_por_motivo: exclusionStats,
      tempo_processamento_ms: Date.now() - startProcessing
    };
    
    console.log('\n📊 RESUMO DO PROCESSAMENTO:');
    console.log(`- Total RAW: ${summary.total_raw}`);
    console.log(`- Incluídos: ${summary.total_incluidos}`);
    console.log(`- Excluídos: ${summary.total_excluidos}`);
    console.log(`- % Stockout: ${summary.percentual_stockout}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Processamento concluído com sucesso',
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
