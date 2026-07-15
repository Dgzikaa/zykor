import { NextRequest, NextResponse } from 'next/server';
import {
  estabelecimentoDoBar,
  fetchClientesFidelidade,
  type ClienteFidelidade,
} from '@/lib/receitas/fidelidade-parceiro';

/**
 * Programa de Fidelidade (Receitas) — consome a API do parceiro (Go!Bar) e agrega no
 * servidor. Hoje só o Ordinário (bar_id=3) tem programa; outros bares retornam vazio.
 *
 * GET ?bar_id=3
 */
export const dynamic = 'force-dynamic';

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

const n = (v: unknown) => Number(v) || 0;

export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) {
    return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  }

  const estabelecimentoId = estabelecimentoDoBar(barId);
  if (!estabelecimentoId) {
    // Bar sem programa de fidelidade configurado (só Ordinário hoje).
    return NextResponse.json({
      success: true,
      disponivel: false,
      resumo: null,
      porStatus: [],
      clientes: [],
    });
  }

  let clientes: ClienteFidelidade[];
  try {
    clientes = await fetchClientesFidelidade(estabelecimentoId);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Falha ao consultar o parceiro' },
      { status: 502 },
    );
  }

  // Agregações do período completo (a view já é consolidada por cliente).
  let comCadastro = 0,
    comPontos = 0,
    comResgate = 0,
    comCarteira = 0,
    saldoPontosTotal = 0,
    pontosGerados = 0,
    pontosUtilizados = 0,
    totalResgates = 0,
    totalConsumido = 0,
    itensCarteira = 0,
    somaTicket = 0,
    clientesComTicket = 0;

  const statusAcc = new Map<string, { clientes: number; saldoPontos: number }>();

  for (const c of clientes) {
    if (c.tem_cadastro) comCadastro++;
    if (c.tem_pontos) comPontos++;
    if (c.tem_resgate) comResgate++;
    if (c.tem_itens_carteira) comCarteira++;
    saldoPontosTotal += n(c.saldo_pontos);
    pontosGerados += n(c.pontos_gerados);
    pontosUtilizados += n(c.pontos_utilizados);
    totalResgates += n(c.total_resgates);
    totalConsumido += n(c.total_consumido);
    itensCarteira += n(c.itens_na_carteira);
    if (n(c.ticket_medio) > 0) {
      somaTicket += n(c.ticket_medio);
      clientesComTicket++;
    }

    const status = c.status_cliente || 'Sem status';
    const s = statusAcc.get(status) || { clientes: 0, saldoPontos: 0 };
    s.clientes++;
    s.saldoPontos += n(c.saldo_pontos);
    statusAcc.set(status, s);
  }

  const resumo = {
    totalClientes: clientes.length,
    comCadastro,
    comPontos,
    comResgate,
    comCarteira,
    saldoPontosTotal,
    pontosGerados,
    pontosUtilizados,
    totalResgates,
    totalConsumido,
    itensCarteira,
    ticketMedio: clientesComTicket ? somaTicket / clientesComTicket : 0,
    taxaResgate: comPontos ? (comResgate / comPontos) * 100 : 0, // % dos pontuadores que já resgataram
  };

  const porStatus = [...statusAcc.entries()]
    .map(([status, v]) => ({ status, clientes: v.clientes, saldoPontos: Math.round(v.saldoPontos) }))
    .sort((a, b) => b.clientes - a.clientes);

  return NextResponse.json({ success: true, disponivel: true, resumo, porStatus, clientes });
}
