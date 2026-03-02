import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { z } from 'zod';

// =====================================================
// INTERFACES E TIPOS
// =====================================================

interface AuthenticatedUser {
  auth_id: string;
  email: string;
  role: string;
  bar_id?: number;
  [key: string]: any;
}

interface Execucao {
  id: string;
  checklist_id: string;
  funcionario_id: string;
  iniciado_por: string;
  status: string;
  iniciado_em: string;
  concluido_em?: string;
  respostas: any;
  observacoes?: string;
  progresso?: number;
  checklist?: {
    id: string;
    nome: string;
    setor: string;
    tipo: string;
    tempo_estimado: number;
    estrutura: any;
  };
  funcionario?: {
    id: string;
    nome: string;
    email: string;
  };
  iniciado_por_usuario?: {
    id: string;
    nome: string;
    email: string;
  };
}

interface ItemResposta {
  item_id: string;
  valor: any;
  anexos?: Array<{
    url: string;
    nome: string;
    tipo: string;
    tamanho?: number;
  }>;
  respondido: boolean;
  respondido_em?: string;
}

interface SecaoResposta {
  secao_id: string;
  itens: ItemResposta[];
}

interface Respostas {
  secoes: SecaoResposta[];
}

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const SalvarRespostasSchema = z.object({
  respostas: z.object({
    secoes: z.array(
      z.object({
        secao_id: z.string(),
        itens: z.array(
          z.object({
            item_id: z.string(),
            valor: z.any(),
            anexos: z
              .array(
                z.object({
                  url: z.string(),
                  nome: z.string(),
                  tipo: z.string(),
                  tamanho: z.number().optional(),
                })
              )
              .optional(),
            respondido: z.boolean(),
            respondido_em: z.string().optional(),
          })
        ),
      })
    ),
  }),
  observacoes: z.string().optional(),
  auto_save: z.boolean().optional().default(false),
});

// =====================================================
// GET - BUSCAR EXECUÇÃO ESPECÍFICA
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

    // Buscar execução completa
    const { data: execucao, error } = await supabase
      .from('checklist_execucoes')
      .select(
        `
        *,
        checklist:checklists!checklist_id (
          id, nome, setor, tipo, tempo_estimado, estrutura
        ),
        funcionario:usuarios_bar!funcionario_id (id, nome, email),
        iniciado_por_usuario:usuarios_bar!iniciado_por (nome, email)
      `
      )
      .eq('id', execucaoId)
      .single();

    if (error) {
      console.error('Erro ao buscar execução:', error);
      return NextResponse.json(
        {
          error: 'Execução não encontrada',
        },
        { status: 404 }
      );
    }

    // Verificar se o usuário tem acesso a esta execução
    if (!podeAcessarExecucao(user as AuthenticatedUser, execucao as Execucao)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para acessar esta execução',
        },
        { status: 403 }
      );
    }

    // Enriquecer dados com validações e progresso
    const execucaoEnriquecida = {
      ...execucao,
      validacao: validarExecucao(execucao as Execucao),
      progresso_detalhado: calcularProgressoDetalhado(execucao as Execucao),
    };

    return NextResponse.json({
      success: true,
      execucao: execucaoEnriquecida,
    });
  } catch (error) {
    console.error('Erro na API de execução:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT - SALVAR RESPOSTAS
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

    const { id: execucaoId } = await params;
    const body = await request.json();

    // Validar dados de entrada
    const validatedData = SalvarRespostasSchema.parse(body);
    const { respostas, observacoes, auto_save } = validatedData;

    const supabase = await getAdminClient();

    // Buscar execução atual
    const { data: execucao, error: fetchError } = await supabase
      .from('checklist_execucoes')
      .select('*')
      .eq('id', execucaoId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar execução:', fetchError);
      return NextResponse.json(
        {
          error: 'Execução não encontrada',
        },
        { status: 404 }
      );
    }

    // Verificar permissões de edição
    if (!podeEditarExecucao(user as AuthenticatedUser, execucao as Execucao)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para editar esta execução',
        },
        { status: 403 }
      );
    }

    // Validar respostas
    const validacao = validarRespostas(
      respostas as Respostas,
      execucao.checklist?.estrutura || {}
    );

    if (!validacao.valido) {
      return NextResponse.json(
        {
          error: 'Respostas inválidas',
          detalhes: validacao.erros,
        },
        { status: 400 }
      );
    }

    // Calcular progresso
    const progresso = calcularProgresso(
      respostas as Respostas,
      execucao.checklist?.tempo_estimado || 30
    );

    // Preparar dados para atualização
    const dadosAtualizacao: any = {
      respostas: respostas as Respostas,
      progresso: progresso.percentual,
      tempo_decorrido: progresso.tempo_decorrido,
      itens_respondidos: progresso.itens_respondidos,
      total_itens: progresso.total_itens,
      updated_at: new Date().toISOString(),
    };

    // Se não for auto-save, atualizar observações
    if (!auto_save && observacoes !== undefined) {
      dadosAtualizacao.observacoes = observacoes;
    }

    // Se completou 100%, marcar como concluído
    if (progresso.percentual >= 100 && execucao.status !== 'concluido') {
      dadosAtualizacao.status = 'concluido';
      dadosAtualizacao.concluido_em = new Date().toISOString();
    }

    // Atualizar execução
    const { error: updateError } = await supabase
      .from('checklist_execucoes')
      .update(dadosAtualizacao)
      .eq('id', execucaoId);

    if (updateError) {
      console.error('Erro ao atualizar execução:', updateError);
      return NextResponse.json(
        {
          error: 'Erro ao salvar respostas',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: auto_save ? 'Auto-save realizado' : 'Respostas salvas com sucesso',
      progresso,
      validacao,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          detalhes: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('Erro ao salvar respostas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - FINALIZAR EXECUÇÃO
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

    const { id: execucaoId } = await params;
    const supabase = await getAdminClient();

    // Buscar execução
    const { data: execucao, error: fetchError } = await supabase
      .from('checklist_execucoes')
      .select('*')
      .eq('id', execucaoId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar execução:', fetchError);
      return NextResponse.json(
        {
          error: 'Execução não encontrada',
        },
        { status: 404 }
      );
    }

    // Verificar permissões de edição
    if (!podeEditarExecucao(user as AuthenticatedUser, execucao as Execucao)) {
      return NextResponse.json(
        {
          error: 'Sem permissão para editar esta execução',
        },
        { status: 403 }
      );
    }

    // Finalizar execução
    const { error: updateError } = await supabase
      .from('checklist_execucoes')
      .update({
        status: 'concluido',
        concluido_em: new Date().toISOString(),
        progresso: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', execucaoId);

    if (updateError) {
      console.error('Erro ao finalizar execução:', updateError);
      return NextResponse.json(
        {
          error: 'Erro ao finalizar execução',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Execução finalizada com sucesso',
    });
  } catch (error) {
    console.error('Erro ao finalizar execução:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function podeAcessarExecucao(
  user: AuthenticatedUser,
  execucao: Execucao
): boolean {
  // Admin e financeiro podem acessar tudo
  if (['admin', 'financeiro'].includes(user.role)) return true;

  // Funcionário só pode acessar suas próprias execuções
  if (user.role === 'funcionario') {
    return user.auth_id === execucao.funcionario_id;
  }

  // Gerente pode acessar execuções do seu bar
  if (user.role === 'gerente' && user.bar_id) {
    return execucao.checklist?.setor === user.bar_id.toString();
  }

  return false;
}

function podeEditarExecucao(
  user: AuthenticatedUser,
  execucao: Execucao
): boolean {
  // Só pode editar se não estiver concluído
  if (execucao.status === 'concluido') return false;

  // Admin e financeiro podem editar tudo
  if (['admin', 'financeiro'].includes(user.role)) return true;

  // Funcionário só pode editar suas próprias execuções
  if (user.role === 'funcionario') {
    return user.auth_id === execucao.funcionario_id;
  }

  // Gerente pode editar execuções do seu bar
  if (user.role === 'gerente' && user.bar_id) {
    return execucao.checklist?.setor === user.bar_id.toString();
  }

  return false;
}

function validarRespostas(
  respostas: Respostas,
  estruturaChecklist: any
): { valido: boolean; erros?: string[] } {
  const erros: string[] = [];

  try {
    // Validar estrutura básica
    if (!respostas.secoes || !Array.isArray(respostas.secoes)) {
      erros.push('Estrutura de respostas inválida');
      return { valido: false, erros };
    }

    // Validar cada seção
    respostas.secoes.forEach((secao, secaoIndex) => {
      if (!secao.itens || !Array.isArray(secao.itens)) {
        erros.push(`Seção ${secaoIndex + 1}: estrutura de itens inválida`);
        return;
      }

      // Validar cada item
      secao.itens.forEach((itemResposta) => {
        // Validar anexos se existirem
        if (itemResposta.anexos && Array.isArray(itemResposta.anexos)) {
          if (itemResposta.anexos.length === 0) {
            erros.push(`Item ${itemResposta.item_id}: anexos vazios`);
          }
        }

        // Validar valor baseado no tipo do campo
        if (itemResposta.respondido) {
          const validacao = validarTipoCampo(
            itemResposta.valor,
            'texto', // TODO: pegar tipo real do checklist
            `Item ${itemResposta.item_id}`
          );
          if (!validacao.valido) {
            erros.push(validacao.erro || 'Valor inválido');
          }
        }
      });
    });

    return {
      valido: erros.length === 0,
      erros: erros.length > 0 ? erros : undefined,
    };
  } catch (error) {
    return {
      valido: false,
      erros: ['Erro na validação: ' + (error as Error).message],
    };
  }
}

function validarTipoCampo(
  valor: any,
  tipo: string,
  titulo: string
): { valido: boolean; erro?: string } {
  if (valor === null || valor === undefined) {
    return { valido: false, erro: `${titulo}: valor obrigatório` };
  }

  switch (tipo) {
    case 'texto':
      return typeof valor === 'string' && valor.trim().length > 0
        ? { valido: true }
        : { valido: false, erro: `${titulo}: texto obrigatório` };

    case 'numero':
      return !isNaN(Number(valor))
        ? { valido: true }
        : { valido: false, erro: `${titulo}: número inválido` };

    case 'data':
      return !isNaN(Date.parse(valor))
        ? { valido: true }
        : { valido: false, erro: `${titulo}: data inválida` };

    case 'sim_nao':
      return typeof valor === 'boolean'
        ? { valido: true }
        : { valido: false, erro: `${titulo}: deve ser sim ou não` };

    default:
      return { valido: true }; // Tipo não reconhecido, aceitar
  }
}

function calcularProgresso(
  respostas: Respostas,
  tempoEstimado: number = 30
): {
  percentual: number;
  tempo_decorrido: number;
  itens_respondidos: number;
  total_itens: number;
  tempo_estimado: number;
} {
  let totalItens = 0;
  let itensRespondidos = 0;

  // Contar itens e respostas
  respostas.secoes.forEach((secao) => {
    totalItens += secao.itens.length;
    itensRespondidos += secao.itens.filter((item) => item.respondido).length;
  });

  const percentual = totalItens > 0 ? (itensRespondidos / totalItens) * 100 : 0;
  const tempoDecorrido = (percentual / 100) * tempoEstimado;

  return {
    percentual: Math.round(percentual),
    tempo_decorrido: Math.round(tempoDecorrido),
    itens_respondidos: itensRespondidos,
    total_itens: totalItens,
    tempo_estimado: tempoEstimado,
  };
}

function validarExecucao(execucao: Execucao) {
  const validacao = {
    valida: true,
    erros: [] as string[],
    avisos: [] as string[],
  };

  // Validar se tem respostas
  if (!execucao.respostas || Object.keys(execucao.respostas).length === 0) {
    validacao.avisos.push('Execução sem respostas');
  }

  // Validar progresso
  if (execucao.status === 'concluido' && (execucao.progresso || 0) < 100) {
    validacao.avisos.push('Execução marcada como concluída mas progresso < 100%');
  }

  return validacao;
}

function calcularProgressoDetalhado(execucao: Execucao) {
  const iniciadoEm = new Date(execucao.iniciado_em);
  const agora = new Date();
  const tempoDecorridoMinutos = Math.round(
    (agora.getTime() - iniciadoEm.getTime()) / (1000 * 60)
  );

  const progressoBasico = calcularProgresso(
    execucao.respostas as Respostas,
    execucao.checklist?.tempo_estimado || 30
  );

  return {
    ...progressoBasico,
    tempo_decorrido_real: tempoDecorridoMinutos,
    tempo_estimado: execucao.checklist?.tempo_estimado || 30,
    percentual_tempo: progressoBasico.tempo_estimado > 0
      ? (tempoDecorridoMinutos / progressoBasico.tempo_estimado) * 100
      : 0,
    status_descricao: getStatusDescricao(execucao.status),
    pode_continuar: ['em_andamento', 'pausado'].includes(execucao.status),
  };
}

function getStatusDescricao(status: string): string {
  const statusMap: Record<string, string> = {
    'em_andamento': 'Em Andamento',
    'pausado': 'Pausado',
    'concluido': 'Concluído',
    'cancelado': 'Cancelado',
  };
  return statusMap[status] || 'Desconhecido';
}
