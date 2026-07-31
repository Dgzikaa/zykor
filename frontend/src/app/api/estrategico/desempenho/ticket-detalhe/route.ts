import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * GET /api/estrategico/desempenho/ticket-detalhe?bar_id=3&data_inicio=&data_fim=
 *
 * Abre o número do Ticket Médio do período: mostra dia a dia o faturamento, as pessoas e os
 * DOIS tickets (Zykor x ContaHub) com o que explica a diferença — cortesias, conta assinada,
 * Yuzer/Sympla.
 *
 * Existe porque a conferência manual dava outro número (31/07/2026: tela 76,37 x conferência
 * 80,47) e ninguém tinha como ver de onde vinha sem montar planilha. A causa é ponderação —
 * a média dos tickets diários não é o ticket da semana quando um dia concentra metade do
 * público —, então a resposta devolve os dois: `ticket_ponderado` (o da tela) e
 * `media_simples` (o da conferência), lado a lado.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const dataInicio = sp.get('data_inicio');
  const dataFim = sp.get('data_fim');

  if (!barId || !dataInicio || !dataFim) {
    return NextResponse.json(
      { success: false, error: 'bar_id, data_inicio e data_fim são obrigatórios' },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as any).rpc('get_ticket_medio_detalhe', {
    p_bar_id: barId,
    p_ini: dataInicio,
    p_fim: dataFim,
  });

  if (error) {
    console.error('[ticket-detalhe] erro na RPC:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const dias = ((data as any[]) || []).map(d => ({
    data: d.data as string,
    evento: d.evento as string,
    faturamento: Number(d.faturamento) || 0,
    pessoas: Number(d.pessoas) || 0,
    ticket: d.ticket == null ? null : Number(d.ticket),
    pagamentos_contahub: Number(d.pagamentos_contahub) || 0,
    pessoas_contahub: Number(d.pessoas_contahub) || 0,
    ticket_contahub: d.ticket_contahub == null ? null : Number(d.ticket_contahub),
    cortesias: Number(d.cortesias) || 0,
    conta_assinada: Number(d.conta_assinada) || 0,
    outras_fontes: Number(d.outras_fontes) || 0,
    ingressos: Number(d.ingressos) || 0,
  }));

  const faturamento = dias.reduce((s, d) => s + d.faturamento, 0);
  const pessoas = dias.reduce((s, d) => s + d.pessoas, 0);
  const comTicket = dias.filter(d => d.ticket != null);

  return NextResponse.json({
    success: true,
    bar_id: barId,
    data_inicio: dataInicio,
    data_fim: dataFim,
    dias,
    totais: {
      faturamento,
      pessoas,
      cortesias: dias.reduce((s, d) => s + d.cortesias, 0),
      conta_assinada: dias.reduce((s, d) => s + d.conta_assinada, 0),
      outras_fontes: dias.reduce((s, d) => s + d.outras_fontes, 0),
      // O número da tela: faturamento do período ÷ pessoas do período.
      ticket_ponderado: pessoas > 0 ? faturamento / pessoas : null,
      // O número que dá quando se soma os tickets diários e divide por N — não é o ticket do
      // período, mas é o que a conferência costuma fazer. Devolvido de propósito para o popup
      // mostrar os dois e acabar com a dúvida em vez de esconder um deles.
      media_simples: comTicket.length > 0
        ? comTicket.reduce((s, d) => s + (d.ticket as number), 0) / comTicket.length
        : null,
      dias_com_movimento: comTicket.length,
    },
  });
}
