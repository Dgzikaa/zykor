import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Recomendacao {
  tipo: 'evento' | 'produto' | 'horario' | 'dia' | 'grupo' | 'cupom';
  titulo: string;
  descricao: string;
  confianca: number; // 0-100
  razao: string;
  acao_sugerida: string;
}

interface ClienteRecomendacoes {
  telefone: string;
  nome: string;
  total_visitas: number;
  segmento: string;
  recomendacoes: Recomendacao[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telefone = searchParams.get('telefone');
    const limite = parseInt(searchParams.get('limite') || '50');

    if (!telefone) {
      throw new Error('Telefone é obrigatório');
    }

    // Buscar perfil completo do cliente
    const [padroes, ltv, segmento, churn] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/crm/padroes-comportamento?telefone=${telefone}`).then(r => r.json()).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/crm/ltv-engajamento?telefone=${telefone}`).then(r => r.json()).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/crm/segmentacao?telefone=${telefone}`).then(r => r.json()).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/crm/churn-prediction?telefone=${telefone}`).then(r => r.json()).catch(() => null)
    ]);

    // Buscar dados brutos do cliente
    const { data: symplaData } = await supabase
      .from('sympla_participantes')
      .select('data_evento, evento_nome, nome_completo')
      .eq('telefone_normalizado', telefone);

    const { data: getinData } = await supabase
      .from('bronze_getin_reservations')
      .select('reservation_date, people, customer_name')
      .eq('customer_phone', telefone);

    if (!symplaData?.length && !getinData?.length) {
      throw new Error('Cliente não encontrado');
    }

    const nomeCliente = symplaData?.[0]?.nome_completo || getinData?.[0]?.customer_name || 'Cliente';
    const totalVisitas = (symplaData?.length || 0) + (getinData?.length || 0);

    // Sistema de Recomendações
    const recomendacoes: Recomendacao[] = [];

    // 1. RECOMENDAÇÃO DE DIA DA SEMANA
    if (padroes?.data) {
      const diaPreferido = padroes.data.dia_semana_preferido;
      const distribuicaoDias = padroes.data.distribuicao_dias;
      const visitasDiaPreferido = distribuicaoDias[diaPreferido];
      const confianca = Math.min((visitasDiaPreferido / totalVisitas) * 100, 95);

      recomendacoes.push({
        tipo: 'dia',
        titulo: `Melhor dia: ${diaPreferido.charAt(0).toUpperCase() + diaPreferido.slice(1)}`,
        descricao: `Cliente visita preferencialmente às ${diaPreferido}s (${visitasDiaPreferido} de ${totalVisitas} visitas)`,
        confianca,
        razao: `Padrão consistente de ${Math.round(confianca)}% das visitas`,
        acao_sugerida: `Enviar campanhas e convites às ${diaPreferido}s para maximizar conversão`
      });
    }

    // 2. RECOMENDAÇÃO DE HORÁRIO
    if (padroes?.data) {
      const horarioPreferido = padroes.data.horario_preferido;

      recomendacoes.push({
        tipo: 'horario',
        titulo: `Melhor horário: ${horarioPreferido}`,
        descricao: `Cliente prefere eventos/visitas no período da ${horarioPreferido.split(' ')[0].toLowerCase()}`,
        confianca: 75,
        razao: 'Baseado em histórico de horários de visita',
        acao_sugerida: `Recomendar eventos de ${horarioPreferido.toLowerCase()} e enviar lembretes neste período`
      });
    }

    // 3. RECOMENDAÇÃO DE TIPO DE EVENTO
    if (padroes?.data) {
      const eventoPreferido = padroes.data.tipo_evento_preferido;
      const distribuicaoEventos = padroes.data.distribuicao_eventos;
      const visitasEvento = distribuicaoEventos[eventoPreferido];
      const confianca = Math.min((visitasEvento / totalVisitas) * 100, 90);

      recomendacoes.push({
        tipo: 'evento',
        titulo: `Evento favorito: ${eventoPreferido}`,
        descricao: `Cliente tem preferência por ${eventoPreferido} (${visitasEvento} visitas)`,
        confianca,
        razao: `Participou de ${visitasEvento} eventos deste tipo`,
        acao_sugerida: `Notificar sobre próximos eventos similares a ${eventoPreferido}`
      });
    }

    // 4. RECOMENDAÇÃO DE GRUPO
    if (padroes?.data) {
      if (padroes.data.vem_sozinho) {
        recomendacoes.push({
          tipo: 'grupo',
          titulo: 'Cliente solo',
          descricao: 'Cliente costuma vir sozinho',
          confianca: 80,
          razao: 'Histórico de visitas individuais',
          acao_sugerida: 'Oferecer eventos intimistas, mesas individuais e promoções para primeira consumação'
        });
      } else {
        const tamanhoGrupo = padroes.data.tamanho_grupo_medio;
        recomendacoes.push({
          tipo: 'grupo',
          titulo: `Cliente traz grupos de ~${tamanhoGrupo} pessoas`,
          descricao: `Tamanho médio de grupo: ${tamanhoGrupo} pessoas`,
          confianca: 85,
          razao: `Média de ${tamanhoGrupo} pessoas por visita`,
          acao_sugerida: `Oferecer promoções de grupo, mesas maiores e combos para ${tamanhoGrupo}+ pessoas`
        });
      }
    }

    // 5. RECOMENDAÇÃO DE CUPOM PERSONALIZADO
    if (ltv?.data) {
      const potencial = ltv.data.potencial_crescimento;
      const scoreEngajamento = ltv.data.score_engajamento;

      if (scoreEngajamento < 40) {
        // Cliente de baixo engajamento - cupom agressivo
        recomendacoes.push({
          tipo: 'cupom',
          titulo: 'Cupom de Reativação: 25-30% OFF',
          descricao: 'Cliente com baixo engajamento - desconto agressivo recomendado',
          confianca: 90,
          razao: `Score de engajamento baixo (${scoreEngajamento})`,
          acao_sugerida: 'Enviar cupom de 25-30% de desconto para reengajamento imediato'
        });
      } else if (potencial === 'alto') {
        // Cliente de alto potencial - incentivo moderado
        recomendacoes.push({
          tipo: 'cupom',
          titulo: 'Cupom VIP: 15-20% OFF',
          descricao: 'Cliente de alto potencial merece benefícios exclusivos',
          confianca: 85,
          razao: `Alto potencial de crescimento e score ${scoreEngajamento}`,
          acao_sugerida: 'Oferecer cupom VIP de 15-20% em eventos especiais'
        });
      } else if (scoreEngajamento >= 70) {
        // Cliente fiel - recompensa de fidelidade
        recomendacoes.push({
          tipo: 'cupom',
          titulo: 'Programa de Fidelidade',
          descricao: 'Cliente muito engajado - criar programa de benefícios contínuos',
          confianca: 95,
          razao: `Altíssimo engajamento (${scoreEngajamento})`,
          acao_sugerida: 'Incluir em programa VIP com benefícios permanentes (10% sempre, entrada grátis, etc)'
        });
      }
    }

    // 6. RECOMENDAÇÃO ANTI-CHURN
    if (churn?.data) {
      const nivelRisco = churn.data.nivel_risco;
      const scoreChurn = churn.data.score_churn;

      if (nivelRisco === 'critico' || nivelRisco === 'alto') {
        recomendacoes.push({
          tipo: 'cupom',
          titulo: `🚨 URGENTE: Cliente em Risco de Churn (${scoreChurn}%)`,
          descricao: `Risco ${nivelRisco} de perder este cliente`,
          confianca: 95,
          razao: `Score de churn: ${scoreChurn}% - ${churn.data.dias_sem_visitar} dias sem visitar`,
          acao_sugerida: 'Contato IMEDIATO via WhatsApp + cupom 30% OFF + convite VIP para próximo evento'
        });
      }
    }

    // 7. UPSELL BASEADO EM LTV
    if (ltv?.data) {
      const ltvAtual = ltv.data.ltv_atual;
      const ticketMedio = ltv.data.ticket_medio;
      const tendenciaValor = ltv.data.tendencia_valor;

      if (tendenciaValor === 'crescente') {
        recomendacoes.push({
          tipo: 'produto',
          titulo: 'Oportunidade de Upsell: Produtos Premium',
          descricao: `Cliente com tendência crescente de gastos (ticket médio: R$ ${ticketMedio})`,
          confianca: 80,
          razao: `LTV atual R$ ${ltvAtual} com tendência crescente`,
          acao_sugerida: 'Oferecer produtos premium, combos especiais e experiências VIP'
        });
      }
    }

    // Ordenar por confiança (maior primeiro)
    recomendacoes.sort((a, b) => b.confianca - a.confianca);

    const resultado: ClienteRecomendacoes = {
      telefone,
      nome: nomeCliente,
      total_visitas: totalVisitas,
      segmento: segmento?.data?.segmento || 'Regular',
      recomendacoes: recomendacoes.slice(0, limite)
    };

    return NextResponse.json({
      success: true,
      data: resultado
    });

  } catch (error: any) {
    console.error('Erro ao gerar recomendações:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

