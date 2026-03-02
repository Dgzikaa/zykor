import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const FinalizarExecucaoSchema = z.object({
  observacoes_finais: z.string().optional(),
  assinatura_digital: z
    .object({
      url: z.string(),
      coordenadas: z.array(z.number()).optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
  confirmacao_finalizacao: z.boolean().default(true),
});

// =====================================================
// POST - FINALIZAR EXECUÇÃO
// =====================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { id: execucaoId } = await params;
    const body = await request.json();
    const data = FinalizarExecucaoSchema.parse(body);

    const supabase = await getAdminClient();

    // Buscar execução completa
    const { data: execucao, error: fetchError } = await supabase
      .from('checklist_execucoes')
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo, estrutura),
        funcionario:usuarios_bar!funcionario_id (nome, email)
      `
      )
      .eq('id', execucaoId)
      .single();

    if (fetchError || !execucao) {
      return NextResponse.json(
        {
          error: 'Execução não encontrada',
        },
        { status: 404 }
      );
    }

    // Verificar permissões
    if (!podeFinalizarExecucao(user, execucao)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para finalizar esta execução',
        },
        { status: 403 }
      );
    }

    // Verificar se execução pode ser finalizada
    if (execucao.status !== 'em_andamento') {
      return NextResponse.json(
        {
          error: `Execução não pode ser finalizada. Status atual: ${execucao.status}`,
        },
        { status: 400 }
      );
    }

    // Validar se todos os campos obrigatórios foram preenchidos
    const validacao = validarExecucaoCompleta(execucao);
    if (!validacao.pode_finalizar) {
      return NextResponse.json(
        {
          error: 'Execução não pode ser finalizada',
          detalhes: validacao.erros,
          campos_pendentes: validacao.campos_obrigatorios_pendentes,
        },
        { status: 400 }
      );
    }

    // Calcular score final usando o sistema local
    const scoreResult = calcularScoreFinal(execucao);

    // Calcular tempo total decorrido
    const iniciadoEm = new Date(execucao.iniciado_em);
    const finalizadoEm = new Date();
    const tempoTotalMinutos = Math.round(
      (finalizadoEm.getTime() - iniciadoEm.getTime()) / 1000 / 60
    );

    // Preparar dados de finalização
    const dadosFinalizacao: DadosFinalizacao = {
      status: 'completado',
      finalizado_em: finalizadoEm.toISOString(),
      finalizado_por: user.auth_id,
      observacoes_finais: data.observacoes_finais,
      score_final: scoreResult.score_total,
      score_detalhado: scoreResult,
      tempo_total_minutos: tempoTotalMinutos,
      atualizado_em: finalizadoEm.toISOString(),
    };

    // Adicionar assinatura digital se fornecida
    if (data.assinatura_digital) {
      dadosFinalizacao.assinatura_digital = {
        dados: data.assinatura_digital.url || '',
        tipo: 'assinatura',
        assinado_em: finalizadoEm.toISOString(),
        assinado_por: user.auth_id,
      };
    }

    // Atualizar execução
    const { data: execucaoFinalizada, error: updateError } = await supabase
      .from('checklist_execucoes')
      .update(dadosFinalizacao)
      .eq('id', execucaoId)
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo),
        funcionario:usuarios_bar!funcionario_id (nome, email),
        finalizado_por_usuario:usuarios_bar!finalizado_por (nome, email)
      `
      )
      .single();

    if (updateError) {
      console.error('Erro ao finalizar execução:', updateError);
      return NextResponse.json(
        {
          error: 'Erro ao finalizar execução',
        },
        { status: 500 }
      );
    }

    // Registrar no histórico de atividades (opcional)
    await registrarAtividade(supabase, {
      execucao_id: execucaoId,
      usuario_id: user.auth_id,
      acao: 'finalizacao',
      detalhes: {
        score: scoreResult.score_total,
        tempo_total: tempoTotalMinutos,
        campos_respondidos: scoreResult.total_respondidos,
      },
    });

    console.log(
      `✅ Execução finalizada: ${execucao.checklist.nome} por ${execucao.funcionario.nome} - Score: ${scoreResult.score_total}%`
    );

    return NextResponse.json({
      success: true,
      message: 'Execução finalizada com sucesso',
      data: {
        execucao: execucaoFinalizada,
        score: scoreResult,
        tempo_total: tempoTotalMinutos,
        resumo: gerarResumoFinalizacao(execucaoFinalizada, scoreResult),
      },
    });
  } catch (error: unknown) {
    console.error('Erro na API de finalizar execução:', error);

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
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// GET - OBTER PREVIEW DE FINALIZAÇÃO
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

    const { id: execucaoId } = await params;
    const supabase = await getAdminClient();

    // Buscar execução
    const { data: execucao, error } = await supabase
      .from('checklist_execucoes')
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo, estrutura)
      `
      )
      .eq('id', execucaoId)
      .single();

    if (error || !execucao) {
      return NextResponse.json(
        {
          error: 'Execução não encontrada',
        },
        { status: 404 }
      );
    }

    // Verificar permissões
    if (!podeAcessarExecucao(user, execucao)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para acessar esta execução',
        },
        { status: 403 }
      );
    }

    // Gerar preview de finalização
    const validacao = validarExecucaoCompleta(execucao);
    const scorePreview = calcularScoreFinal(execucao);
    const tempoDecorrido = calcularTempoDecorrido(execucao.iniciado_em);

    const preview = {
      pode_finalizar: validacao.pode_finalizar,
      campos_obrigatorios_pendentes: validacao.campos_obrigatorios_pendentes,
      score_previsto: scorePreview,
      tempo_decorrido: tempoDecorrido,
      resumo_respostas: gerarResumoRespostas(execucao),
      proximos_passos: validacao.pode_finalizar
        ? [
            'Revisar respostas',
            'Adicionar observações finais',
            'Finalizar execução',
          ]
        : [
            'Completar campos obrigatórios pendentes',
            'Revisar respostas incompletas',
          ],
    };

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error: unknown) {
    console.error('Erro na API de preview de finalização:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

interface User {
  auth_id: string;
  bar_id?: number;
  role: string;
}

interface Execucao {
  id: string;
  checklist_id: string;
  funcionario_id: string;
  status: string;
  iniciado_em: string;
  checklist: {
    nome: string;
    setor: string;
    tipo: string;
    estrutura: unknown;
  };
  funcionario: {
    nome: string;
    email: string;
  };
  respostas: Record<string, unknown>;
}

interface ValidacaoResult {
  pode_finalizar: boolean;
  erros: string[];
  campos_obrigatorios_pendentes: string[];
}

interface ScoreResult {
  score_total: number;
  total_respondidos: number;
  detalhes: Record<string, unknown>;
}

interface AssinaturaDigital {
  dados: string;
  tipo: string;
  assinado_em: string;
  assinado_por: string;
}

interface DadosFinalizacao {
  status: string;
  finalizado_em: string;
  finalizado_por: string;
  observacoes_finais?: string;
  score_final: number;
  score_detalhado: ScoreResult;
  tempo_total_minutos: number;
  atualizado_em: string;
  assinatura_digital?: AssinaturaDigital;
}

function podeFinalizarExecucao(user: User, execucao: Execucao): boolean {
  // Administradores podem finalizar qualquer execução
  if (user.role === 'admin' || user.role === 'gerente') {
    return true;
  }

  // Funcionários só podem finalizar suas próprias execuções
  if (user.role === 'funcionario') {
    return execucao.funcionario_id === user.auth_id;
  }

  return false;
}

function podeAcessarExecucao(user: User, execucao: Execucao): boolean {
  // Administradores podem acessar qualquer execução
  if (user.role === 'admin' || user.role === 'gerente') {
    return true;
  }

  // Funcionários só podem acessar suas próprias execuções
  if (user.role === 'funcionario') {
    return execucao.funcionario_id === user.auth_id;
  }

  return false;
}

function validarExecucaoCompleta(execucao: Execucao): ValidacaoResult {
  const erros: string[] = [];
  const camposObrigatoriosPendentes: string[] = [];

  if (!execucao.respostas) {
    erros.push('Execução não possui respostas');
    return {
      pode_finalizar: false,
      erros,
      campos_obrigatorios_pendentes: [],
    };
  }

  // Verificar campos obrigatórios
  const estrutura = execucao.checklist.estrutura as {
    secoes: Array<{ itens: Array<{ id: string; obrigatorio: boolean }> }>;
  };

  if (estrutura?.secoes) {
    estrutura.secoes.forEach(secao => {
      secao.itens?.forEach(item => {
        if (item.obrigatorio) {
          const resposta = execucao.respostas[item.id] as { valor: unknown };
          if (
            !resposta ||
            resposta.valor === null ||
            resposta.valor === undefined ||
            resposta.valor === ''
          ) {
            camposObrigatoriosPendentes.push(item.id);
          }
        }
      });
    });
  }

  if (camposObrigatoriosPendentes.length > 0) {
    erros.push(
      `Campos obrigatórios não preenchidos: ${camposObrigatoriosPendentes.length}`
    );
  }

  return {
    pode_finalizar:
      erros.length === 0 && camposObrigatoriosPendentes.length === 0,
    erros,
    campos_obrigatorios_pendentes: camposObrigatoriosPendentes,
  };
}

function calcularScoreFinal(execucao: Execucao): ScoreResult {
  // Implementação simplificada do cálculo de score
  const respostas = execucao.respostas;
  let totalItens = 0;
  let itensRespondidos = 0;
  let scoreTotal = 0;

  // Contar itens e respostas
  Object.keys(respostas).forEach(itemId => {
    totalItens++;
    const resposta = respostas[itemId] as { valor: unknown };
    if (
      resposta &&
      resposta.valor !== null &&
      resposta.valor !== undefined &&
      resposta.valor !== ''
    ) {
      itensRespondidos++;
      scoreTotal += 100; // Score simples: 100% por item respondido
    }
  });

  const scoreFinal = totalItens > 0 ? Math.round(scoreTotal / totalItens) : 0;

  return {
    score_total: scoreFinal,
    total_respondidos: itensRespondidos,
    detalhes: {
      total_itens: totalItens,
      itens_respondidos: itensRespondidos,
      percentual: scoreFinal,
    },
  };
}

function calcularTempoDecorrido(iniciadoEm: string): number {
  const inicio = new Date(iniciadoEm);
  const agora = new Date();
  return Math.round((agora.getTime() - inicio.getTime()) / 1000 / 60); // em minutos
}

// Função formatarTempo removida - não utilizada

function gerarResumoRespostas(execucao: Execucao): Record<string, unknown> {
  const respostas = execucao.respostas;
  const resumo: Record<string, unknown> = {};

  Object.keys(respostas).forEach(itemId => {
    const resposta = respostas[itemId] as {
      valor: unknown;
      observacoes?: string;
    };
    if (resposta && resposta.valor !== null) {
      resumo[itemId] = {
        respondido: true,
        valor: resposta.valor,
        observacoes: resposta.observacoes || '',
      };
    }
  });

  return resumo;
}

function gerarResumoFinalizacao(
  execucao: Execucao,
  score: ScoreResult
): Record<string, unknown> {
  return {
    checklist: execucao.checklist.nome,
    funcionario: execucao.funcionario.nome,
    score_final: score.score_total,
    tempo_total: calcularTempoDecorrido(execucao.iniciado_em),
    total_respondidos: score.total_respondidos,
    finalizado_em: new Date().toISOString(),
  };
}

async function registrarAtividade(
  supabase: SupabaseClient,
  atividade: {
    execucao_id: string;
    usuario_id: string;
    acao: string;
    detalhes: Record<string, unknown>;
  }
) {
  try {
    await supabase.from('checklist_atividades').insert({
      execucao_id: atividade.execucao_id,
      usuario_id: atividade.usuario_id,
      acao: atividade.acao,
      detalhes: atividade.detalhes,
      criado_em: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao registrar atividade:', error);
    // Não falhar a finalização por erro no registro de atividade
  }
}
