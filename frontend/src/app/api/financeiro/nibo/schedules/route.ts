import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

// Buscar credenciais do NIBO para um bar
async function getNiboCredentials(barId: number = 3) {
  const { data: credencial, error } = await supabase
    .from('api_credentials')
    .select('api_token, empresa_id')
    .eq('sistema', 'nibo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !credencial?.api_token) {
    return null;
  }

  return credencial;
}

// GET - Listar agendamentos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const status = searchParams.get('status');
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');

    console.log(`[NIBO-SCHEDULES] Listando agendamentos, bar_id=${barId}`);

    // Buscar do banco de dados local (nibo_agendamentos)
    let query = supabase
      .from('nibo_agendamentos')
      .select('*')
      .eq('bar_id', barId)
      .eq('deletado', false)
      .order('data_vencimento', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (dataInicio) {
      query = query.gte('data_vencimento', dataInicio);
    }

    if (dataFim) {
      query = query.lte('data_vencimento', dataFim);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('[NIBO-SCHEDULES] Erro ao buscar:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    });

  } catch (error) {
    console.error('[NIBO-SCHEDULES] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao listar agendamentos' },
      { status: 500 }
    );
  }
}

// POST - Criar agendamento no NIBO
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      stakeholderId,
      stakeholder_nome,
      dueDate,
      scheduleDate,
      categoria_id,
      categoria_nome,
      centro_custo_id,
      centro_custo_nome,
      categories,
      accrualDate,
      value,
      description,
      reference,
      bar_id,
      bar_nome,
      criado_por_id,
      criado_por_nome
    } = body;

    // VALIDAÇÃO CRÍTICA: bar_id é obrigatório
    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório. Selecione um bar.' },
        { status: 400 }
      );
    }

    // BUILD_VERSION: 2026-01-21-v10-DEBUG-BODY-STRING
    console.log(`[NIBO-SCHEDULES-V4] ========== NOVA REQUISIÇÃO ==========`);
    console.log(`[NIBO-SCHEDULES-V4] Body recebido:`, JSON.stringify(body, null, 2));
    console.log(`[NIBO-SCHEDULES-V4] value raw:`, value, typeof value);

    // Validações - stakeholderId agora é opcional (pode criar agendamento sem vinculo)
    if (!dueDate || !value) {
      return NextResponse.json(
        { success: false, error: 'dueDate e value são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Se não tiver stakeholderId, tentar buscar um stakeholder padrão "FUNCIONARIOS GERAIS"
    // ou criar agendamento sem stakeholder (NIBO pode aceitar null)
    let finalStakeholderId = stakeholderId;
    
    if (!finalStakeholderId) {
      console.log('[NIBO-SCHEDULES] Sem stakeholderId, buscando supplier por nome...');
      
      // Buscar supplier pelo nome no NIBO (endpoint /suppliers)
      try {
        const niboCredencial = await getNiboCredentials(bar_id);
        if (niboCredencial) {
          const searchUrl = `${NIBO_BASE_URL}/suppliers?apitoken=${niboCredencial.api_token}&$top=1000`;
          const searchResponse = await fetch(searchUrl, {
            headers: { 'accept': 'application/json', 'apitoken': niboCredencial.api_token }
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const stakeholders = searchData.items || searchData || [];
            
            // Buscar por nome do beneficiário (stakeholder_nome) no NIBO
            if (stakeholder_nome) {
              const nomeNormalizado = stakeholder_nome.toUpperCase().trim();
              const found = stakeholders.find((s: any) => 
                s.name?.toUpperCase().trim() === nomeNormalizado ||
                s.name?.toUpperCase().includes(nomeNormalizado) ||
                nomeNormalizado.includes(s.name?.toUpperCase() || '')
              );
              
              if (found) {
                finalStakeholderId = found.id;
                console.log(`[NIBO-SCHEDULES] Stakeholder encontrado por nome: ${found.name} (${found.id})`);
              }
            }
            
            // Se não encontrou por nome, buscar stakeholder genérico
            if (!finalStakeholderId) {
              const generico = stakeholders.find((s: any) => 
                s.name?.toUpperCase().includes('FUNCIONARIO') ||
                s.name?.toUpperCase().includes('COLABORADOR') ||
                s.name?.toUpperCase().includes('GERAL')
              );
              
              if (generico) {
                finalStakeholderId = generico.id;
                console.log(`[NIBO-SCHEDULES] Usando stakeholder genérico: ${generico.name} (${generico.id})`);
              }
            }
          }
        }
      } catch (e) {
        console.warn('[NIBO-SCHEDULES] Erro ao buscar stakeholder padrão:', e);
      }
      
      // Se ainda não encontrou stakeholder, apenas logar (não bloquear para agendamentos locais)
      if (!finalStakeholderId) {
        console.log('[NIBO-SCHEDULES] Stakeholder não encontrado, agendamento será salvo sem vinculo');
      }
    }

    // categoria_id é obrigatório apenas se for sincronizar com NIBO
    // Para agendamentos locais, podemos permitir sem categoria
    const temCredenciaisNibo = await getNiboCredentials(bar_id);
    if (!categoria_id && temCredenciaisNibo) {
      console.warn('[NIBO-SCHEDULES] categoria_id não fornecida, NIBO pode rejeitar');
    }

    // Preparar valor numérico
    const valorNumerico = parseFloat((Math.abs(parseFloat(String(value)))).toFixed(2));
    const valorNegativo = valorNumerico * -1; // DEVE ser negativo para NIBO

    // Tentar buscar credenciais do NIBO (agora é opcional)
    const credencial = await getNiboCredentials(bar_id);
    
    let niboId: string | null = null;
    let niboData: any = {};
    let origemAgendamento = 'local'; // Default: salvar localmente
    let sincronizadoNibo = false;
    let erroNibo: string | null = null;
    
    // Se tiver credenciais do NIBO, tentar criar lá
    if (credencial) {
      try {
        console.log('[NIBO-SCHEDULES-V7] Valor calculado:', {
          original: value,
          numerico: valorNumerico,
          negativo: valorNegativo,
          eh_negativo: valorNegativo < 0
        });
        
        // Montar objeto de categoria com valor NEGATIVO (obrigatório para /schedules/debit)
        const categoryItem: any = {
          categoryId: categoria_id,
          value: valorNegativo,
          description: description || 'Pagamento'
        };
        
        // Payload para /schedules/debit
        const schedulePayload: any = {
          stakeholderId: finalStakeholderId,
          dueDate: dueDate,
          scheduleDate: scheduleDate || dueDate,
          accrualDate: accrualDate || dueDate,
          description: description || 'Pagamento agendado',
          categories: [categoryItem]
        };

        // Adicionar centro de custo se fornecido
        if (centro_custo_id) {
          schedulePayload.costCenterValueType = 0;
          schedulePayload.costCenters = [{
            costCenterId: centro_custo_id,
            value: String(valorNegativo)
          }];
        }

        // Adicionar referência se fornecida
        if (reference) {
          schedulePayload.reference = reference;
        }

        console.log('[NIBO-SCHEDULES] Payload para NIBO:', JSON.stringify(schedulePayload, null, 2));

        // Verificação de segurança - garantir que valor é negativo
        if (schedulePayload.categories[0].value >= 0) {
          console.error('[NIBO-SCHEDULES] ERRO: Valor não é negativo!', schedulePayload.categories[0].value);
          erroNibo = 'Valor deve ser negativo para agendamento de débito';
        } else {
          // Endpoint /schedules/debit para AGENDAR despesas
          const bodyString = JSON.stringify(schedulePayload);
          const response = await fetch(`${NIBO_BASE_URL}/schedules/debit?apitoken=${credencial.api_token}`, {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'Content-Type': 'application/json',
              'apitoken': credencial.api_token
            },
            body: bodyString
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[NIBO-SCHEDULES] Erro NIBO:', response.status, errorText);
            erroNibo = `Erro NIBO: ${response.status} - ${errorText.substring(0, 200)}`;
          } else {
            // NIBO retorna o ID como texto puro (UUID)
            const responseText = await response.text();
            console.log('[NIBO-SCHEDULES] Resposta do NIBO (raw):', responseText);
            
            try {
              niboData = JSON.parse(responseText);
              niboId = niboData.id || niboData.scheduleId || niboData.Id || niboData.ScheduleId || responseText.replace(/"/g, '');
            } catch {
              niboId = responseText.replace(/"/g, '').trim();
              niboData = { id: niboId };
            }
            
            console.log('[NIBO-SCHEDULES] Agendamento criado no NIBO, ID:', niboId);
            origemAgendamento = 'nibo';
            sincronizadoNibo = true;
          }
        }
      } catch (niboError) {
        console.error('[NIBO-SCHEDULES] Erro ao comunicar com NIBO:', niboError);
        erroNibo = `Erro de comunicação com NIBO: ${niboError instanceof Error ? niboError.message : 'Erro desconhecido'}`;
      }
    } else {
      console.log('[NIBO-SCHEDULES] Sem credenciais NIBO, salvando apenas localmente');
      erroNibo = 'Credenciais NIBO não configuradas';
    }

    // SEMPRE salvar no banco local (com ou sem NIBO)
    // Gerar ID local se não tiver ID do NIBO
    const idParaSalvar = niboId || `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const { data: insertedData, error: insertError } = await supabase.from('nibo_agendamentos').insert({
      nibo_id: niboId, // null se não tiver NIBO
      bar_id,
      bar_nome: bar_nome || null,
      tipo: 'despesa',
      status: 'pendente',
      valor: valorNumerico,
      data_vencimento: dueDate,
      data_pagamento: null,
      descricao: description,
      categoria_id,
      categoria_nome: categoria_nome || null,
      stakeholder_id: stakeholderId || null,
      stakeholder_nome: stakeholder_nome || null,
      centro_custo_id,
      centro_custo_nome: centro_custo_nome || null,
      criado_por_id: criado_por_id || null,
      criado_por_nome: criado_por_nome || null,
      origem: origemAgendamento,
      sincronizado_nibo: sincronizadoNibo,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    }).select('id').single();

    if (insertError) {
      console.error('[NIBO-SCHEDULES] Erro ao salvar no banco local:', insertError);
      return NextResponse.json(
        { success: false, error: `Erro ao salvar agendamento: ${insertError.message}` },
        { status: 500 }
      );
    }

    console.log('[NIBO-SCHEDULES] Agendamento salvo localmente, ID:', insertedData?.id);

    return NextResponse.json({
      success: true,
      data: {
        id: niboId || insertedData?.id,
        local_id: insertedData?.id,
        nibo_id: niboId,
        ...niboData
      },
      origem: origemAgendamento,
      sincronizado_nibo: sincronizadoNibo,
      aviso_nibo: erroNibo ? `Agendamento salvo localmente. ${erroNibo}` : null
    });

  } catch (error) {
    console.error('[NIBO-SCHEDULES] Erro ao criar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao criar agendamento' },
      { status: 500 }
    );
  }
}
