import { ChatContext, AgentResponse, DEEP_LINKS } from './types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatResponse(
  intent: string,
  data: Record<string, unknown>,
  context: ChatContext
): AgentResponse {
  switch (intent) {
    case 'faturamento': {
      const fat = data.faturamento as number;
      const meta = data.meta as number;
      const ating = data.atingimento as number;
      const clientes = data.clientes as number;
      const ticket = data.ticketMedio as number;
      const periodo = data.periodo as string;

      const periodoLabel = periodo === 'ontem' ? 'ontem' : 
                          periodo === 'mes_atual' ? 'este mês' : 'essa semana';

      let insightType: 'success' | 'warning' | 'info' = 'info';
      let insightText = '';
      
      if (ating >= 100) {
        insightType = 'success';
        insightText = 'Meta batida! Continue assim para superar ainda mais.';
      } else if (ating >= 80) {
        insightType = 'info';
        insightText = 'No caminho certo! Mantenha o ritmo.';
      } else {
        insightType = 'warning';
        insightText = 'Atenção: precisa acelerar para bater a meta.';
      }

      return {
        success: true,
        response: `O faturamento ${periodoLabel} foi de **${formatCurrency(fat)}**.\n\n${meta > 0 ? `Isso representa **${formatPercent(ating)}** da meta de ${formatCurrency(meta)}.\n\n` : ''}${clientes > 0 ? `Foram atendidos **${formatNumber(clientes)} clientes** com ticket médio de ${formatCurrency(ticket)}.` : ''}`,
        agent: 'Analista Financeiro',
        metrics: [
          { label: 'Faturamento', value: formatCurrency(fat), trend: ating >= 100 ? 'up' : 'down', percentage: ating },
          { label: 'Meta', value: formatPercent(ating), trend: ating >= 100 ? 'up' : ating >= 80 ? 'neutral' : 'down' },
          { label: 'Clientes', value: formatNumber(clientes), trend: 'neutral' },
          { label: 'Ticket', value: formatCurrency(ticket), trend: ticket >= 100 ? 'up' : 'neutral' }
        ],
        suggestions: ['Comparar com semana passada', 'Ver produtos mais vendidos', 'Analisar por dia'],
        deepLinks: DEEP_LINKS.faturamento,
        insight: { type: insightType, text: insightText }
      };
    }

    case 'clientes': {
      const clientes = data.clientes as number;
      const fat = data.faturamento as number;
      const ticket = data.ticketMedio as number;
      const ticketEntrada = data.ticketEntrada as number || 0;
      const ticketBar = data.ticketBar as number || 0;
      const nomeEvento = data.nomeEvento as string || '';
      const periodo = data.periodo as string;
      const dataConsultada = data.dataConsultada as string || '';

      let periodoLabel = 'ontem';
      if (periodo === 'data_especifica' && dataConsultada) {
        const [ano, mes, dia] = dataConsultada.split('-');
        periodoLabel = `em ${dia}/${mes}/${ano}`;
      } else if (periodo === 'semana_atual') {
        periodoLabel = 'essa semana';
      } else if (periodo === 'hoje') {
        periodoLabel = 'hoje';
      }

      let resposta = '';
      if (clientes > 0) {
        resposta = `${periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1)} tivemos **${formatNumber(clientes)} clientes**!`;
      } else if (fat > 0) {
        resposta = `${periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1)} o faturamento foi de **${formatCurrency(fat)}**.`;
        if (nomeEvento) {
          resposta += `\n\n📌 **Evento:** ${nomeEvento}`;
        }
        resposta += `\n\n⚠️ *Dados de público não disponíveis para esta data (evento especial sem registro de PAX).*`;
      } else {
        resposta = `Não encontrei dados para ${periodoLabel}. Verifique se a data está correta ou se o bar estava aberto.`;
      }

      if (clientes > 0 && fat > 0) {
        resposta += `\n\nO faturamento foi de ${formatCurrency(fat)} com ticket médio de **${formatCurrency(ticket)}**.`;
        if (nomeEvento) {
          resposta += `\n\n📌 **Evento:** ${nomeEvento}`;
        }
      }

      if (ticketEntrada > 0 || ticketBar > 0) {
        resposta += `\n\n🎫 Ticket entrada: ${formatCurrency(ticketEntrada)} | 🍺 Ticket bar: ${formatCurrency(ticketBar)}`;
      }

      const metrics: { label: string; value: string; trend: 'up' | 'down' | 'neutral' }[] = [];
      
      if (clientes > 0) {
        metrics.push({ label: 'Clientes', value: formatNumber(clientes), trend: 'neutral' });
      }
      metrics.push({ label: 'Faturamento', value: formatCurrency(fat), trend: fat > 0 ? 'up' : 'neutral' });
      if (clientes > 0) {
        metrics.push({ label: 'Ticket Médio', value: formatCurrency(ticket), trend: ticket >= 100 ? 'up' : 'neutral' });
      }
      if (ticketEntrada > 0) {
        metrics.push({ label: 'Ticket Entrada', value: formatCurrency(ticketEntrada), trend: 'neutral' });
      }
      if (ticketBar > 0) {
        metrics.push({ label: 'Ticket Bar', value: formatCurrency(ticketBar), trend: 'neutral' });
      }

      return {
        success: true,
        response: resposta,
        agent: 'Analista de Clientes',
        metrics,
        suggestions: clientes > 0 
          ? ['Ver clientes VIP', 'Analisar retenção', 'Horário de pico']
          : ['Ver faturamento por hora', 'Produtos vendidos', 'Comparar com outros dias'],
        data: {
          faturamento: fat,
          publico: clientes,
          ticketMedio: ticket
        }
      };
    }

    case 'cmv': {
      const cmvAtual = data.cmvAtual as number;
      const cmvAnterior = data.cmvAnterior as number;
      const metaCMV = data.metaCMV as number;
      const variacao = cmvAnterior > 0 ? cmvAtual - cmvAnterior : 0;

      let insightType: 'success' | 'warning' | 'info' = 'info';
      let insightText = '';
      
      if (cmvAtual <= metaCMV) {
        insightType = 'success';
        insightText = 'CMV dentro da meta! Bom controle de custos.';
      } else if (cmvAtual <= metaCMV + 2) {
        insightType = 'warning';
        insightText = 'Atenção: próximo do limite. Monitore compras e desperdício.';
      } else {
        insightType = 'warning';
        insightText = 'CMV acima do limite! Revisar fornecedores e controle de estoque.';
      }

      return {
        success: true,
        response: `O CMV da última semana está em **${formatPercent(cmvAtual)}**.\n\nA meta é manter abaixo de ${formatPercent(metaCMV)}.${variacao !== 0 ? ` Comparado com a semana anterior, ${variacao > 0 ? 'subiu' : 'caiu'} ${formatPercent(Math.abs(variacao))}.` : ''}`,
        agent: 'Analista de Custos',
        metrics: [
          { label: 'CMV Atual', value: formatPercent(cmvAtual), trend: cmvAtual <= metaCMV ? 'up' : 'down' },
          { label: 'Meta', value: formatPercent(metaCMV), trend: 'neutral' },
          { label: 'Variação', value: `${variacao >= 0 ? '+' : ''}${formatPercent(variacao)}`, trend: variacao <= 0 ? 'up' : 'down' }
        ],
        suggestions: ['Ver produtos com maior custo', 'Analisar desperdício', 'Comparar por categoria'],
        deepLinks: DEEP_LINKS.cmv,
        insight: { type: insightType, text: insightText }
      };
    }

    case 'meta': {
      const fatMes = data.faturamentoMes as number;
      const metaMes = data.metaMes as number;
      const ating = data.atingimento as number;
      const diasRestantes = data.diasRestantes as number;
      const necessario = data.necessarioPorDia as number;

      let insightType: 'success' | 'warning' | 'info' = 'info';
      let insightText = '';
      
      if (ating >= 100) {
        insightType = 'success';
        insightText = 'Meta do mês já batida! Excelente trabalho!';
      } else if (ating >= 80) {
        insightType = 'info';
        insightText = 'Caminho certo, continue assim!';
      } else {
        insightType = 'warning';
        insightText = 'Vamos acelerar! Foco nos próximos eventos.';
      }

      return {
        success: true,
        response: `O progresso da meta mensal está em **${formatPercent(ating)}**!\n\nFaturamento: ${formatCurrency(fatMes)} de ${formatCurrency(metaMes)}\n\n${diasRestantes > 0 && ating < 100 ? `Faltam **${diasRestantes} dias** e será necessário **${formatCurrency(necessario)}/dia** para bater a meta.` : ''}`,
        agent: 'Analista de Metas',
        metrics: [
          { label: 'Realizado', value: formatCurrency(fatMes), trend: 'neutral', percentage: ating },
          { label: 'Meta', value: formatCurrency(metaMes), trend: 'neutral' },
          { label: 'Atingimento', value: formatPercent(ating), trend: ating >= 80 ? 'up' : 'down' },
          { label: 'Necessário/dia', value: formatCurrency(necessario), trend: 'neutral' }
        ],
        suggestions: ['Ver faturamento por dia', 'Analisar semana atual', 'Melhores eventos do mês'],
        deepLinks: DEEP_LINKS.meta,
        insight: { type: insightType, text: insightText }
      };
    }

    case 'produto': {
      const produtos = data.topProdutos as { prd_desc: string; qtd: number; valorfinal: number }[];

      if (!produtos || produtos.length === 0) {
        return {
          success: true,
          response: 'Não encontrei dados de produtos para esse período.',
          agent: 'Analista de Produtos'
        };
      }

      const lista = produtos.slice(0, 5).map((p, i) => 
        `${i + 1}. **${p.prd_desc}** - ${formatCurrency(p.valorfinal)} (${formatNumber(p.qtd)} un.)`
      ).join('\n');

      return {
        success: true,
        response: `🏆 **Top 5 Produtos da Semana**\n\n${lista}`,
        agent: 'Analista de Produtos',
        suggestions: ['Ver por categoria', 'Analisar margem', 'Comparar com semana passada']
      };
    }

    case 'comparativo_dias': {
      const eventos = data.eventos as { diaSemana: string; real_r: number; cl_real: number; nome: string }[];
      const melhor = data.melhorDia as { diaSemana: string; real_r: number; cl_real: number; nome: string };
      const pior = data.piorDia as { diaSemana: string; real_r: number; cl_real: number; nome: string };
      const diasMencionados = data.diasMencionados as string[];

      if (!eventos || eventos.length === 0) {
        return {
          success: true,
          response: 'Não encontrei dados de eventos para comparar dias.',
          agent: 'Analista Comparativo'
        };
      }

      if (diasMencionados && diasMencionados.length >= 2) {
        const dia1 = eventos.find(e => e.diaSemana?.toLowerCase().includes(diasMencionados[0]));
        const dia2 = eventos.find(e => e.diaSemana?.toLowerCase().includes(diasMencionados[1]));

        if (dia1 && dia2) {
          const vencedor = (dia1.real_r || 0) > (dia2.real_r || 0) ? dia1 : dia2;
          const perdedor = vencedor === dia1 ? dia2 : dia1;
          const diff = (vencedor.real_r || 0) - (perdedor.real_r || 0);

          return {
            success: true,
            response: `📊 **${vencedor.diaSemana} foi melhor!**\n\n**${vencedor.diaSemana}** (${vencedor.nome || 'evento'}): ${formatCurrency(vencedor.real_r || 0)}\n**${perdedor.diaSemana}** (${perdedor.nome || 'evento'}): ${formatCurrency(perdedor.real_r || 0)}\n\nDiferença: **${formatCurrency(diff)}** a mais no ${vencedor.diaSemana}`,
            agent: 'Analista Comparativo',
            metrics: [
              { label: vencedor.diaSemana, value: formatCurrency(vencedor.real_r || 0), trend: 'up' },
              { label: perdedor.diaSemana, value: formatCurrency(perdedor.real_r || 0), trend: 'down' },
              { label: 'Diferença', value: formatCurrency(diff), trend: 'neutral' }
            ],
            suggestions: ['Ver clientes por dia', 'Analisar ticket', 'Histórico mensal']
          };
        }
      }

      return {
        success: true,
        response: `📊 **Comparativo de Dias**\n\n🥇 **Melhor**: ${melhor?.diaSemana || '-'} com ${formatCurrency(melhor?.real_r || 0)}\n🥉 **Pior**: ${pior?.diaSemana || '-'} com ${formatCurrency(pior?.real_r || 0)}`,
        agent: 'Analista Comparativo',
        metrics: [
          { label: 'Melhor Dia', value: melhor?.diaSemana || '-', trend: 'up' },
          { label: 'Faturamento', value: formatCurrency(melhor?.real_r || 0), trend: 'up' }
        ],
        suggestions: ['Comparar sexta e sábado', 'Ver evolução semanal', 'Analisar horários']
      };
    }

    case 'comparativo_periodos': {
      const atual = data.semanaAtual as { faturamento: number; clientes: number };
      const passada = data.semanaPassada as { faturamento: number; clientes: number };
      const varFat = data.variacaoFat as number;
      const varCli = data.variacaoClientes as number;

      const fatMelhor = varFat >= 0;
      const cliMelhor = varCli >= 0;

      let insightType: 'success' | 'warning' | 'info' = 'info';
      let insightText = '';
      
      if (fatMelhor && cliMelhor) {
        insightType = 'success';
        insightText = 'Ótimo! Tanto faturamento quanto clientes cresceram.';
      } else if (!fatMelhor && !cliMelhor) {
        insightType = 'warning';
        insightText = 'Atenção: queda em faturamento e clientes.';
      } else {
        insightType = 'info';
        insightText = fatMelhor ? 'Faturamento subiu mesmo com menos clientes - ticket aumentou!' : 'Mais clientes, mas faturamento menor - verifique o ticket.';
      }

      return {
        success: true,
        response: `📊 **Comparativo Semanal**\n\n**Esta semana:**\n• Faturamento: ${formatCurrency(atual?.faturamento || 0)}\n• Clientes: ${formatNumber(atual?.clientes || 0)}\n\n**Semana passada:**\n• Faturamento: ${formatCurrency(passada?.faturamento || 0)}\n• Clientes: ${formatNumber(passada?.clientes || 0)}\n\n**Variação:**\n• Faturamento: ${fatMelhor ? '📈' : '📉'} ${varFat >= 0 ? '+' : ''}${formatPercent(varFat)}\n• Clientes: ${cliMelhor ? '📈' : '📉'} ${varCli >= 0 ? '+' : ''}${formatPercent(varCli)}`,
        agent: 'Analista Comparativo',
        metrics: [
          { label: 'Fat. Atual', value: formatCurrency(atual?.faturamento || 0), trend: fatMelhor ? 'up' : 'down' },
          { label: 'Fat. Anterior', value: formatCurrency(passada?.faturamento || 0), trend: 'neutral' },
          { label: 'Variação', value: `${varFat >= 0 ? '+' : ''}${formatPercent(varFat)}`, trend: fatMelhor ? 'up' : 'down' }
        ],
        suggestions: ['Ver por dia', 'Analisar produtos', 'Comparar meses'],
        deepLinks: DEEP_LINKS.comparativo_periodos,
        chartData: [
          { label: 'Passada', value: passada?.faturamento || 0, color: 'bg-gray-500' },
          { label: 'Atual', value: atual?.faturamento || 0, color: fatMelhor ? 'bg-green-500' : 'bg-red-500' }
        ],
        insight: { type: insightType, text: insightText }
      };
    }

    case 'tendencia': {
      const tendFat = data.tendenciaFat as string;
      const tendTicket = data.tendenciaTicket as string;
      const ultima = data.ultimaSemana as { faturamento: number; clientes: number; ticketMedio: number };
      const penultima = data.penultimaSemana as { faturamento: number; clientes: number; ticketMedio: number };
      const semanas = data.semanas as { semana: number; faturamento: number }[] || [];

      const iconFat = tendFat === 'subindo' ? '📈' : tendFat === 'caindo' ? '📉' : '➡️';
      const iconTicket = tendTicket === 'subindo' ? '📈' : tendTicket === 'caindo' ? '📉' : '➡️';

      const labelFat = tendFat === 'subindo' ? 'crescendo' : tendFat === 'caindo' ? 'caindo' : 'estável';
      const labelTicket = tendTicket === 'subindo' ? 'crescendo' : tendTicket === 'caindo' ? 'caindo' : 'estável';

      let insightType: 'success' | 'warning' | 'info' = 'info';
      let insightText = '';
      
      if (tendFat === 'subindo' && tendTicket === 'subindo') {
        insightType = 'success';
        insightText = 'Excelente! Faturamento e ticket médio em alta.';
      } else if (tendFat === 'caindo') {
        insightType = 'warning';
        insightText = 'Faturamento em queda. Analise eventos e promoções.';
      } else {
        insightType = 'info';
        insightText = 'Tendência estável. Bom momento para experimentar novidades.';
      }

      const chartData = semanas.slice(-4).map((s, idx) => ({
        label: `S${idx + 1}`,
        value: s.faturamento,
        color: idx === semanas.length - 1 
          ? (tendFat === 'subindo' ? 'bg-green-500' : tendFat === 'caindo' ? 'bg-red-500' : 'bg-blue-500')
          : 'bg-gray-500'
      }));

      return {
        success: true,
        response: `📊 **Análise de Tendência**\n\n**Faturamento**: ${iconFat} ${labelFat}\nÚltima semana: ${formatCurrency(ultima?.faturamento || 0)}\nAnterior: ${formatCurrency(penultima?.faturamento || 0)}\n\n**Ticket Médio**: ${iconTicket} ${labelTicket}\nÚltimo: ${formatCurrency(ultima?.ticketMedio || 0)}\nAnterior: ${formatCurrency(penultima?.ticketMedio || 0)}`,
        agent: 'Analista de Tendências',
        metrics: [
          { label: 'Faturamento', value: labelFat, trend: tendFat === 'subindo' ? 'up' : tendFat === 'caindo' ? 'down' : 'neutral' },
          { label: 'Ticket', value: labelTicket, trend: tendTicket === 'subindo' ? 'up' : tendTicket === 'caindo' ? 'down' : 'neutral' }
        ],
        suggestions: ['Ver últimas 4 semanas', 'Analisar sazonalidade', 'Comparar com ano passado'],
        deepLinks: DEEP_LINKS.tendencia,
        chartData: chartData.length > 0 ? chartData : undefined,
        insight: { type: insightType, text: insightText }
      };
    }

    case 'meta_projecao': {
      const fatMes = data.faturamentoMes as number;
      const metaMes = data.metaMes as number;
      const ating = data.atingimento as number;
      const diasRestantes = data.diasRestantes as number;
      const necessario = data.necessarioPorDia as number;
      const mediaAtual = data.mediaDiariaAtual as number;
      const projecao = data.projecaoFimMes as number;
      const vaiAtingir = data.vaiAtingir as boolean;

      const status = vaiAtingir ? '✅ No ritmo atual, a meta será batida!' : '⚠️ Precisa acelerar para bater a meta';

      return {
        success: true,
        response: `📊 **Projeção de Meta**\n\n${status}\n\nRealizado: **${formatCurrency(fatMes)}** (${formatPercent(ating)})\nMeta: **${formatCurrency(metaMes)}**\n\nFaltam **${diasRestantes} dias** e você precisa de **${formatCurrency(necessario)}/dia**.\n\nMédia atual: ${formatCurrency(mediaAtual)}/dia\nProjeção fim do mês: ${formatCurrency(projecao)}`,
        agent: 'Analista de Metas',
        metrics: [
          { label: 'Realizado', value: formatCurrency(fatMes), trend: 'neutral' },
          { label: 'Meta', value: formatCurrency(metaMes), trend: 'neutral' },
          { label: 'Atingimento', value: formatPercent(ating), trend: ating >= 80 ? 'up' : 'down' },
          { label: 'Necessário/dia', value: formatCurrency(necessario), trend: 'neutral' }
        ],
        suggestions: ['Ver faturamento por dia', 'Analisar semana atual', 'Melhores eventos do mês']
      };
    }

    case 'resumo': {
      const fatSemana = data.fatSemana as number;
      const clientesSemana = data.clientesSemana as number;
      const ating = data.atingimento as number;
      const ticket = data.ticketMedio as number;
      const cmv = (data.cmv as number) || 0;

      return {
        success: true,
        response: `📊 **Resumo da Semana**\n\n💰 Faturamento: **${formatCurrency(fatSemana)}**\n👥 Clientes: **${formatNumber(clientesSemana)}**\n🎟️ Ticket Médio: **${formatCurrency(ticket)}**\n📈 Atingimento: **${formatPercent(ating)}**`,
        agent: 'Assistente Zykor',
        metrics: [
          { label: 'Faturamento', value: formatCurrency(fatSemana), trend: 'neutral' },
          { label: 'Clientes', value: formatNumber(clientesSemana), trend: 'neutral' },
          { label: 'Ticket', value: formatCurrency(ticket), trend: 'neutral' },
          { label: 'Meta', value: formatPercent(ating), trend: ating >= 80 ? 'up' : 'down' }
        ],
        suggestions: ['Ver por dia', 'Comparar com semana passada', 'Produtos mais vendidos'],
        data: {
          faturamento: fatSemana,
          publico: clientesSemana,
          atingimento: ating,
          cmv: cmv,
          ticketMedio: ticket
        }
      };
    }

    case 'ticket': {
      const eventos = (data as { eventos?: { cl_real: number; real_r: number }[] }).eventos || [];
      const totalClientes = eventos.reduce((acc, e) => acc + (e.cl_real || 0), 0);
      const totalFat = eventos.reduce((acc, e) => acc + (e.real_r || 0), 0);
      const ticketAtual = totalClientes > 0 ? totalFat / totalClientes : 0;

      return {
        success: true,
        response: `🎟️ **Ticket Médio**\n\nO ticket médio da semana está em **${formatCurrency(ticketAtual)}**.\n\nBase: ${formatCurrency(totalFat)} / ${formatNumber(totalClientes)} clientes`,
        agent: 'Analista de Vendas',
        metrics: [
          { label: 'Ticket Médio', value: formatCurrency(ticketAtual), trend: ticketAtual >= 100 ? 'up' : 'neutral' },
          { label: 'Faturamento', value: formatCurrency(totalFat), trend: 'neutral' },
          { label: 'Clientes', value: formatNumber(totalClientes), trend: 'neutral' }
        ],
        suggestions: ['Ver evolução do ticket', 'Comparar por evento', 'Analisar por produto']
      };
    }

    case 'operacional': {
      return {
        success: true,
        response: `⏰ **Informações Operacionais**\n\nO bar opera de **Quarta a Domingo**.\n\n• Quarta/Quinta: 18h às 00h\n• Sexta/Sábado: 18h às 02h\n• Domingo: 12h às 22h\n\nPara análise de pico, me pergunte sobre um dia específico!`,
        agent: 'Assistente Operacional',
        suggestions: ['Movimento de sexta', 'Horário de pico', 'Comparar dias']
      };
    }

    case 'instagram': {
      const seguidores = data.seguidoresAtual as number;
      const variacao = data.variacaoSeguidores as number;
      const posts = data.mediaCount as number;

      return {
        success: true,
        response: `📱 **Instagram @ordinariobar**\n\n👥 **Seguidores:** ${formatNumber(seguidores)}\n${variacao !== 0 ? `📊 **Variação:** ${variacao >= 0 ? '+' : ''}${formatNumber(variacao)} (último dia)` : ''}\n📸 **Posts:** ${formatNumber(posts)}\n\nPara mais detalhes de stories e engajamento, acesse o painel de redes sociais.`,
        agent: 'Analista de Redes Sociais',
        metrics: [
          { label: 'Seguidores', value: formatNumber(seguidores), trend: 'neutral' },
          { label: 'Variação', value: `${variacao >= 0 ? '+' : ''}${formatNumber(variacao)}`, trend: variacao >= 0 ? 'up' : 'down' },
          { label: 'Posts', value: formatNumber(posts), trend: 'neutral' }
        ],
        suggestions: ['Ver stories', 'Engajamento da semana', 'Comparar com mês passado']
      };
    }

    case 'estoque': {
      const totalRupturas = data.totalRupturas as number;
      const produtosMaisAfetados = data.produtosMaisAfetados as { nome: string; tempoTotal: number; vezes: number }[];
      const dataConsulta = data.dataConsulta as string;

      if (totalRupturas === 0) {
        return {
          success: true,
          response: `✅ **Nenhuma ruptura de estoque registrada** para ${dataConsulta}.\n\nTodos os produtos estavam disponíveis durante a operação!`,
          agent: 'Analista de Estoque',
          suggestions: ['Ver histórico de rupturas', 'Produtos mais vendidos', 'CMV semanal']
        };
      }

      const lista = produtosMaisAfetados.slice(0, 3).map((p, i) => 
        `${i + 1}. **${p.nome}** - ${p.tempoTotal} min (${p.vezes}x)`
      ).join('\n');

      return {
        success: true,
        response: `⚠️ **Rupturas de Estoque** (${dataConsulta})\n\nTotal: **${totalRupturas} ocorrências**\n\n🔴 **Produtos mais afetados:**\n${lista}\n\nAtenção: rupturas impactam diretamente o faturamento!`,
        agent: 'Analista de Estoque',
        metrics: [
          { label: 'Rupturas', value: String(totalRupturas), trend: totalRupturas > 5 ? 'down' : 'neutral' },
          { label: 'Produtos afetados', value: String(produtosMaisAfetados.length), trend: 'down' }
        ],
        insight: totalRupturas > 5 
          ? { type: 'warning', text: 'Muitas rupturas! Revisar estoque e fornecedores.' }
          : { type: 'info', text: 'Monitore os produtos críticos para evitar rupturas.' },
        suggestions: ['Ver CMV', 'Produtos mais vendidos', 'Histórico de rupturas']
      };
    }

    case 'calendario': {
      const eventosFuturos = data.eventosFuturos as { data: string; artista: string; genero: string; status: string }[];
      const eventosConcorrentes = data.eventosConcorrentes as { data: string; nome_evento: string; local: string }[];
      const proximo = data.proximoEvento as { data: string; artista: string; genero: string } | null;

      if (!proximo && eventosFuturos.length === 0) {
        return {
          success: true,
          response: `📅 **Calendário**\n\nNão há eventos confirmados no calendário.\n\nAcesse o planejamento comercial para adicionar eventos.`,
          agent: 'Assistente de Agenda',
          suggestions: ['Ver faturamento', 'Histórico de eventos', 'Artistas top']
        };
      }

      let resposta = `📅 **Próximos Eventos**\n\n`;
      if (proximo) {
        const [ano, mes, dia] = proximo.data.split('-');
        resposta += `🎵 **Próximo:** ${dia}/${mes} - ${proximo.artista || 'A confirmar'}\n`;
      }

      if (eventosFuturos.length > 1) {
        resposta += `\n**Esta semana:**\n`;
        eventosFuturos.slice(0, 5).forEach(e => {
          const [ano, mes, dia] = e.data.split('-');
          resposta += `• ${dia}/${mes}: ${e.artista || 'A confirmar'} (${e.genero || '-'})\n`;
        });
      }

      if (eventosConcorrentes.length > 0) {
        resposta += `\n⚠️ **Eventos concorrentes na cidade:**\n`;
        eventosConcorrentes.slice(0, 3).forEach(e => {
          const [ano, mes, dia] = e.data.split('-');
          resposta += `• ${dia}/${mes}: ${e.nome_evento} @ ${e.local}\n`;
        });
      }

      return {
        success: true,
        response: resposta,
        agent: 'Assistente de Agenda',
        suggestions: ['Ver artistas top', 'Faturamento por evento', 'Histórico do artista']
      };
    }

    case 'feedback': {
      const totalFeedbacks = data.totalFeedbacks as number;
      const positivos = data.positivos as number;
      const negativos = data.negativos as number;
      const porTipo = data.porTipo as Record<string, number>;
      const feedbacks = data.feedbacks as { tipo_feedback: string; comentario: string; avaliacao_resumo: string }[];

      if (totalFeedbacks === 0) {
        return {
          success: true,
          response: `📋 **Feedbacks**\n\nNenhum feedback encontrado no período.\n\nContinue coletando feedbacks de clientes e artistas!`,
          agent: 'Analista de Satisfação',
          suggestions: ['Ver NPS geral', 'Histórico de feedbacks', 'Pesquisa de felicidade']
        };
      }

      const nps = totalFeedbacks > 0 ? ((positivos - negativos) / totalFeedbacks * 100).toFixed(0) : 0;

      let resposta = `📋 **Feedbacks Recentes** (${totalFeedbacks} respostas)\n\n`;
      resposta += `✅ Positivos: ${positivos} | ❌ Negativos: ${negativos}\n`;
      resposta += `📊 **NPS aproximado:** ${nps}%\n\n`;

      if (Object.keys(porTipo).length > 0) {
        resposta += `**Por tipo:**\n`;
        Object.entries(porTipo).forEach(([tipo, qtd]) => {
          const tipoLabel: Record<string, string> = {
            'artista': '🎵 Artistas',
            'cliente': '👥 Clientes',
            'funcionario_nps': '👨‍💼 Func. NPS',
            'funcionario_felicidade': '😊 Felicidade'
          };
          resposta += `• ${tipoLabel[tipo] || tipo}: ${qtd}\n`;
        });
      }

      const ultimoNegativo = feedbacks.find(f => ['detrator', 'insatisfeito'].includes(f.avaliacao_resumo || ''));
      if (ultimoNegativo && ultimoNegativo.comentario) {
        resposta += `\n⚠️ **Último feedback negativo:**\n"${ultimoNegativo.comentario.substring(0, 100)}..."`;
      }

      return {
        success: true,
        response: resposta,
        agent: 'Analista de Satisfação',
        metrics: [
          { label: 'Total', value: String(totalFeedbacks), trend: 'neutral' },
          { label: 'Positivos', value: String(positivos), trend: 'up' },
          { label: 'Negativos', value: String(negativos), trend: negativos > positivos ? 'down' : 'neutral' },
          { label: 'NPS', value: `${nps}%`, trend: Number(nps) >= 50 ? 'up' : 'down' }
        ],
        suggestions: ['Ver feedbacks de artistas', 'NPS por dia', 'Pesquisa de felicidade']
      };
    }

    default: {
      return {
        success: true,
        response: `Entendi sua pergunta. Para ajudar melhor, posso analisar:\n\n• **Faturamento** - vendas e receitas\n• **Clientes** - público e ticket médio\n• **CMV** - custos de mercadoria\n• **Metas** - progresso mensal\n• **Produtos** - mais vendidos\n• **Instagram** - seguidores e engajamento\n• **Estoque** - rupturas e produtos\n• **Feedbacks** - NPS e satisfação\n• **Calendário** - próximos eventos\n\nSobre o que você quer saber?`,
        agent: 'Assistente Zykor',
        suggestions: ['Faturamento da semana', 'Como está a meta?', 'CMV atual', 'Feedbacks recentes']
      };
    }
  }
}
