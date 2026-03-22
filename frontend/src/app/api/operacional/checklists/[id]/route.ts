import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  authenticateUser,
  checkPermission,
  authErrorResponse,
  permissionErrorResponse,
} from '@/middleware/auth';
import { z } from 'zod';

// ========================================
// 📋 API PARA CHECKLISTS POR ID
// ========================================

interface ChecklistResponse {
  checklist: Checklist;
  historico?: ChecklistHistorico[];
  versao_solicitada?: ChecklistHistorico;
  estatisticas?: ChecklistStats;
}

interface Checklist {
  id: string;
  nome: string;
  descricao?: string;
  setor?: string;
  tipo?: string;
  tempo_estimado?: number;
  ativo?: boolean;
  estrutura: ChecklistEstrutura;
}

interface ChecklistHistorico {
  id: string;
  checklist_id: string;
  versao: number;
  nome_anterior: string;
  estrutura_anterior: ChecklistEstrutura;
  mudancas_detectadas: string[];
  comentario: string;
  usuario_id: string;
  tipo_mudanca: string;
  criado_em: string;
}

interface ChecklistEstrutura {
  secoes: ChecklistSecao[];
}

interface ChecklistSecao {
  nome: string;
  itens: ChecklistItem[];
}

interface ChecklistItem {
  titulo: string;
  tipo: string;
}

interface ChecklistStats {
  total_execucoes: number;
  execucoes_completadas: number;
  execucoes_pendentes: number;
  ultima_execucao: string | null;
}

interface Execucao {
  status: string;
  criado_em: string;
}

interface ChecklistUpdateData {
  [key: string]: unknown;
}

interface MudancasDetectadas {
  temMudancas: boolean;
  tipoMudanca: string;
  detalhes: string[];
}

interface ApiError {
  message: string;
}

// ========================================
// 📋 GET /api/checklists/[id]
// ========================================

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const ChecklistUpdateSchema = z.object({
  nome: z.string().min(1).max(255).optional(),
  descricao: z.string().optional(),
  setor: z.string().min(1).optional(),
  tipo: z
    .enum([
      'abertura',
      'fechamento',
      'manutencao',
      'qualidade',
      'seguranca',
      'limpeza',
      'auditoria',
    ])
    .optional(),
  frequencia: z
    .enum([
      'diaria',
      'semanal',
      'quinzenal',
      'mensal',
      'bimestral',
      'trimestral',
      'conforme_necessario',
    ])
    .optional(),
  tempo_estimado: z.number().min(1).max(480).optional(),
  ativo: z.boolean().optional(),
  estrutura: z
    .object({
      secoes: z.array(
        z.object({
          nome: z.string(),
          descricao: z.string().optional(),
          cor: z.string().default('bg-blue-500'),
          ordem: z.number(),
          itens: z.array(
            z.object({
              titulo: z.string(),
              descricao: z.string().optional(),
              tipo: z.enum([
                'texto',
                'numero',
                'sim_nao',
                'data',
                'assinatura',
                'foto_camera',
                'foto_upload',
                'avaliacao',
              ]),
              obrigatorio: z.boolean().default(false),
              ordem: z.number(),
              opcoes: z.object({}).optional(),
              condicional: z
                .object({
                  dependeDe: z.string(),
                  valor: z.any(),
                })
                .optional(),
              validacao: z.object({}).optional(),
            })
          ),
        })
      ),
    })
    .optional(),
  comentario_edicao: z.string().optional(), // Para o histórico
});

// =====================================================
// GET - BUSCAR CHECKLIST POR ID
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { id: checklistId } = await params;
    const { searchParams } = new URL(request.url);
    const incluirHistorico = searchParams.get('incluir_historico') === 'true';
    const versao = searchParams.get('versao');

    const supabase = await getAdminClient();

    // Buscar checklist com detalhes completos
    const { data: checklist, error } = await supabase
      .from('checklists')
      .select(
        `
        *,
        criado_por:usuarios_bar!criado_por (nome, email),
        atualizado_por:usuarios_bar!atualizado_por (nome, email),
        template_origem:checklist_templates!template_origem (nome, categoria)
      `
      )
      .eq('id', checklistId)
      .eq('bar_id', user.bar_id) // Filtro de segurança
      .single();

    if (error) {
      console.error('Erro ao buscar checklist:', error);
      return NextResponse.json(
        { error: 'Checklist não encontrado' },
        { status: 404 }
      );
    }

    const response: ChecklistResponse = { checklist };

    // Incluir histórico se solicitado
    if (incluirHistorico) {
      const { data: historico } = await supabase
        .from('checklist_historico')
        .select(
          `
          *,
          usuario:usuarios_bar!usuario_id (nome, email)
        `
        )
        .eq('checklist_id', checklistId)
        .order('criado_em', { ascending: false });

      response.historico = historico || [];
    }

    // Buscar versão específica se solicitada
    if (versao) {
      const { data: versaoEspecifica } = await supabase
        .from('checklist_historico')
        .select('*')
        .eq('checklist_id', checklistId)
        .eq('versao', versao)
        .single();

      if (versaoEspecifica) {
        response.versao_solicitada = versaoEspecifica;
      }
    }

    // Buscar estatísticas de execução
    const { data: statsExecucoes } = await supabase
      .from('checklist_execucoes')
      .select('status, criado_em')
      .eq('checklist_id', checklistId);

    const estatisticas: ChecklistStats = {
      total_execucoes: statsExecucoes?.length || 0,
      execucoes_completadas:
        statsExecucoes?.filter((e: Execucao) => e.status === 'completado')
          .length || 0,
      execucoes_pendentes:
        statsExecucoes?.filter((e: Execucao) => e.status === 'em_andamento')
          .length || 0,
      ultima_execucao: statsExecucoes?.[0]?.criado_em || null,
    };

    response.estatisticas = estatisticas;

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: unknown) {
    const apiError = error as ApiError;
    console.error('Erro na API de checklist GET:', apiError);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: apiError.message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT - ATUALIZAR CHECKLIST COM VERSIONAMENTO
// =====================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    // 🔒 PERMISSÕES - Verificar se pode editar checklists
    if (!checkPermission(user, { module: 'checklists', action: 'write' })) {
      return permissionErrorResponse('Sem permissão para editar checklists');
    }

    const { id: checklistId } = await params;
    const body = await request.json();
    const data = ChecklistUpdateSchema.parse(body);

    const supabase = await getAdminClient();

    // Verificar se checklist existe e pertence ao bar
    const { data: checklistExistente, error: fetchError } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', checklistId)
      .eq('bar_id', user.bar_id)
      .single();

    if (fetchError || !checklistExistente) {
      return NextResponse.json(
        { error: 'Checklist não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se houve mudanças significativas
    const mudancasDetectadas: MudancasDetectadas = detectarMudancas(
      checklistExistente,
      data
    );

    if (!mudancasDetectadas.temMudancas) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma alteração detectada',
        data: checklistExistente,
      });
    }

    // Buscar próximo número de versão
    const { data: ultimaVersao } = await supabase
      .from('checklist_historico')
      .select('versao')
      .eq('checklist_id', checklistId)
      .order('versao', { ascending: false })
      .limit(1)
      .single();

    const novaVersao = (ultimaVersao?.versao || 0) + 1;

    // Salvar estado atual no histórico ANTES da atualização
    const { error: historicoError } = await supabase
      .from('checklist_historico')
      .insert({
        checklist_id: checklistId,
        versao: novaVersao,
        nome_anterior: checklistExistente.nome,
        estrutura_anterior: checklistExistente.estrutura,
        mudancas_detectadas: mudancasDetectadas.detalhes,
        comentario: data.comentario_edicao || 'Atualização automática',
        usuario_id: user.auth_id,
        tipo_mudanca: mudancasDetectadas.tipoMudanca,
      });

    if (historicoError) {
      console.error('Erro ao salvar histórico:', historicoError);
      return NextResponse.json(
        { error: 'Erro ao salvar histórico' },
        { status: 500 }
      );
    }

    // Preparar dados para atualização
    const updateData: ChecklistUpdateData = {
      ...data,
      versao: novaVersao,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user.auth_id,
    };

    // Remover campos que não devem ser atualizados diretamente
    delete updateData.comentario_edicao;

    // Atualizar checklist
    const { data: checklistAtualizado, error: updateError } = await supabase
      .from('checklists')
      .update(updateData)
      .eq('id', checklistId)
      .eq('bar_id', user.bar_id) // Filtro de segurança
      .select(
        `
        *,
        criado_por:usuarios_bar!criado_por (nome, email),
        atualizado_por:usuarios_bar!atualizado_por (nome, email)
      `
      )
      .single();

    if (updateError) {
      console.error('Erro ao atualizar checklist:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar checklist' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist atualizado com sucesso',
      data: checklistAtualizado,
      mudancas: mudancasDetectadas,
      nova_versao: novaVersao,
    });
  } catch (error: unknown) {
    const apiError = error as Error;
    console.error('Erro na API de checklist PUT:', apiError);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: apiError.message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - ARQUIVAR CHECKLIST
// =====================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    // 🔒 PERMISSÕES - Verificar se pode deletar checklists
    if (!checkPermission(user, { module: 'checklists', action: 'delete' })) {
      return permissionErrorResponse('Sem permissão para deletar checklists');
    }

    const { id: checklistId } = await params;
    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    const supabase = await getAdminClient();

    // Verificar se checklist existe
    const { data: checklist, error: fetchError } = await supabase
      .from('checklists')
      .select('nome, ativo')
      .eq('id', checklistId)
      .eq('bar_id', user.bar_id)
      .single();

    if (fetchError || !checklist) {
      return NextResponse.json(
        { error: 'Checklist não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se tem execuções associadas
    const { data: execucoes } = await supabase
      .from('checklist_execucoes')
      .select('id')
      .eq('checklist_id', checklistId)
      .limit(1);

    if (execucoes && execucoes.length > 0 && !forceDelete) {
      // Se tem execuções, apenas desativar (soft delete)
      const { error: deactivateError } = await supabase
        .from('checklists')
        .update({
          ativo: false,
          atualizado_em: new Date().toISOString(),
          atualizado_por: user.auth_id,
        })
        .eq('id', checklistId)
        .eq('bar_id', user.bar_id);

      if (deactivateError) {
        console.error('Erro ao desativar checklist:', deactivateError);
        return NextResponse.json(
          { error: 'Erro ao arquivar checklist' },
          { status: 500 }
        );
      }

      // Registrar no histórico
      await supabase.from('checklist_historico').insert({
        checklist_id: checklistId,
        versao: 0, // Versão especial para arquivamento
        comentario: 'Checklist arquivado (possui execuções)',
        usuario_id: user.auth_id,
        tipo_mudanca: 'arquivamento',
      });

      return NextResponse.json({
        success: true,
        message: 'Checklist arquivado com sucesso (possui execuções)',
        action: 'archived',
      });
    } else {
      // Deletar permanentemente
      const { error: deleteError } = await supabase
        .from('checklists')
        .delete()
        .eq('id', checklistId)
        .eq('bar_id', user.bar_id);

      if (deleteError) {
        console.error('Erro ao deletar checklist:', deleteError);
        return NextResponse.json(
          { error: 'Erro ao deletar checklist' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Checklist deletado com sucesso',
        action: 'deleted',
      });
    }
  } catch (error: unknown) {
    const apiError = error as Error;
    console.error('Erro na API de checklist DELETE:', apiError);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: apiError.message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

function detectarMudancas(
  original: Checklist,
  updates: ChecklistUpdateData
): MudancasDetectadas {
  const mudancas: string[] = [];
  let tipoMudanca = 'edicao_menor';

  // Verificar mudanças nos campos básicos
  if (updates.nome && updates.nome !== original.nome) {
    mudancas.push(`Nome alterado: "${original.nome}" → "${updates.nome}"`);
    tipoMudanca = 'edicao_maior';
  }

  if (
    updates.descricao !== undefined &&
    updates.descricao !== original.descricao
  ) {
    mudancas.push('Descrição alterada');
  }

  if (updates.setor && updates.setor !== original.setor) {
    mudancas.push(`Setor alterado: "${original.setor}" → "${updates.setor}"`);
    tipoMudanca = 'edicao_maior';
  }

  if (updates.tipo && updates.tipo !== original.tipo) {
    mudancas.push(`Tipo alterado: "${original.tipo}" → "${updates.tipo}"`);
  }

  if (
    updates.tempo_estimado &&
    updates.tempo_estimado !== original.tempo_estimado
  ) {
    mudancas.push(
      `Tempo estimado: ${original.tempo_estimado}min → ${updates.tempo_estimado}min`
    );
  }

  if (updates.ativo !== undefined && updates.ativo !== original.ativo) {
    mudancas.push(
      `Status: ${original.ativo ? 'Ativo' : 'Inativo'} → ${updates.ativo ? 'Ativo' : 'Inativo'}`
    );
    tipoMudanca = 'edicao_maior';
  }

  // Verificar mudanças na estrutura
  if (original.estrutura && updates.estrutura) {
    const mudancasEstrutura = detectarMudancasEstrutura(
      original.estrutura,
      updates.estrutura as ChecklistEstrutura
    );
    mudancas.push(...mudancasEstrutura);
  }

  return {
    temMudancas: mudancas.length > 0,
    detalhes: mudancas,
    tipoMudanca,
  };
}

function detectarMudancasEstrutura(
  original: ChecklistEstrutura,
  updated: ChecklistEstrutura
): string[] {
  const mudancas: string[] = [];

  if (!original || !updated) return mudancas;

  const secoesOriginais = original.secoes || [];
  const secoesAtualizadas = updated.secoes || [];

  // Comparar número de seções
  if (secoesOriginais.length !== secoesAtualizadas.length) {
    mudancas.push(
      `Número de seções: ${secoesOriginais.length} → ${secoesAtualizadas.length}`
    );
  }

  // Verificar mudanças em seções existentes
  secoesAtualizadas.forEach((secaoAtual: ChecklistSecao, index: number) => {
    const secaoOriginal = secoesOriginais[index];

    if (!secaoOriginal) {
      mudancas.push(`Nova seção adicionada: "${secaoAtual.nome}"`);
      return;
    }

    if (secaoAtual.nome !== secaoOriginal.nome) {
      mudancas.push(
        `Seção renomeada: "${secaoOriginal.nome}" → "${secaoAtual.nome}"`
      );
    }

    const itensOriginais = secaoOriginal.itens || [];
    const itensAtualizados = secaoAtual.itens || [];

    if (itensOriginais.length !== itensAtualizados.length) {
      mudancas.push(
        `Seção "${secaoAtual.nome}": ${itensOriginais.length} → ${itensAtualizados.length} itens`
      );
    }

    // Verificar itens modificados
    itensAtualizados.forEach((itemAtual: ChecklistItem, itemIndex: number) => {
      const itemOriginal = itensOriginais[itemIndex];

      if (!itemOriginal) {
        mudancas.push(`Novo item: "${itemAtual.titulo}" (${secaoAtual.nome})`);
      } else if (itemAtual.titulo !== itemOriginal.titulo) {
        mudancas.push(
          `Item renomeado: "${itemOriginal.titulo}" → "${itemAtual.titulo}"`
        );
      } else if (itemAtual.tipo !== itemOriginal.tipo) {
        mudancas.push(
          `Tipo do item "${itemAtual.titulo}": ${itemOriginal.tipo} → ${itemAtual.tipo}`
        );
      }
    });
  });

  // Verificar seções removidas
  if (secoesOriginais.length > secoesAtualizadas.length) {
    const secoesRemovidas = secoesOriginais.slice(secoesAtualizadas.length);
    secoesRemovidas.forEach((secao: ChecklistSecao) => {
      mudancas.push(`Seção removida: "${secao.nome}"`);
    });
  }

  return mudancas;
}
