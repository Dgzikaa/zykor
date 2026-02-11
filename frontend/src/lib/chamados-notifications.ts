import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ========================================
// 🎫 SERVIÇO DE NOTIFICAÇÕES PARA CHAMADOS
// ========================================

interface ChamadoNotificationOptions {
  bar_id: number;
  chamado_id: string;
  numero_chamado: number;
  titulo_chamado: string;
  usuario_id: string;
  tipo: 'novo_chamado' | 'resposta_suporte' | 'resposta_cliente' | 'status_alterado' | 'sla_alerta' | 'avaliacao';
  mensagem?: string;
  dados_extras?: Record<string, any>;
}

/**
 * Envia notificação relacionada a chamados
 */
export async function enviarNotificacaoChamado(options: ChamadoNotificationOptions): Promise<boolean> {
  const { 
    bar_id, 
    chamado_id, 
    numero_chamado, 
    titulo_chamado, 
    usuario_id, 
    tipo,
    mensagem,
    dados_extras 
  } = options;

  try {
    // Definir título e mensagem baseado no tipo
    let titulo = '';
    let conteudo = '';

    switch (tipo) {
      case 'novo_chamado':
        titulo = `Novo chamado #${numero_chamado}`;
        conteudo = `Seu chamado "${titulo_chamado}" foi registrado com sucesso.`;
        break;
      
      case 'resposta_suporte':
        titulo = `Resposta no chamado #${numero_chamado}`;
        conteudo = `A equipe de suporte respondeu ao chamado "${titulo_chamado}".`;
        break;
      
      case 'resposta_cliente':
        titulo = `Nova mensagem no chamado #${numero_chamado}`;
        conteudo = `O cliente enviou uma nova mensagem no chamado "${titulo_chamado}".`;
        break;
      
      case 'status_alterado':
        titulo = `Status alterado - Chamado #${numero_chamado}`;
        conteudo = mensagem || `O status do chamado "${titulo_chamado}" foi alterado.`;
        break;
      
      case 'sla_alerta':
        titulo = `⚠️ SLA em risco - Chamado #${numero_chamado}`;
        conteudo = `O chamado "${titulo_chamado}" está próximo de violar o SLA. Ação necessária.`;
        break;
      
      case 'avaliacao':
        titulo = `Avaliação recebida - Chamado #${numero_chamado}`;
        conteudo = `O cliente avaliou o chamado "${titulo_chamado}".`;
        break;
      
      default:
        titulo = `Atualização - Chamado #${numero_chamado}`;
        conteudo = mensagem || `Houve uma atualização no chamado "${titulo_chamado}".`;
    }

    // Inserir na tabela de notificações
    const { error } = await supabase
      .from('notificacoes')
      .insert({
        bar_id,
        usuario_id,
        tipo: tipo === 'sla_alerta' ? 'alerta' : 'info',
        titulo,
        mensagem: conteudo,
        dados: {
          chamado_id,
          numero_chamado,
          titulo_chamado,
          tipo_notificacao: tipo,
          ...dados_extras
        },
        canais: ['app'],
        status: 'pendente'
      });

    if (error) {
      console.error('Erro ao enviar notificação de chamado:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação de chamado:', error);
    return false;
  }
}

/**
 * Notifica sobre chamados com SLA em risco
 * Chamado periodicamente por um cron job
 */
export async function verificarSLAChamados(): Promise<{ verificados: number; alertas: number }> {
  try {
    // Buscar chamados com SLA em risco (menos de 4 horas para vencer)
    const { data: chamados } = await supabase
      .from('chamados')
      .select('*')
      .in('status', ['aberto', 'em_andamento', 'aguardando_suporte'])
      .eq('sla_violado', false);

    if (!chamados || chamados.length === 0) {
      return { verificados: 0, alertas: 0 };
    }

    let alertasEnviados = 0;
    const agora = new Date();

    for (const chamado of chamados) {
      const criado = new Date(chamado.criado_em);
      const slaHoras = chamado.sla_resolucao_horas || 72;
      const prazoSLA = new Date(criado.getTime() + slaHoras * 60 * 60 * 1000);
      const horasRestantes = (prazoSLA.getTime() - agora.getTime()) / (1000 * 60 * 60);

      // Se menos de 4 horas ou 10% do SLA restante (o que for maior)
      const limiteAlerta = Math.max(4, slaHoras * 0.1);

      if (horasRestantes > 0 && horasRestantes <= limiteAlerta) {
        // Verificar se já não enviamos alerta recentemente
        const { count } = await supabase
          .from('notificacoes')
          .select('*', { count: 'exact', head: true })
          .eq('dados->chamado_id', chamado.id)
          .eq('dados->tipo_notificacao', 'sla_alerta')
          .gte('criada_em', new Date(agora.getTime() - 4 * 60 * 60 * 1000).toISOString());

        if (!count || count === 0) {
          await enviarNotificacaoChamado({
            bar_id: chamado.bar_id,
            chamado_id: chamado.id,
            numero_chamado: chamado.numero_chamado,
            titulo_chamado: chamado.titulo,
            usuario_id: chamado.atribuido_para || chamado.criado_por,
            tipo: 'sla_alerta',
            dados_extras: {
              horas_restantes: horasRestantes.toFixed(1),
              prazo_sla: prazoSLA.toISOString()
            }
          });
          alertasEnviados++;
        }
      }
    }

    return { verificados: chamados.length, alertas: alertasEnviados };
  } catch (error) {
    console.error('Erro ao verificar SLA de chamados:', error);
    return { verificados: 0, alertas: 0 };
  }
}

/**
 * Busca chamados pendentes para o usuário
 */
export async function getChamadosPendentesUsuario(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('chamados')
      .select('*', { count: 'exact', head: true })
      .eq('criado_por', userId)
      .in('status', ['aberto', 'em_andamento', 'aguardando_cliente']);

    return count || 0;
  } catch (error) {
    console.error('Erro ao buscar chamados pendentes:', error);
    return 0;
  }
}

/**
 * Retorna resumo de chamados para exibir no dashboard
 */
export async function getResumoChamadosBar(barId: number): Promise<{
  abertos: number;
  em_andamento: number;
  aguardando: number;
  sla_violados: number;
}> {
  try {
    const { data } = await supabase
      .from('chamados')
      .select('status, sla_violado')
      .eq('bar_id', barId)
      .in('status', ['aberto', 'em_andamento', 'aguardando_cliente', 'aguardando_suporte']);

    const chamados = data || [];

    return {
      abertos: chamados.filter(c => c.status === 'aberto').length,
      em_andamento: chamados.filter(c => c.status === 'em_andamento').length,
      aguardando: chamados.filter(c => c.status === 'aguardando_cliente' || c.status === 'aguardando_suporte').length,
      sla_violados: chamados.filter(c => c.sla_violado).length
    };
  } catch (error) {
    console.error('Erro ao buscar resumo de chamados:', error);
    return { abertos: 0, em_andamento: 0, aguardando: 0, sla_violados: 0 };
  }
}
