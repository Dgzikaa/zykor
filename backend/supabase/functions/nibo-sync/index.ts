/**
 * Edge Function: nibo-sync
 * 
 * Sincroniza agendamentos (contas a pagar/receber) do NIBO
 * para a tabela nibo_agendamentos
 * 
 * Modos de sincronização:
 * - daily_complete: Últimos 30 dias + próximos 90 dias (padrão do cron)
 * - last_7_days: Últimos 7 dias (para correções rápidas)
 * - custom: Período customizado (requer start_date e end_date)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

interface NiboSyncRequest {
  barId: number;
  sync_mode?: 'daily_complete' | 'last_7_days' | 'custom';
  start_date?: string;
  end_date?: string;
  cronSecret?: string;
}

interface NiboScheduleItem {
  id?: string;
  scheduleId?: string;
  value: number;
  paidValue?: number;
  dueDate: string;
  paymentDate?: string;
  accrualDate?: string;
  description?: string;
  observation?: string;
  title?: string;
  status?: string;
  documentNumber?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  isRecurring?: boolean;
  recurringFrequency?: string;
  categories?: Array<{
    categoryId: string;
    categoryName: string;
    value: number;
  }>;
  stakeholder?: {
    id: string;
    name: string;
    type: string;
  };
  bankAccount?: {
    id: string;
    name: string;
  };
  costCenters?: Array<{
    costCenterId: string;
    costCenterName: string;
    value: number;
  }>;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchNiboSchedules(
  apiToken: string,
  tipo: 'despesa' | 'receita',
  dataInicio: Date,
  dataFim: Date
): Promise<NiboScheduleItem[]> {
  const endpoint = tipo === 'despesa' ? 'schedules/debit' : 'schedules/credit';
  const allItems: NiboScheduleItem[] = [];
  let skip = 0;
  const top = 500;

  console.log(`📥 Buscando todos os ${tipo}s (schedules)...`);

  while (true) {
    const url = `${NIBO_BASE_URL}/${endpoint}?apitoken=${apiToken}&$orderby=dueDate&$skip=${skip}&$top=${top}`;

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'ApiToken': apiToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro NIBO ${response.status}:`, errorText);
      throw new Error(`Erro NIBO ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const items = data.items || data.value || [];

    if (items.length === 0) {
      break;
    }

    allItems.push(...items);
    console.log(`  ✓ ${items.length} registros (total: ${allItems.length})`);

    if (items.length < top) {
      break;
    }

    skip += top;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`📥 Total ${tipo}s baixados: ${allItems.length}`);

  // Filtrar por accrualDate (data de competência) internamente
  const startStr = formatDate(dataInicio);
  const endStr = formatDate(dataFim);
  
  const filteredItems = allItems.filter((item) => {
    const accrualDate = item.accrualDate ? item.accrualDate.split('T')[0] : null;
    if (!accrualDate) return false;
    return accrualDate >= startStr && accrualDate <= endStr;
  });

  console.log(`📥 ${tipo}s filtrados por competência (${startStr} a ${endStr}): ${filteredItems.length}`);

  return filteredItems;
}

// Buscar do endpoint /receipts (contas JÁ recebidas - entries efetivados)
// Diferente de /schedules/credit que são agendamentos de crédito
async function fetchNiboReceipts(
  apiToken: string,
  dataInicio: Date,
  dataFim: Date
): Promise<NiboScheduleItem[]> {
  const allItems: NiboScheduleItem[] = [];
  let skip = 0;
  const top = 500;

  console.log(`📥 Buscando receipts (contas recebidas)...`);

  while (true) {
    const url = `${NIBO_BASE_URL}/receipts?apitoken=${apiToken}&$orderby=accrualDate&$skip=${skip}&$top=${top}`;

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'ApiToken': apiToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro NIBO receipts ${response.status}:`, errorText);
      // Não lançar erro, apenas retornar vazio se falhar
      return [];
    }

    const data = await response.json();
    const items = data.items || data.value || [];

    if (items.length === 0) {
      break;
    }

    // Normalizar estrutura do receipt para ficar igual ao schedule
    const normalizedItems = items.map((item: any) => ({
      scheduleId: item.scheduleId || item.entryId,
      id: item.entryId,
      value: item.value,
      dueDate: item.date,
      paymentDate: item.date,
      accrualDate: item.accrualDate,
      description: item.description || item.identifier,
      categories: item.category ? [{
        categoryId: item.category.id,
        categoryName: item.category.name,
        value: item.value
      }] : item.categories?.map((c: any) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        value: c.value
      })),
      stakeholder: item.stakeholder ? {
        id: item.stakeholder.id,
        name: item.stakeholder.name,
        type: 'Customer'
      } : undefined,
      bankAccount: item.account ? {
        id: item.account.id,
        name: item.account.name
      } : undefined,
    }));

    allItems.push(...normalizedItems);
    console.log(`  ✓ ${items.length} receipts (total: ${allItems.length})`);

    if (items.length < top) {
      break;
    }

    skip += top;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`📥 Total receipts baixados: ${allItems.length}`);

  // Filtrar por accrualDate (data de competência) internamente
  const startStr = formatDate(dataInicio);
  const endStr = formatDate(dataFim);
  
  const filteredItems = allItems.filter((item) => {
    const accrualDate = item.accrualDate ? item.accrualDate.split('T')[0] : null;
    if (!accrualDate) return false;
    return accrualDate >= startStr && accrualDate <= endStr;
  });

  console.log(`📥 Receipts filtrados por competência (${startStr} a ${endStr}): ${filteredItems.length}`);

  return filteredItems;
}

function normalizarAgendamento(item: NiboScheduleItem, tipo: string, barId: number, barNome: string) {
  const categoria = item.categories?.[0] || {};
  const centroCusto = item.costCenters?.[0] || {};

  return {
    nibo_id: item.scheduleId || item.id || null,
    bar_id: barId,
    bar_nome: barNome,
    tipo: tipo,
    status: item.status || 'pendente',
    valor: Math.abs(parseFloat(String(item.value || 0))),
    valor_pago: item.paidValue ? Math.abs(parseFloat(String(item.paidValue))) : null,
    data_vencimento: item.dueDate || null,
    data_pagamento: item.paymentDate || null,
    data_competencia: item.accrualDate || item.dueDate || null,
    descricao: item.description || null,
    observacoes: item.observation || null,
    titulo: item.title || item.description || null,
    categoria_id: categoria.categoryId || null,
    categoria_nome: categoria.categoryName || null,
    stakeholder_id: item.stakeholder?.id || null,
    stakeholder_nome: item.stakeholder?.name || null,
    stakeholder_tipo: item.stakeholder?.type || null,
    conta_bancaria_id: item.bankAccount?.id || null,
    conta_bancaria_nome: item.bankAccount?.name || null,
    centro_custo_id: centroCusto.costCenterId || null,
    centro_custo_nome: centroCusto.costCenterName || null,
    numero_documento: item.documentNumber || null,
    numero_parcela: item.installmentNumber || null,
    total_parcelas: item.totalInstallments || null,
    recorrente: item.isRecurring || false,
    frequencia_recorrencia: item.recurringFrequency || null,
    origem: 'nibo',
    sincronizado_nibo: true,
    deletado: false,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 NIBO Sync - Iniciando sincronização');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NiboSyncRequest = await req.json();
    const { barId, sync_mode = 'daily_complete', start_date, end_date } = body;

    if (!barId) {
      throw new Error('barId é obrigatório');
    }

    console.log(`📊 Bar ID: ${barId}, Modo: ${sync_mode}`);

    // Buscar credenciais do NIBO
    const { data: credencial, error: credError } = await supabase
      .from('api_credentials')
      .select('api_token, bar_id')
      .eq('bar_id', barId)
      .eq('sistema', 'nibo')
      .eq('ativo', true)
      .single();

    if (credError || !credencial?.api_token) {
      throw new Error(`Credenciais NIBO não encontradas para bar_id=${barId}`);
    }

    console.log('✅ Credenciais carregadas');

    // Buscar nome do bar
    const { data: bar } = await supabase
      .from('bares')
      .select('nome')
      .eq('id', barId)
      .single();

    const barNome = bar?.nome || `Bar ${barId}`;

    // Calcular período
    let dataInicio: Date;
    let dataFim: Date;

    if (sync_mode === 'custom' && start_date && end_date) {
      dataInicio = new Date(start_date);
      dataFim = new Date(end_date);
    } else if (sync_mode === 'last_7_days') {
      const hoje = new Date();
      dataInicio = new Date(hoje);
      dataInicio.setDate(hoje.getDate() - 7);
      dataFim = hoje;
    } else {
      // daily_complete: últimos 30 dias + próximos 90 dias
      const hoje = new Date();
      dataInicio = new Date(hoje);
      dataInicio.setDate(hoje.getDate() - 30);
      dataFim = new Date(hoje);
      dataFim.setDate(hoje.getDate() + 90);
    }

    console.log(`📅 Período: ${formatDate(dataInicio)} até ${formatDate(dataFim)}`);

    // Buscar despesas, receitas (schedules) e receipts (contas já recebidas)
    const [despesas, receitasSchedules, receipts] = await Promise.all([
      fetchNiboSchedules(credencial.api_token, 'despesa', dataInicio, dataFim),
      fetchNiboSchedules(credencial.api_token, 'receita', dataInicio, dataFim),
      fetchNiboReceipts(credencial.api_token, dataInicio, dataFim),
    ]);

    console.log(`✅ Despesas: ${despesas.length}, Receitas (schedules): ${receitasSchedules.length}, Receipts: ${receipts.length}`);
    
    // Combinar receitas de schedules/credit com receipts
    // Usar Set para evitar duplicatas baseado no scheduleId
    const receitasMap = new Map<string, NiboScheduleItem>();
    
    // Primeiro adicionar schedules/credit
    for (const r of receitasSchedules) {
      const key = r.scheduleId || r.id || '';
      if (key) receitasMap.set(key, r);
    }
    
    // Depois adicionar receipts (sobrescreve se já existir, pois receipt é mais atualizado)
    for (const r of receipts) {
      const key = r.scheduleId || r.id || '';
      if (key) receitasMap.set(key, r);
    }
    
    const receitas = Array.from(receitasMap.values());
    console.log(`✅ Receitas combinadas (sem duplicatas): ${receitas.length}`);

    // Normalizar dados
    const despesasNormalizadas = despesas.map((d) => normalizarAgendamento(d, 'despesa', barId, barNome));
    const receitasNormalizadas = receitas.map((r) => normalizarAgendamento(r, 'receita', barId, barNome));
    const todosAgendamentos = [...despesasNormalizadas, ...receitasNormalizadas];

    // Separar registros com e sem nibo_id
    const comNiboId = todosAgendamentos.filter((a) => a.nibo_id);
    const semNiboId = todosAgendamentos.filter((a) => !a.nibo_id);

    console.log(`📊 Com nibo_id: ${comNiboId.length}, Sem nibo_id: ${semNiboId.length}`);

    let inseridos = 0;
    let atualizados = 0;
    const batchSize = 100;

    // Processar registros COM nibo_id usando upsert normal
    for (let i = 0; i < comNiboId.length; i += batchSize) {
      const batch = comNiboId.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from('nibo_agendamentos')
        .upsert(batch, {
          onConflict: 'nibo_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, upsertError.message);
      } else {
        inseridos += batch.length;
        console.log(`✅ Lote ${Math.floor(i / batchSize) + 1} processado (com nibo_id)`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Processar registros SEM nibo_id: verificar se já existe antes de inserir
    for (const registro of semNiboId) {
      const { data: existente } = await supabase
        .from('nibo_agendamentos')
        .select('id')
        .eq('bar_id', registro.bar_id)
        .eq('tipo', registro.tipo)
        .eq('data_vencimento', registro.data_vencimento)
        .eq('valor', registro.valor)
        .eq('stakeholder_id', registro.stakeholder_id)
        .ilike('descricao', registro.descricao?.substring(0, 100) || '')
        .is('nibo_id', null)
        .limit(1);

      if (existente && existente.length > 0) {
        // Atualizar registro existente
        const { error: updateError } = await supabase
          .from('nibo_agendamentos')
          .update({
            ...registro,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', existente[0].id);

        if (!updateError) {
          atualizados++;
        }
      } else {
        // Inserir novo registro
        const { error: insertError } = await supabase.from('nibo_agendamentos').insert(registro);

        if (!insertError) {
          inseridos++;
        }
      }
    }

    console.log(`✅ Sincronização concluída: ${inseridos} inseridos, ${atualizados} atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        barId,
        barNome,
        sync_mode,
        periodo: {
          inicio: formatDate(dataInicio),
          fim: formatDate(dataFim),
        },
        resultados: {
          despesas: despesas.length,
          receitas_schedules: receitasSchedules.length,
          receipts: receipts.length,
          receitas_combinadas: receitas.length,
          total: todosAgendamentos.length,
          comNiboId: comNiboId.length,
          semNiboId: semNiboId.length,
          inseridos,
          atualizados,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Erro na sincronização NIBO:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
