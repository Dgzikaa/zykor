import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function onlyDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

function parseAmountToNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  let normalized = value.trim();
  if (!normalized) {
    return null;
  }

  normalized = normalized.replace(/[R$\s]/g, '');

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCategoriaInvalidaParaPagamento(categoriaNome: string | null, categoriaMacro: string | null): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  const proibidasExatas = new Set([
    'APORTE DE CAPITAL',
    'CONTRATOS',
    'OUTRAS RECEITAS',
    'DIVIDENDOS',
    'EMPRESTIMOS DE SOCIOS',
    'OUTROS INVESTIMENTOS',
    'RECEITA BRUTA',
    'RECEITA',
    'FATURAMENTO',
    'VENDAS'
  ]);

  const nome = normalize(categoriaNome || '');
  const macro = normalize(categoriaMacro || '');
  if (proibidasExatas.has(nome) || proibidasExatas.has(macro)) {
    return true;
  }

  const texto = `${nome} ${macro}`;
  return /(^| )RECEITA( |$)|FATURAMENTO|VENDAS/.test(texto);
}

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
    const semCompetencia = searchParams.get('sem_competencia') === 'true';
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = Math.min(parseInt(searchParams.get('limit') || (semCompetencia ? '500' : '100')), 1000);

    console.log(`[NIBO-SCHEDULES] Listando agendamentos, bar_id=${barId}${semCompetencia ? ' (sem data_competencia)' : ''}`);

    // Buscar do banco de dados local (nibo_agendamentos)
    let query = supabase
      .from('nibo_agendamentos')
      .select('*', { count: 'exact' })
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

    if (semCompetencia) {
      query = query.is('data_competencia', null);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

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
      total: count ?? (data?.length ?? 0),
      offset,
      limit,
      hasMore: (data?.length ?? 0) >= limit
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
      stakeholder_document,
      stakeholder_pix_key,
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
      console.log('[NIBO-SCHEDULES] Sem stakeholderId, tentando resolver funcionario em /employees...');
      
      // Buscar supplier pelo nome no NIBO (endpoint /suppliers)
      try {
        const niboCredencial = await getNiboCredentials(bar_id);
        if (niboCredencial) {
          const nomeAlvo = normalizeText(stakeholder_nome || '');
          const docAlvo = onlyDigits(stakeholder_document || '');
          const pixRaw = String(stakeholder_pix_key || '').trim();
          const pixDigits = onlyDigits(pixRaw);
          const pixEmail = pixRaw.includes('@') ? pixRaw.toLowerCase() : '';

          const employeesUrl = `${NIBO_BASE_URL}/employees?apitoken=${niboCredencial.api_token}&$top=5000`;
          const employeesResponse = await fetch(employeesUrl, {
            headers: { accept: 'application/json', apitoken: niboCredencial.api_token },
          });

          if (employeesResponse.ok) {
            const employeesData = await employeesResponse.json();
            const employees = (employeesData.items || employeesData || []) as any[];

            const ativos = employees.filter(
              (emp: any) => !emp.isDeleted && !emp.isArchived && emp.isActive !== false
            );
            const candidatos = ativos.map((emp: any) => {
              const nome = normalizeText(emp.name || emp.fullName || '');
              const doc = onlyDigits(emp.document?.number || emp.documentNumber || emp.cpf || emp.cnpj || '');
              const email = String(emp.email || emp.communication?.email || '').toLowerCase().trim();
              const phone = onlyDigits(emp.phone || emp.communication?.phone || '');
              const pixKeysFromArray = (emp.bankingInfo?.pixKeys || [])
                .map((k: any) => String(k?.key || '').trim())
                .filter(Boolean);
              const pixKeySingle = String(emp.bankAccountInformation?.pixKey || '').trim();
              const pixKeys = [...pixKeysFromArray, ...(pixKeySingle ? [pixKeySingle] : [])];
              const pixKeysDigits = pixKeys.map((k: string) => onlyDigits(k)).filter(Boolean);
              const pixKeysEmail = pixKeys
                .filter((k: string) => k.includes('@'))
                .map((k: string) => k.toLowerCase());

              return { emp, nome, doc, email, phone, pixKeysDigits, pixKeysEmail };
            });

            let match =
              (docAlvo
                ? candidatos.find(c => c.doc && c.doc === docAlvo)
                : undefined) ||
              (pixEmail
                ? candidatos.find(
                    c => c.email === pixEmail || c.pixKeysEmail.includes(pixEmail)
                  )
                : undefined) ||
              (pixDigits
                ? candidatos.find(
                    c =>
                      c.phone === pixDigits ||
                      c.doc === pixDigits ||
                      c.pixKeysDigits.includes(pixDigits)
                  )
                : undefined) ||
              (nomeAlvo
                ? candidatos.find(
                    c =>
                      c.nome === nomeAlvo ||
                      c.nome.includes(nomeAlvo) ||
                      nomeAlvo.includes(c.nome)
                  )
                : undefined);

            if (match?.emp?.id) {
              finalStakeholderId = match.emp.id;
              console.log(`[NIBO-SCHEDULES] Funcionario encontrado em /employees: ${match.emp.name || match.emp.fullName} (${match.emp.id})`);
            }
          }

          if (!finalStakeholderId) {
            console.log('[NIBO-SCHEDULES] Funcionario nao encontrado em /employees, tentando fallback em /suppliers...');
          }

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
      
      // schedules/debit exige stakeholderId válido.
      if (!finalStakeholderId) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Nao foi possivel identificar o funcionario/contato no NIBO para este pagamento. Confira nome, CPF/CNPJ ou chave PIX.',
          },
          { status: 400 }
        );
      }
    }

    // Regra de negócio: categoria é obrigatória para criar agendamento.
    if (!categoria_id) {
      return NextResponse.json(
        { success: false, error: 'categoria_id é obrigatório para agendar no NIBO' },
        { status: 400 }
      );
    }

    if (!isValidUuid(categoria_id)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'categoria_id invalido para NIBO. A categoria selecionada nao possui nibo_id valido. Sincronize as categorias do NIBO e selecione novamente.',
        },
        { status: 400 }
      );
    }

    // Evita tentativa de agendar débito com categoria de receita/entrada.
    const { data: categoriaInfo } = await supabase
      .from('nibo_categorias')
      .select('categoria_nome, categoria_macro')
      .eq('bar_id', Number(bar_id))
      .eq('nibo_id', categoria_id)
      .maybeSingle();

    if (categoriaInfo) {
      if (isCategoriaInvalidaParaPagamento(categoriaInfo.categoria_nome || null, categoriaInfo.categoria_macro || null)) {
        return NextResponse.json(
          {
            success: false,
            error: `Categoria "${categoriaInfo.categoria_nome}" é de receita/entrada e não pode ser usada em contas a pagar`
          },
          { status: 400 }
        );
      }
    }

    // Preparar valor numérico com parse robusto (pt-BR/en-US) e validar.
    const parsedAmount = parseAmountToNumber(value);
    if (parsedAmount === null) {
      return NextResponse.json(
        { success: false, error: `Valor inválido: ${String(value)}` },
        { status: 400 }
      );
    }

    const valorNumerico = Number(Math.abs(parsedAmount).toFixed(2));
    if (valorNumerico <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valor deve ser maior que zero' },
        { status: 400 }
      );
    }

    const valorNegativo = Number((-Math.abs(valorNumerico)).toFixed(2)); // DEVE ser negativo para NIBO

    // Sem fallback local: esta rota só considera sucesso se criar no NIBO.
    const credencial = await getNiboCredentials(bar_id);
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não configuradas para este bar' },
        { status: 400 }
      );
    }

    console.log('[NIBO-SCHEDULES-V7] Valor calculado:', {
      original: value,
      numerico: valorNumerico,
      negativo: valorNegativo,
      eh_negativo: valorNegativo < 0
    });

    const buildSchedulePayload = (categoryValue: number) => {
      const payload: any = {
        stakeholderId: finalStakeholderId,
        dueDate: dueDate,
        scheduleDate: scheduleDate || dueDate,
        accrualDate: accrualDate || dueDate,
        description: description || 'Pagamento agendado',
        categories: [
          {
            categoryId: categoria_id,
            value: categoryValue,
            description: description || 'Pagamento',
          },
        ],
      };

      if (centro_custo_id) {
        payload.costCenterValueType = 0;
        payload.costCenters = [
          {
            costCenterId: centro_custo_id,
            value: categoryValue,
          },
        ];
      }

      if (reference) {
        payload.reference = reference;
      }

      return payload;
    };

    const postSchedule = async (payload: any) => {
      const response = await fetch(`${NIBO_BASE_URL}/schedules/debit?apitoken=${credencial.api_token}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          apitoken: credencial.api_token,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      return { response, responseText };
    };

    // Tentativa principal com valor negativo (padrão antigo)
    let schedulePayload = buildSchedulePayload(valorNegativo);
    console.log('[NIBO-SCHEDULES] Payload para NIBO (negativo):', JSON.stringify(schedulePayload, null, 2));
    let { response, responseText } = await postSchedule(schedulePayload);

    // Fallback: alguns ambientes do NIBO estão rejeitando o negativo com mensagem inconsistente.
    // Nesses casos tentamos novamente com valor positivo.
    if (!response.ok && responseText.includes('Valor do agendamento de pagamento deve ser negativo')) {
      const valorPositivo = Number(Math.abs(valorNumerico).toFixed(2));
      schedulePayload = buildSchedulePayload(valorPositivo);
      console.warn('[NIBO-SCHEDULES] NIBO rejeitou negativo, tentando fallback com valor positivo');
      console.log('[NIBO-SCHEDULES] Payload para NIBO (fallback positivo):', JSON.stringify(schedulePayload, null, 2));
      const retry = await postSchedule(schedulePayload);
      response = retry.response;
      responseText = retry.responseText;
    }

    if (!response.ok) {
      console.error('[NIBO-SCHEDULES] Erro NIBO:', response.status, responseText);
      return NextResponse.json(
        {
          success: false,
          error: `Erro NIBO ${response.status}: ${responseText.substring(0, 500)}`,
          nibo_raw_error: responseText.substring(0, 1200),
        },
        { status: response.status }
      );
    }

    // NIBO retorna o ID como texto puro (UUID)
    console.log('[NIBO-SCHEDULES] Resposta do NIBO (raw):', responseText);

    let niboData: any = {};
    let niboId: string | null = null;
    try {
      niboData = JSON.parse(responseText);
      niboId = niboData.id || niboData.scheduleId || niboData.Id || niboData.ScheduleId || responseText.replace(/"/g, '');
    } catch {
      niboId = responseText.replace(/"/g, '').trim();
      niboData = { id: niboId };
    }

    if (!niboId) {
      return NextResponse.json(
        { success: false, error: 'NIBO não retornou ID do agendamento' },
        { status: 502 }
      );
    }

    console.log('[NIBO-SCHEDULES] Agendamento criado no NIBO, ID:', niboId);
    
    const criadoPorIdSeguro = isValidUuid(criado_por_id) ? criado_por_id.trim() : null;

    const { data: insertedData, error: insertError } = await supabase.from('nibo_agendamentos').insert({
      nibo_id: niboId,
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
      centro_custo_id: centro_custo_id || null,
      centro_custo_nome: centro_custo_nome || null,
      criado_por_id: criadoPorIdSeguro,
      criado_por_nome: criado_por_nome || null,
      origem: 'nibo',
      sincronizado_nibo: true,
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
        id: niboId,
        local_id: insertedData?.id,
        nibo_id: niboId,
        ...niboData
      },
      origem: 'nibo',
      sincronizado_nibo: true,
      aviso_nibo: null
    });

  } catch (error) {
    console.error('[NIBO-SCHEDULES] Erro ao criar:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno ao criar agendamento' },
      { status: 500 }
    );
  }
}
