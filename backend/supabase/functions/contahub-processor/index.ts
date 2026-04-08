import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateFunctionEnv } from '../_shared/env-validator.ts';

console.log("🔄 ContaHub Processor - Processa dados raw salvos");



// Tamanho do batch para inserções (evitar timeout com muitos registros)
const BATCH_SIZE = 500;

// ============================================
// FUNÇÃO PARA CALCULAR DATA REAL
// Regra: Para PAGAMENTOS, sempre usar a data real do hr_lancamento
// Para outros tipos (período, analítico), manter dt_gerencial
// ============================================
function calcularDataReal(dtGerencial: string, hrLancamento: string | null | undefined): string {
  if (!hrLancamento || !dtGerencial) return dtGerencial;
  
  try {
    // Parsear hr_lancamento (formato: "2026-01-28 17:34:15" ou "2026-01-28T17:34:15")
    const lancamentoDate = new Date(hrLancamento.replace(' ', 'T'));
    if (isNaN(lancamentoDate.getTime())) return dtGerencial;
    
    const dataLancamento = lancamentoDate.toISOString().split('T')[0];
    const horaLancamento = lancamentoDate.getHours();
    
    // Se a data do lançamento é diferente da gerencial E hora >= 15h
    // significa que o turno foi aberto errado, usar data do lançamento
    if (dataLancamento > dtGerencial && horaLancamento >= 15) {
      console.log(`📅 Corrigindo data: ${dtGerencial} → ${dataLancamento} (lançamento às ${horaLancamento}h)`);
      return dataLancamento;
    }
    
    return dtGerencial;
  } catch (e) {
    return dtGerencial;
  }
}

// ============================================
// FUNÇÃO PARA CALCULAR DATA REAL DE PAGAMENTO
// Para pagamentos, SEMPRE usar a data do hr_lancamento se disponível
// Isso garante que pagamentos feitos na madrugada apareçam no dia correto
// ============================================
function calcularDataRealPagamento(dtGerencial: string, hrLancamento: string | null | undefined): string {
  if (!hrLancamento || !dtGerencial) return dtGerencial;
  
  try {
    // Parsear hr_lancamento (formato: "2026-01-28 17:34:15" ou "2026-01-28T17:34:15")
    const lancamentoDate = new Date(hrLancamento.replace(' ', 'T'));
    if (isNaN(lancamentoDate.getTime())) return dtGerencial;
    
    const dataLancamento = lancamentoDate.toISOString().split('T')[0];
    
    // Se a data do lançamento é diferente da gerencial, usar data do lançamento
    // Isso corrige pagamentos feitos na madrugada (ex: turno aberto 31/03, pago 01/04 00:52h)
    if (dataLancamento !== dtGerencial) {
      console.log(`💳 Corrigindo data pagamento: ${dtGerencial} → ${dataLancamento} (hr_lancamento)`);
      return dataLancamento;
    }
    
    return dtGerencial;
  } catch (e) {
    return dtGerencial;
  }
}

// Função helper para inserir registros em batches
async function insertInBatches(supabase: any, tableName: string, records: any[]): Promise<{ success: boolean, count: number, errors: number }> {
  let totalInserted = 0;
  let totalErrors = 0;
  
  // Dividir em batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    console.log(`📦 Inserindo batch ${batchNum}/${totalBatches} (${batch.length} registros)...`);
    
    const { error } = await supabase
      .from(tableName)
      .insert(batch);
    
    if (error) {
      console.error(`❌ Erro no batch ${batchNum}:`, error.message);
      totalErrors += batch.length;
    } else {
      totalInserted += batch.length;
    }
    
    // Pequeno delay entre batches para não sobrecarregar
    if (i + BATCH_SIZE < records.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ Total inserido: ${totalInserted}, Erros: ${totalErrors}`);
  return { success: totalErrors === 0, count: totalInserted, errors: totalErrors };
}

// Função helper para upsert em batches (para tabelas com conflito)
async function upsertInBatches(supabase: any, tableName: string, records: any[], onConflict: string): Promise<{ success: boolean, count: number, errors: number }> {
  let totalUpserted = 0;
  let totalErrors = 0;
  
  // Dividir em batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    console.log(`📦 Upsert batch ${batchNum}/${totalBatches} (${batch.length} registros)...`);
    
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict });
    
    if (error) {
      console.error(`❌ Erro no batch ${batchNum}:`, error.message);
      totalErrors += batch.length;
    } else {
      totalUpserted += batch.length;
    }
    
    // Pequeno delay entre batches para não sobrecarregar
    if (i + BATCH_SIZE < records.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ Total upserted: ${totalUpserted}, Erros: ${totalErrors}`);
  return { success: totalErrors === 0, count: totalUpserted, errors: totalErrors };
}

// Função para processar dados de uma tabela específica
async function processRawData(supabase: any, dataType: string, rawData: any, dataDate: string, barId: number = 3) {
  console.log(`📊 Processando ${dataType} para ${dataDate} (bar_id: ${barId})...`);
  
  if (!rawData?.list || !Array.isArray(rawData.list)) {
    console.log(`⚠️ Dados ${dataType} inválidos ou vazios`);
    return { success: false, count: 0, error: 'Dados inválidos' };
  }

  const records = rawData.list;
  let processedCount = 0;
  let errors = 0;

  try {
    // Processar cada tipo de dados usando INSERT (mais seguro para multi-bar)
    switch (dataType) {
      case 'analitico':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando registros analitico com UPSERT para ${dataDate}...`);
        
        const analiticoRecords = records.map((item: any) => ({
          vd_mesadesc: item.vd_mesadesc || '',
          vd_localizacao: item.vd_localizacao || '',
          itm: parseInt(item.itm) || 0,
          trn: parseInt(item.trn) || 0,
          trn_desc: item.trn_desc || '',
          prefixo: item.prefixo || '',
          tipo: item.tipo || '',
          tipovenda: item.tipovenda || '',
          ano: parseInt(item.ano) || new Date().getFullYear(),
          mes: parseInt(item.mes) || new Date().getMonth() + 1,
          trn_dtgerencial: item.trn_dtgerencial || dataDate,
          usr_lancou: item.usr_lancou || '',
          prd: item.prd || '',
          prd_desc: item.prd_desc || '',
          grp_desc: item.grp_desc || '',
          loc_desc: item.loc_desc || '',
          qtd: parseFloat(item.qtd) || 0,
          desconto: parseFloat(item.desconto) || 0,
          valorfinal: parseFloat(item.valorfinal) || 0,
          custo: parseFloat(item.custo) || 0,
          itm_obs: item.itm_obs || '',
          comandaorigem: item.comandaorigem || '',
          itemorigem: item.itemorigem || '',
          bar_id: barId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        if (analiticoRecords.length > 0) {
          console.log(`📊 Processando ${analiticoRecords.length} registros de analitico em batches...`);
          
          // ✅ Usar UPSERT em batches (seguro, sem DELETE)
          const analiticoBatchResult = await upsertInBatches(
            supabase, 
            'contahub_analitico', 
            analiticoRecords,
            'bar_id,trn,itm,trn_dtgerencial,vd_mesadesc,tipo,prd_desc'
          );
          
          if (analiticoBatchResult.errors > 0) {
            console.error(`⚠️ Analitico processado com ${analiticoBatchResult.errors} erros`);
            errors = analiticoBatchResult.errors;
          } else {
            processedCount = analiticoBatchResult.count;
            console.log(`✅ Analitico: ${processedCount} registros upserted com sucesso`);
          }
        }
        break;

      case 'periodo':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando registros periodo com UPSERT para ${dataDate}...`);
        
        const periodoRecords = records.map((item: any) => {
          // Calcular data real baseada no ultimo_pedido (vd_hrultimo)
          const ultimoPedido = item.vd_hrultimo || item.ultimo_pedido;
          const dtGerencialOriginal = item.dt_gerencial || dataDate;
          const dtGerencialReal = calcularDataReal(dtGerencialOriginal, ultimoPedido);
          
          return {
          dt_gerencial: dtGerencialReal,
          tipovenda: item.tipovenda || '',
          vd_mesadesc: item.vd_mesadesc || '',
          vd_localizacao: item.vd_localizacao || '',
          cht_nome: item.cht_nome || '',
          cli_nome: item.cli_nome || '',
          cli_dtnasc: item.cli_dtnasc || null,
          cli_email: item.cli_email || '',
          cli_fone: item.cli_fone || '',
          usr_abriu: item.usr_abriu || '',
          pessoas: parseFloat(item.pessoas) || 0,
          qtd_itens: parseFloat(item.qtd_itens) || 0,
          vr_pagamentos: parseFloat(item['$vr_pagamentos'] || item.vr_pagamentos || 0),
          vr_produtos: parseFloat(item['$vr_produtos'] || item.vr_produtos || 0),
          vr_repique: parseFloat(item['$vr_repique'] || item.vr_repique || 0),
          vr_couvert: parseFloat(item['$vr_couvert'] || item.vr_couvert || 0),
          vr_desconto: parseFloat(item['$vr_desconto'] || item.vr_desconto || 0),
          motivo: item.motivo || '',
          dt_contabil: item.dt_contabil || null,
          ultimo_pedido: item.vd_hrultimo || item.ultimo_pedido || '',
          vd_dtcontabil: item.vd_dtcontabil || null,
          bar_id: barId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }});
        
        if (periodoRecords.length > 0) {
          // ✅ Usar UPSERT (seguro, sem DELETE)
          const periodoBatchResult = await upsertInBatches(
            supabase,
            'contahub_periodo',
            periodoRecords,
            'bar_id,dt_gerencial,vd_mesadesc,tipovenda'
          );
          
          if (periodoBatchResult.errors > 0) {
            console.error(`⚠️ Periodo processado com ${periodoBatchResult.errors} erros`);
            return { success: true, count: periodoBatchResult.count, errors: periodoBatchResult.errors };
          } else {
            processedCount = periodoBatchResult.count;
            console.log(`✅ Periodo: ${processedCount} registros upserted com sucesso`);
          }
        }
        break;

      case 'fatporhora':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando registros fatporhora com UPSERT para ${dataDate}...`);
        
        const fatporhoraRecords = records.map((item: any) => ({
          vd_dtgerencial: item.vd_dtgerencial || dataDate,
          dds: parseInt(item.dds) || 0,
          dia: item.dia || '',
          hora: parseInt(item.hora) || 0,
          qtd: parseFloat(item.qtd) || 0,
          valor: parseFloat(item['$valor'] || item.valor) || 0,
          bar_id: barId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        if (fatporhoraRecords.length > 0) {
          // ✅ Usar UPSERT (seguro, sem DELETE)
          const fatBatchResult = await upsertInBatches(
            supabase,
            'contahub_fatporhora',
            fatporhoraRecords,
            'bar_id,vd_dtgerencial,hora'
          );
          
          if (fatBatchResult.errors > 0) {
            console.error(`⚠️ Fatporhora processado com ${fatBatchResult.errors} erros`);
            errors = fatBatchResult.errors;
          } else {
            processedCount = fatBatchResult.count;
            console.log(`✅ Fatporhora: ${processedCount} registros upserted com sucesso`);
          }
        }
        break;

      case 'pagamentos':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando registros pagamentos com UPSERT para ${dataDate}...`);
        
        const pagamentosRecords = records.map((item: any) => {
          // Para pagamentos, usar SEMPRE o dt_gerencial que vem do ContaHub
          // NÃO corrigir baseado em hr_lancamento (ContaHub já define a data correta)
          const dtGerencialOriginal = item.dt_gerencial || dataDate;
          
          return {
          dt_gerencial: dtGerencialOriginal,
          vd: String(item.vd || ''),
          trn: String(item.trn || ''),
          hr_lancamento: item.hr_lancamento || '',
          hr_transacao: item.hr_transacao || '',
          dt_transacao: item.dt_transacao || null,
          mesa: item.mesa || '',
          cli: item.cli ? parseInt(item.cli) : null,
          cliente: item.cliente || item.cli_nome || '',
          vr_pagamentos: parseFloat(item['$vr_pagamentos'] || item.vr_pagamentos) || 0,
          pag: String(item.pag || ''),
          valor: parseFloat(item['$valor'] || item.valor) || 0,
          taxa: parseFloat(item['$taxa'] || item.taxa) || 0,
          perc: parseFloat(item['$perc'] || item.perc) || 0,
          liquido: parseFloat(item['$liquido'] || item.liquido) || 0,
          tipo: item.tipo || '',
          meio: item.meio || '',
          cartao: item.cartao || '',
          autorizacao: String(item.autorizacao || ''),
          dt_credito: item.dt_credito || null,
          usr_abriu: item.usr_abriu || '',
          usr_lancou: item.usr_lancou || '',
          usr_aceitou: item.usr_aceitou || '',
          motivodesconto: item.motivodesconto || '',
          bar_id: barId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }});
        
        if (pagamentosRecords.length > 0) {
          console.log(`📊 Processando ${pagamentosRecords.length} registros de pagamentos em batches...`);
          
          // ✅ Usar UPSERT em batches (seguro, sem DELETE)
          const pagamentosBatchResult = await upsertInBatches(
            supabase,
            'contahub_pagamentos',
            pagamentosRecords,
            'bar_id,vd,trn,pag'
          );
          
          if (pagamentosBatchResult.errors > 0) {
            console.error(`⚠️ Pagamentos processado com ${pagamentosBatchResult.errors} erros`);
            return { success: true, count: pagamentosBatchResult.count, errors: pagamentosBatchResult.errors };
          } else {
            processedCount = pagamentosBatchResult.count;
            console.log(`✅ Pagamentos: ${processedCount} registros upserted com sucesso`);
          }
        }
        break;

      case 'tempo':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando registros tempo com UPSERT para ${dataDate}...`);
        
        const tempoRecords = records.map((item: any) => {
          // Extrair timestamps (com fallback para formato antigo)
          const t0Lancamento = item['t0-lancamento'] || item.t0_lancamento;
          const t1Prodini = item['t1-prodini'] || item.t1_prodini;
          const t2Prodfim = item['t2-prodfim'] || item.t2_prodfim;
          const t3Entrega = item['t3-entrega'] || item.t3_entrega;
          
          // Calcular data real baseada no t0_lancamento (ou t1_prodini se t0 for null)
          const dataReal = calcularDataReal(dataDate, t0Lancamento || t1Prodini);
          
          // Função para calcular diferença em minutos entre dois timestamps
          const calcularDiferencaMinutos = (inicio: string | null, fim: string | null): number => {
            if (!inicio || !fim) return 0;
            try {
              const dataInicio = new Date(inicio.replace(' ', 'T'));
              const dataFim = new Date(fim.replace(' ', 'T'));
              if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) return 0;
              return Math.round((dataFim.getTime() - dataInicio.getTime()) / 60000); // ms para minutos
            } catch {
              return 0;
            }
          };
          
          // Tentar usar valores do ContaHub primeiro (vêm em SEGUNDOS, converter para minutos)
          let t0_t1 = (parseFloat(item['t0-t1'] || item.t0_t1) || 0) / 60;
          let t0_t2 = (parseFloat(item['t0-t2'] || item.t0_t2) || 0) / 60;
          let t0_t3 = (parseFloat(item['t0-t3'] || item.t0_t3) || 0) / 60;
          let t1_t2 = (parseFloat(item['t1-t2'] || item.t1_t2) || 0) / 60;
          let t1_t3 = (parseFloat(item['t1-t3'] || item.t1_t3) || 0) / 60;
          let t2_t3 = (parseFloat(item['t2-t3'] || item.t2_t3) || 0) / 60;
          
          // Se t0_t3 vier com valor absurdo (> 1440 min = 24h), recalcular
          if (t0_t3 > 1440 || t0_t3 === 0) {
            // Se t0_lancamento existe, usar ele como base
            if (t0Lancamento && t3Entrega) {
              t0_t3 = calcularDiferencaMinutos(t0Lancamento, t3Entrega);
              if (t1Prodini) t0_t1 = calcularDiferencaMinutos(t0Lancamento, t1Prodini);
              if (t2Prodfim) t0_t2 = calcularDiferencaMinutos(t0Lancamento, t2Prodfim);
            }
            // Senão, usar t1_prodini como base (para dados de março em diante)
            else if (t1Prodini) {
              if (t2Prodfim) {
                t1_t2 = calcularDiferencaMinutos(t1Prodini, t2Prodfim);
                t0_t2 = t1_t2; // Aproximação
              }
              if (t3Entrega) {
                t1_t3 = calcularDiferencaMinutos(t1Prodini, t3Entrega);
                t0_t3 = t1_t3; // Aproximação
              }
            }
          }
          
          // Calcular t2_t3 se não existir
          if (!t2_t3 && t2Prodfim && t3Entrega) {
            t2_t3 = calcularDiferencaMinutos(t2Prodfim, t3Entrega);
          }
          
          // Determinar categoria
          const grpLower = (item.grp_desc || '').toLowerCase();
          const categoria = item.categoria || 
            (grpLower.includes('cerveja') || grpLower.includes('bebida') ? 'bebida' : 
             grpLower.includes('drink') ? 'drink' : 'comida');
          
          // Aplicar regra de tempo por categoria:
          // - Drinks/Bebidas: usar t0_t3 (tempo até entrega)
          // - Comida: usar t0_t2 (tempo até produção finalizada)
          const tempo_final = (categoria === 'comida') ? t0_t2 : t0_t3;
          
          // Gerar idempotency_key único
          const timestamp = t0Lancamento || t1Prodini || '';
          const idempotencyKey = `${barId}_${dataReal}_${item.itm || 0}_${item.vd_mesadesc || ''}_${timestamp}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          
          return {
          data: dataReal,
          prd: parseInt(item.prd) || null,
          prd_desc: item.prd_desc || '',
          grp_desc: item.grp_desc || '',
          loc_desc: item.loc_desc || '',
          vd_mesadesc: item.vd_mesadesc || '',
          vd_localizacao: item.vd_localizacao || '',
          itm: String(item.itm || 0),
          t0_lancamento: t0Lancamento || null,
          t1_prodini: t1Prodini || null,
          t2_prodfim: t2Prodfim || null,
          t3_entrega: t3Entrega || null,
          t0_t1,
          t0_t2,
          t0_t3,
          t1_t2,
          t1_t3,
          t2_t3,
          prd_idexterno: item.prd_idexterno || '',
          usr_abriu: item.usr_abriu || '',
          usr_lancou: item.usr_lancou || '',
          usr_produziu: item.usr_produziu || '',
          usr_entregou: item.usr_entregou || '',
          usr_transfcancelou: item.usr_transfcancelou || '',
          prefixo: item.prefixo || '',
          tipovenda: item.tipovenda || '',
          ano: parseInt(item.ano) || new Date().getFullYear(),
          mes: item.mes ? parseInt(String(item.mes).split('-')[1]) : new Date().getMonth() + 1,
          dds: parseInt(item.dds) || 0,
          diadasemana: item.diadasemana || '',
          hora: item.hora ? String(item.hora) : '',
          itm_qtd: parseInt(item.itm_qtd) || 0,
          bar_id: barId,
          categoria,
          tempo_final,
          idempotency_key: idempotencyKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }});
        
        if (tempoRecords.length > 0) {
          console.log(`📊 Processando ${tempoRecords.length} registros de tempo em batches...`);
          
          // ✅ Usar UPSERT para evitar duplicados (índice único: bar_id, data, itm, prd, vd_mesadesc)
          const batchResult = await upsertInBatches(
            supabase,
            'contahub_tempo',
            tempoRecords,
            'bar_id,data,itm,prd,vd_mesadesc'
          );
          
          if (batchResult.errors > 0) {
            console.error(`⚠️ Tempo processado com ${batchResult.errors} erros`);
            return { success: true, count: batchResult.count, errors: batchResult.errors };
          } else {
            processedCount = batchResult.count;
            console.log(`✅ Tempo: ${processedCount} registros inseridos/atualizados com sucesso`);
          }
        }
        break;

      case 'prodporhora':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando registros prodporhora com UPSERT para ${dataDate}...`);
        
        const prodporhoraRecords = records.map((item: any) => ({
          data_gerencial: item.data_gerencial || dataDate,
          hora: parseInt(item.hora) || 0,
          produto_id: String(item.produto_id || item.prd || ''),
          produto_descricao: String(item.produto_descricao || item.prd_desc || ''),
          grupo_descricao: String(item.grupo_descricao || item.grp_desc || ''),
          quantidade: parseFloat(item.quantidade || item.qtd || 0),
          valor_unitario: parseFloat(item.valor_unitario || item.valor_unit || 0),
          valor_total: parseFloat(item.valor_total || item.valor || 0),
          bar_id: barId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        if (prodporhoraRecords.length > 0) {
          // ✅ Usar UPSERT (seguro, sem DELETE)
          const prodBatchResult = await upsertInBatches(
            supabase,
            'contahub_prodporhora',
            prodporhoraRecords,
            'bar_id,data_gerencial,hora,produto_id'
          );
          
          if (prodBatchResult.errors > 0) {
            console.error(`⚠️ Prodporhora processado com ${prodBatchResult.errors} erros`);
            errors = prodBatchResult.errors;
          } else {
            processedCount = prodBatchResult.count;
            console.log(`✅ Prodporhora: ${processedCount} registros upserted com sucesso`);
          }
        }
        break;

      case 'vendas':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando vendas com UPSERT para ${dataDate}...`);
        
        const vendasRecords = records.map((item: any) => {
          // Parser de timestamp do ContaHub: "2025-12-14T16:54:17-0300"
          const parseContaHubTimestamp = (ts: string | null): string | null => {
            if (!ts) return null;
            try {
              const date = new Date(ts);
              return isNaN(date.getTime()) ? null : date.toISOString();
            } catch {
              return null;
            }
          };
          
          // Parser de data simples (YYYY-MM-DD)
          const parseDate = (d: string | null): string | null => {
            if (!d) return null;
            try {
              const date = new Date(d);
              return isNaN(date.getTime()) ? null : d.split('T')[0];
            } catch {
              return null;
            }
          };
          
          // Parser de valor monetário (remove $ e converte)
          const parseMonetario = (val: any): number => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            const str = String(val).replace('$', '').replace(',', '.').trim();
            return parseFloat(str) || 0;
          };
          
          return {
            bar_id: barId,
            dt_gerencial: dataDate,
            trn: parseInt(item.trn) || null,
            vd: parseInt(item.vd) || null,
            vd_nome: item.vd_nome || '',
            vd_mesadesc: item.vd_mesadesc || '',
            vd_localizacao: item.vd_localizacao || '',
            
            // Dados do cliente COMPLETOS
            cli_id: parseInt(item.cli) || null,
            cli_nome: item.cli_nome || item.vd_nome || '',
            cli_fone: item.cli_fone || '',
            cli_email: item.cli_email || item.vd_email || '',
            cli_dtnasc: parseDate(item.cli_dtnasc),
            cli_dtcadastro: parseDate(item.cli_dtcadastro),
            cli_dtultima: parseDate(item.cli_dtultima),
            cli_sexo: item.cli_sexo || '',
            cli_obs: item.cli_obs || '',
            vd_cpf: item.vd_cpf || item.cli_cpf || '',
            
            // TODOS os horários
            vd_hrabertura: parseContaHubTimestamp(item.vd_hrabertura),
            vd_hrsaida: parseContaHubTimestamp(item.vd_hrsaida),
            vd_hrultimo: parseContaHubTimestamp(item.vd_hrultimo),
            vd_hrprimeiro: parseContaHubTimestamp(item.vd_hrprimeiro),
            vd_hrpagamento: parseContaHubTimestamp(item.vd_hrpagamento),
            vd_hrencerramento: parseContaHubTimestamp(item.vd_hrencerramento),
            vd_hrfechamento: parseContaHubTimestamp(item.vd_hrfechamento),
            
            // Dados da venda
            vd_comanda: item.vd_comanda || '',
            vd_prefixo: item.vd_prefixo || '',
            vd_status: item.vd_status || '',
            vd_senha: item.vd_senha || '',
            vd_sinalizacao: item.vd_sinalizacao || '',
            vd_prepago: item.vd_prepago || '',
            vd_interna: item.vd_interna || '',
            vd_transferidocancelado: item.vd_transferidocancelado || '',
            vd_perda: item.vd_perda || '',
            vd_obs: item.vd_obs || '',
            vd_idexterno: item.vd_idexterno || '',
            tipovenda: item.tipovenda || '',
            
            // TODOS os valores financeiros
            pessoas: parseFloat(item.vd_pessoas) || 0,
            qtd_itens: parseFloat(item.vd_qtditens) || 0,
            vr_pagamentos: parseFloat(item.vd_vrpagamentos) || 0,
            vr_produtos: parseFloat(item.vd_vrprodutos) || 0,
            vd_vrcheio: parseFloat(item.vd_vrcheio) || 0,
            vr_couvert: parseFloat(item.vd_vrcouvert) || 0,
            vd_vrdescontos: parseFloat(item.vd_vrdescontos) || 0,
            vr_desconto: parseFloat(item.vd_vrdescontos) || 0,
            vr_repique: parseFloat(item.vd_vrrepique) || 0,
            vd_vrmanobrista: parseFloat(item.vd_vrmanobrista) || 0,
            vd_vrentrega: parseFloat(item.vd_vrentrega) || 0,
            vd_vrfalta: parseFloat(item.vd_vrfalta) || 0,
            vd_qtdcouvert: parseFloat(item.vd_qtdcouvert) || 0,
            vd_qtdmanobrista: parseFloat(item.vd_qtdmanobrista) || 0,
            vd_dividepor: parseFloat(item.vd_dividepor) || null,
            
            // Dados do turno
            trn_desc: item.trn_desc || '',
            trn_couvert: parseMonetario(item.trn_couvert),
            trn_hrinicio: parseContaHubTimestamp(item.trn_hrinicio),
            trn_hrfim: parseContaHubTimestamp(item.trn_hrfim),
            trn_status: item.trn_status || '',
            trn_percrepiquedefault: parseFloat(item.trn_percrepiquedefault) || 0,
            
            // Usuários
            usr_abriu_id: parseInt(item.usr_abriu) || null,
            usr_fechou_id: parseInt(item.usr_fechou) || null,
            usr_abriu: item.usr_nome_abriu || '',
            usr_fechou: item.usr_nome_fechou || '',
            usr_nome_abriu: item.usr_nome_abriu || '',
            
            // NF-e
            nf_nnf: item.nf_nnf ? String(item.nf_nnf) : '',
            nf_autorizada: item.nf_autorizada || '',
            nf_tipo: item.nf_tipo || '',
            
            // Motivo desconto
            motivo: item.vd_motivodesconto || '',
            
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            idempotency_key: `${barId}_${dataDate}_${item.vd || ''}_${item.trn || ''}`
          };
        }).filter((v: any) => v.vd); // Filtrar registros sem ID de venda
        
        if (vendasRecords.length > 0) {
          console.log(`📊 Processando ${vendasRecords.length} registros de vendas em batches...`);
          
          // Usar upsert em batches para evitar timeout
          const vendasBatchResult = await upsertInBatches(supabase, 'contahub_vendas', vendasRecords, 'idempotency_key');
          
          if (vendasBatchResult.errors > 0) {
            console.error(`⚠️ Vendas processado com ${vendasBatchResult.errors} erros`);
            return { success: true, count: vendasBatchResult.count, errors: vendasBatchResult.errors };
          } else {
            processedCount = vendasBatchResult.count;
            console.log(`✅ vendas: ${processedCount} registros processados com TODOS os campos`);
          }
        }
        break;

      case 'cancelamentos':
        // ✅ UPSERT: Atualiza se existir, insere se não existir (sem DELETE)
        console.log(`🔄 Processando registros cancelamentos com UPSERT para ${dataDate}...`);
        
        const cancelamentosRecords = records.map((item: any) => {
          // Calcular custototal a partir dos itens individuais no array raw_data
          let custototal = 0;

          // O raw_data do ContaHub é um array de itens cancelados
          const itens = Array.isArray(item.raw_data) ? item.raw_data : [];

          if (itens.length > 0) {
            // Somar itm_vrcheio * itm_qtd de cada item
            custototal = itens.reduce((sum: number, subItem: any) => {
              const valor = parseFloat(subItem.itm_vrcheio || subItem.valor_cheio || subItem.valor || 0) || 0;
              const qtd = parseFloat(subItem.itm_qtd || subItem.quantidade || subItem.qtd || 1) || 1;
              return sum + (valor * qtd);
            }, 0);
          } else {
            // Fallback: tentar ler campos diretos do item (caso estrutura seja diferente)
            custototal = parseFloat(item.custototal || item.custo_total || item.vlr_total || item.valor_total || 0) || 0;

            // Se ainda 0, tentar calcular de campos individuais
            if (custototal === 0) {
              const valor = parseFloat(item.itm_vrcheio || item.valor_cheio || 0) || 0;
              const qtd = parseFloat(item.itm_qtd || item.quantidade || 1) || 1;
              if (valor > 0) {
                custototal = valor * qtd;
              }
            }
          }

          const itemData = item.data || item.dt_gerencial || item.data_gerencial || dataDate;
          const dataFinal = typeof itemData === 'string' ? itemData.split('T')[0].split(' ')[0] : dataDate;

          return {
            bar_id: barId,
            data: dataFinal,
            custototal,
            raw_data: item,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }).filter((r: any) => r.data);
        
        if (cancelamentosRecords.length > 0) {
          const cancelBatchResult = await insertInBatches(supabase, 'contahub_cancelamentos', cancelamentosRecords);
          if (cancelBatchResult.errors > 0) {
            console.error(`⚠️ Cancelamentos processado com ${cancelBatchResult.errors} erros`);
            errors = cancelBatchResult.errors;
          } else {
            processedCount = cancelBatchResult.count;
            console.log(`✅ Cancelamentos: ${processedCount} registros inseridos`);
          }
        }
        break;

      default:
        console.log(`⚠️ Tipo de dados não suportado: ${dataType}`);
        return { success: false, count: 0, error: `Tipo não suportado: ${dataType}` };
    }

    console.log(`✅ ${dataType}: ${processedCount} processados, ${errors} erros`);
    return { success: true, count: processedCount, errors };

  } catch (error) {
    console.error(`❌ Erro geral ao processar ${dataType}:`, error);
    return { success: false, count: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validar variáveis de ambiente obrigatórias
    validateFunctionEnv('contahub-processor', [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]);

    const requestBody = await req.text();
    console.log('📥 Body recebido:', requestBody);
    
    const { data_date, bar_id = 3, data_types, process_all = false } = JSON.parse(requestBody || '{}');
    
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const results = {
      processed: [] as any[],
      errors: [] as any[]
    };

    // Se process_all = true, processar todos os dados raw pendentes
    if (process_all) {
      console.log('🔄 Processando TODOS os dados raw pendentes...');
      
      const { data: rawDataList, error: fetchError } = await supabase
        .from('contahub_raw_data')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (fetchError) {
        throw new Error(`Erro ao buscar dados raw: ${fetchError.message}`);
      }
      
      for (const rawRecord of rawDataList || []) {
        try {
          const result = await processRawData(
            supabase,
            rawRecord.data_type,
            rawRecord.raw_json,
            rawRecord.data_date,
            rawRecord.bar_id
          );
          
          results.processed.push({
            data_type: rawRecord.data_type,
            data_date: rawRecord.data_date,
            bar_id: rawRecord.bar_id,
            result
          });
          
          if (result.success) {
            await supabase
              .from('contahub_raw_data')
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('id', rawRecord.id);
          }
          
        } catch (error) {
          console.error(`❌ Erro ao processar registro ${rawRecord.id}:`, error);
          results.errors.push({
            raw_id: rawRecord.id,
            data_type: rawRecord.data_type,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } else {
      if (!data_date) {
        throw new Error('data_date é obrigatório quando process_all = false');
      }
      
      const typesToProcess = data_types || ['analitico', 'fatporhora', 'pagamentos', 'periodo', 'tempo', 'cancelamentos'];
      
      for (const dataType of typesToProcess) {
        try {
          const { data: rawRecord, error: fetchError } = await supabase
            .from('contahub_raw_data')
            .select('*')
            .eq('data_type', dataType)
            .eq('data_date', data_date)
            .eq('bar_id', bar_id)
            .single();
          
          if (fetchError || !rawRecord) {
            console.log(`⚠️ Nenhum dado raw encontrado para ${dataType} em ${data_date}`);
            continue;
          }
          
          const result = await processRawData(
            supabase,
            dataType,
            rawRecord.raw_json,
            data_date,
            bar_id
          );
          
          results.processed.push({ data_type: dataType, result });
          
          if (result.success && result.count > 0) {
            await supabase
              .from('contahub_raw_data')
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('id', rawRecord.id);
          }
          
        } catch (error) {
          console.error(`❌ Erro ao processar ${dataType}:`, error);
          results.errors.push({
            data_type: dataType,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    const summary = {
      total_processed: results.processed.length,
      total_errors: results.errors.length,
      success_rate: results.processed.length > 0 
        ? (results.processed.length / (results.processed.length + results.errors.length) * 100).toFixed(1)
        : 0
    };
    
    console.log(`📊 Processamento concluído: ${summary.total_processed} processados, ${summary.total_errors} erros`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Processamento de dados raw concluído',
      summary,
      details: {
        processed: results.processed,
        errors: results.errors
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('❌ Erro geral no processor:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
