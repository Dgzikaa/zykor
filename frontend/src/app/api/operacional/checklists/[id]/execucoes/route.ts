import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { z } from 'zod';

// =====================================================
// INTERFACES E TIPOS
// =====================================================

interface ChecklistEstrutura {
  secoes: Array<{
    id: string;
    titulo: string;
    itens: Array<{
      id: string;
      pergunta: string;
      tipo: string;
      obrigatorio: boolean;
      opcoes?: string[];
    }>;
  }>;
}

interface Checklist {
  id: string;
  nome: string;
  setor: string;
  tipo: string;
  versao: string;
  estrutura: ChecklistEstrutura;
  tempo_estimado: number;
  ativo: boolean;
}

interface Funcionario {
  id: string;
  nome: string;
  role: string;
}

interface ExecucaoProgresso {
  total_itens: number;
  itens_respondidos: number;
  percentual_completo: number;
  tempo_estimado: number;
  tempo_decorrido: number;
}

interface NovaExecucao {
  checklist_id: string;
  funcionario_id: string;
  iniciado_por: string;
  status: string;
  iniciado_em: string;
  observacoes_iniciais?: string;
  agendamento_id?: string;
  versao_checklist: string;
  estrutura_checklist: ChecklistEstrutura;
  respostas: Record<string, unknown>;
  progresso: ExecucaoProgresso;
}

interface ExecucaoCompleta {
  id: string;
  checklist_id: string;
  funcionario_id: string;
  iniciado_por: string;
  status: string;
  iniciado_em: string;
  observacoes_iniciais?: string;
  agendamento_id?: string;
  versao_checklist: string;
  estrutura_checklist: ChecklistEstrutura;
  respostas: Record<string, unknown>;
  progresso: ExecucaoProgresso;
  checklist: {
    nome: string;
    setor: string;
    tipo: string;
  };
  funcionario: {
    nome: string;
    email: string;
  };
  iniciado_por_usuario: {
    nome: string;
    email: string;
  };
}

interface ExecucaoEstatisticas {
  total_execucoes: number;
  completadas: number;
  em_andamento: number;
  pausadas: number;
  canceladas: number;
  tempo_medio: number;
  taxa_conclusao: number;
}

interface ExecucaoParaEstatisticas {
  status: string;
  tempo_decorrido?: number;
  completado_em?: string;
  iniciado_em: string;
}

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const IniciarExecucaoSchema = z.object({
  funcionario_responsavel: z.string().uuid().optional(), // Se não informado, usa o usuário logado
  observacoes_iniciais: z.string().optional(),
  agendamento_id: z.string().uuid().optional(), // Para execuções agendadas
});

// =====================================================
// POST - INICIAR NOVA EXECUÇÃO
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

    const { id: checklistId } = await params;
    const body = await request.json();
    const data = IniciarExecucaoSchema.parse(body);

    const supabase = await getAdminClient();

    // Verificar se checklist existe e está ativo
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', checklistId)
      .eq('bar_id', user.bar_id)
      .eq('ativo', true)
      .single();

    if (checklistError || !checklist) {
      return NextResponse.json(
        {
          error: 'Checklist não encontrado ou inativo',
        },
        { status: 404 }
      );
    }

    const checklistData = checklist as Checklist;

    // Verificar se funcionário existe (se especificado)
    const funcionarioId = data.funcionario_responsavel || user.auth_id;
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios_bar')
      .select('id, nome, role')
      .eq('id', funcionarioId)
      .eq('bar_id', user.bar_id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json(
        {
          error: 'Funcionário não encontrado',
        },
        { status: 404 }
      );
    }

    const funcionarioData = funcionario as Funcionario;

    // Verificar se há execução pendente para este checklist e funcionário
    const { data: execucoesPendentes } = await supabase
      .from('checklist_execucoes')
      .select('id, status')
      .eq('checklist_id', checklistId)
      .eq('funcionario_id', funcionarioId)
      .in('status', ['em_andamento', 'pausado']);

    if (execucoesPendentes && execucoesPendentes.length > 0) {
      return NextResponse.json(
        {
          error: 'Já existe uma execução pendente para este checklist',
          execucao_pendente: execucoesPendentes[0],
        },
        { status: 409 }
      );
    }

    // Gerar estrutura inicial de respostas baseada na estrutura do checklist
    const estruturaRespostas = gerarEstruturaRespostas(
      checklistData.estrutura as ChecklistEstrutura
    );

    // Criar nova execução
    const novaExecucao: NovaExecucao = {
      checklist_id: checklistId,
      funcionario_id: funcionarioId,
      iniciado_por: user.auth_id,
      status: 'em_andamento',
      iniciado_em: new Date().toISOString(),
      observacoes_iniciais: data.observacoes_iniciais,
      agendamento_id: data.agendamento_id,
      versao_checklist: checklistData.versao,
      estrutura_checklist: checklistData.estrutura,
      respostas: estruturaRespostas,
      progresso: {
        total_itens: contarItensTotal(checklistData.estrutura),
        itens_respondidos: 0,
        percentual_completo: 0,
        tempo_estimado: checklistData.tempo_estimado,
        tempo_decorrido: 0,
      },
    };

    const { data: execucao, error: execucaoError } = await supabase
      .from('checklist_execucoes')
      .insert(novaExecucao)
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo),
        funcionario:usuarios_bar!funcionario_id (nome, email),
        iniciado_por_usuario:usuarios_bar!iniciado_por (nome, email)
      `
      )
      .single();

    if (execucaoError) {
      console.error('Erro ao criar execução:', execucaoError);
      return NextResponse.json(
        {
          error: 'Erro ao iniciar execução do checklist',
        },
        { status: 500 }
      );
    }

    const execucaoData = execucao as ExecucaoCompleta;

    return NextResponse.json({
      success: true,
      message: 'Execução iniciada com sucesso',
      data: execucaoData,
    });
  } catch (error: unknown) {
    console.error('Erro na API de iniciar execução:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// GET - LISTAR EXECUÇÕES DO CHECKLIST
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

    const status = searchParams.get('status'); // em_andamento, pausado, completado, cancelado
    const funcionarioId = searchParams.get('funcionario_id');
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const supabase = await getAdminClient();

    // Verificar se checklist existe
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .select('nome, setor')
      .eq('id', checklistId)
      .eq('bar_id', user.bar_id)
      .single();

    if (checklistError || !checklist) {
      return NextResponse.json(
        {
          error: 'Checklist não encontrado',
        },
        { status: 404 }
      );
    }

    const checklistData = checklist as { nome: string; setor: string };

    // Construir query
    let query = supabase
      .from('checklist_execucoes')
      .select(
        `
        *,
        checklist:checklists!checklist_id (nome, setor, tipo),
        funcionario:usuarios_bar!funcionario_id (nome, email),
        iniciado_por_usuario:usuarios_bar!iniciado_por (nome, email)
      `
      )
      .eq('checklist_id', checklistId);

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status);
    }

    if (funcionarioId) {
      query = query.eq('funcionario_id', funcionarioId);
    }

    if (dataInicio) {
      query = query.gte('iniciado_em', dataInicio);
    }

    if (dataFim) {
      query = query.lte('iniciado_em', dataFim);
    }

    // Buscar total para paginação
    const { count } = await query;

    // Buscar execuções com paginação
    const { data: execucoes, error: execucoesError } = await query
      .order('iniciado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (execucoesError) {
      console.error('Erro ao buscar execuções:', execucoesError);
      return NextResponse.json(
        {
          error: 'Erro ao buscar execuções',
        },
        { status: 500 }
      );
    }

    // Calcular estatísticas
    const { data: stats } = await supabase
      .from('checklist_execucoes')
      .select('status, finalizado_em, iniciado_em')
      .eq('checklist_id', checklistId);

    const estatisticas = calcularEstatisticas(
      (stats as ExecucaoParaEstatisticas[]) || []
    );

    return NextResponse.json({
      success: true,
      data: {
        execucoes: (execucoes as ExecucaoCompleta[]) || [],
        checklist: {
          nome: checklistData.nome,
          setor: checklistData.setor,
        },
        estatisticas,
        paginacao: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error: unknown) {
    console.error('Erro na API de listar execuções:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function gerarEstruturaRespostas(
  estruturaChecklist: ChecklistEstrutura
): Record<string, unknown> {
  const respostas: Record<string, unknown> = {};

  estruturaChecklist.secoes.forEach(secao => {
    secao.itens.forEach(item => {
      respostas[item.id] = {
        valor: null,
        observacao: '',
        respondido_em: null,
        obrigatorio: item.obrigatorio,
      };
    });
  });

  return respostas;
}

function contarItensTotal(estrutura: ChecklistEstrutura): number {
  return estrutura.secoes.reduce((total, secao) => {
    return total + secao.itens.length;
  }, 0);
}

function calcularEstatisticas(
  execucoes: ExecucaoParaEstatisticas[]
): ExecucaoEstatisticas {
  const total = execucoes.length;
  const completadas = execucoes.filter(e => e.status === 'completado').length;
  const em_andamento = execucoes.filter(
    e => e.status === 'em_andamento'
  ).length;
  const pausadas = execucoes.filter(e => e.status === 'pausado').length;
  const canceladas = execucoes.filter(e => e.status === 'cancelado').length;

  const tempos = execucoes
    .filter(e => e.tempo_decorrido && e.tempo_decorrido > 0)
    .map(e => e.tempo_decorrido || 0);

  const tempo_medio =
    tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
  const taxa_conclusao = total > 0 ? (completadas / total) * 100 : 0;

  return {
    total_execucoes: total,
    completadas,
    em_andamento,
    pausadas,
    canceladas,
    tempo_medio,
    taxa_conclusao,
  };
}
