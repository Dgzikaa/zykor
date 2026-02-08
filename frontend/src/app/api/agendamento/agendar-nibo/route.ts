import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

// Buscar credenciais do NIBO
async function getNiboCredentials(barId: number) {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('api_token')
    .eq('sistema', 'nibo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !data?.api_token) {
    return null;
  }
  return data;
}

// Limpar valor monetário
function limparValor(valor: string): number {
  return parseFloat(
    valor
      .replace(/R\$\s*/gi, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  );
}

// Formatar data DD/MM/YYYY para YYYY-MM-DD
function formatarData(data: string): string {
  if (!data) return '';
  const [dia, mes, ano] = data.split('/');
  if (!dia || !mes || !ano) return data;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// POST - Agendar pagamento no NIBO
export async function POST(request: NextRequest) {
  try {
    const {
      stakeholder_id,
      stakeholder_nome,
      nome_beneficiario,
      valor,
      descricao,
      data_pagamento,
      data_competencia,
      categoria_id,
      centro_custo_id,
      bar_id = 3
    } = await request.json();

    // Validações obrigatórias
    if (!stakeholder_id) {
      return NextResponse.json(
        { success: false, error: 'stakeholder_id é obrigatório. Busque o stakeholder primeiro.' },
        { status: 400 }
      );
    }

    if (!categoria_id) {
      return NextResponse.json(
        { success: false, error: 'categoria_id é obrigatório. Configure a categoria primeiro.' },
        { status: 400 }
      );
    }

    if (!valor) {
      return NextResponse.json(
        { success: false, error: 'valor é obrigatório.' },
        { status: 400 }
      );
    }

    if (!data_pagamento) {
      return NextResponse.json(
        { success: false, error: 'data_pagamento é obrigatória.' },
        { status: 400 }
      );
    }

    console.log(`[AGENDAR-NIBO] Agendando para ${nome_beneficiario || stakeholder_nome}, bar_id=${bar_id}`);

    const credencial = await getNiboCredentials(bar_id);
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas' },
        { status: 400 }
      );
    }

    // Processar valores
    const valorNumerico = limparValor(valor);
    const valorNegativo = -Math.abs(valorNumerico); // NIBO exige valor negativo para débito
    
    const dataPagamentoFormatada = formatarData(data_pagamento);
    const dataCompetenciaFormatada = formatarData(data_competencia) || dataPagamentoFormatada;

    // Montar payload para NIBO /schedules/debit
    const schedulePayload: any = {
      stakeholderId: stakeholder_id,
      dueDate: dataPagamentoFormatada,
      scheduleDate: dataPagamentoFormatada,
      accrualDate: dataCompetenciaFormatada,
      description: descricao || `Pagamento para ${nome_beneficiario || stakeholder_nome}`,
      categories: [{
        categoryId: categoria_id,
        value: valorNegativo,
        description: descricao || 'Pagamento'
      }]
    };

    // Adicionar centro de custo se fornecido
    if (centro_custo_id) {
      schedulePayload.costCenterValueType = 0; // 0 = valor
      schedulePayload.costCenters = [{
        costCenterId: centro_custo_id,
        value: String(valorNegativo)
      }];
    }

    console.log('[AGENDAR-NIBO] Payload:', JSON.stringify(schedulePayload, null, 2));

    // Criar agendamento no NIBO
    const response = await fetch(`${NIBO_BASE_URL}/schedules/debit?apitoken=${credencial.api_token}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'apitoken': credencial.api_token
      },
      body: JSON.stringify(schedulePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AGENDAR-NIBO] Erro NIBO:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Erro NIBO: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // NIBO retorna o ID como texto puro (UUID)
    const responseText = await response.text();
    const niboId = responseText.replace(/"/g, '').trim();
    
    console.log('[AGENDAR-NIBO] Agendamento criado:', niboId);

    // Salvar no banco local
    await supabase.from('nibo_agendamentos').insert({
      nibo_id: niboId,
      bar_id,
      tipo: 'despesa',
      status: 'pendente',
      valor: valorNumerico,
      data_vencimento: dataPagamentoFormatada,
      descricao: descricao || `Pagamento para ${nome_beneficiario || stakeholder_nome}`,
      categoria_id,
      stakeholder_id,
      stakeholder_nome: stakeholder_nome || nome_beneficiario,
      centro_custo_id: centro_custo_id || null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      nibo_id: niboId,
      message: `Agendamento criado no NIBO: ${niboId}`
    });

  } catch (error) {
    console.error('[AGENDAR-NIBO] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao criar agendamento' },
      { status: 500 }
    );
  }
}
