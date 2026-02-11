import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - Listar categorias e módulos disponíveis
export async function GET(request: NextRequest) {
  try {
    const categorias = [
      { id: 'bug', label: 'Bug / Erro', descricao: 'Problema técnico ou erro no sistema', icon: 'bug' },
      { id: 'melhoria', label: 'Melhoria', descricao: 'Sugestão de melhoria em funcionalidade existente', icon: 'lightbulb' },
      { id: 'duvida', label: 'Dúvida', descricao: 'Dúvida sobre uso do sistema', icon: 'help-circle' },
      { id: 'sugestao', label: 'Sugestão', descricao: 'Nova funcionalidade ou ideia', icon: 'message-square' },
      { id: 'urgente', label: 'Urgente', descricao: 'Problema crítico que impede o uso do sistema', icon: 'alert-triangle' }
    ];

    const modulos = [
      { id: 'financeiro', label: 'Financeiro', descricao: 'DRE, CMV, NIBO, pagamentos' },
      { id: 'operacional', label: 'Operacional', descricao: 'Checklists, receitas, estoque' },
      { id: 'rh', label: 'RH', descricao: 'Funcionários, folha, provisões' },
      { id: 'marketing', label: 'Marketing', descricao: 'Campanhas, CRM, WhatsApp' },
      { id: 'estrategico', label: 'Estratégico', descricao: 'Desempenho, metas, orçamentação' },
      { id: 'analitico', label: 'Analítico', descricao: 'Relatórios, clientes, vendas' },
      { id: 'configuracoes', label: 'Configurações', descricao: 'Usuários, permissões, integrações' },
      { id: 'outro', label: 'Outro', descricao: 'Outros assuntos' }
    ];

    const prioridades = [
      { id: 'baixa', label: 'Baixa', descricao: 'Pode aguardar, não afeta operação', color: 'gray', sla_horas: 72 },
      { id: 'media', label: 'Média', descricao: 'Problema comum, prazo normal', color: 'blue', sla_horas: 48 },
      { id: 'alta', label: 'Alta', descricao: 'Afeta operação, precisa de atenção', color: 'orange', sla_horas: 24 },
      { id: 'critica', label: 'Crítica', descricao: 'Bloqueia operação, resposta imediata', color: 'red', sla_horas: 4 }
    ];

    const status = [
      { id: 'aberto', label: 'Aberto', descricao: 'Aguardando análise', color: 'blue' },
      { id: 'em_andamento', label: 'Em Andamento', descricao: 'Sendo analisado pela equipe', color: 'yellow' },
      { id: 'aguardando_cliente', label: 'Aguardando Cliente', descricao: 'Aguardando resposta do cliente', color: 'purple' },
      { id: 'aguardando_suporte', label: 'Aguardando Suporte', descricao: 'Aguardando resposta do suporte', color: 'orange' },
      { id: 'resolvido', label: 'Resolvido', descricao: 'Problema resolvido, aguardando confirmação', color: 'green' },
      { id: 'fechado', label: 'Fechado', descricao: 'Chamado encerrado', color: 'gray' },
      { id: 'cancelado', label: 'Cancelado', descricao: 'Chamado cancelado', color: 'red' }
    ];

    return NextResponse.json({
      success: true,
      data: {
        categorias,
        modulos,
        prioridades,
        status
      }
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
