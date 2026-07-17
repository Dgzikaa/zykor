import { NextRequest, NextResponse } from 'next/server';
import {
  estabelecimentoDoBar,
  fetchClientesFidelidade,
  fetchResgatesFidelidade,
  fetchPontosFidelidade,
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

// Valida YYYY-MM-DD só pra evitar mandar lixo pro PostgREST do parceiro.
const dataOk = (s: string | null): string | undefined =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;

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

  // Resgates + evolução de pontos — best-effort: se o parceiro bloquear/derrubar essas views,
  // a página segue mostrando os clientes (não quebra tudo por causa de um extra).
  let topProdutosResgatados: { produto: string; resgates: number; valor: number }[] = [];
  let valorBeneficios = 0;
  let qtdResgates = 0;
  let evolucaoMensal: { mes: string; gerados: number; utilizados: number }[] = [];
  let extrasErro: string | null = null;

  // Filtro de período: aplica só nas views que têm data (resgates e pontos). A
  // vw_ordi_clientes é lifetime, então KPIs do topo (saldo, cadastro, consumo total)
  // não mudam com o período; movimentação sim.
  const sp = new URL(request.url).searchParams;
  const range = { de: dataOk(sp.get('de')), ate: dataOk(sp.get('ate')) };

  const [resgatesR, pontosR] = await Promise.allSettled([
    fetchResgatesFidelidade(estabelecimentoId, range),
    fetchPontosFidelidade(estabelecimentoId, range),
  ]);

  if (resgatesR.status === 'fulfilled') {
    const prodAcc = new Map<string, { resgates: number; valor: number }>();
    for (const r of resgatesR.value) {
      qtdResgates++;
      valorBeneficios += n(r.valor_estimado_beneficio);
      const prod = (r.produto_nome || r.item_nome || 'Sem produto').trim() || 'Sem produto';
      const a = prodAcc.get(prod) || { resgates: 0, valor: 0 };
      a.resgates++;
      a.valor += n(r.valor_estimado_beneficio);
      prodAcc.set(prod, a);
    }
    topProdutosResgatados = [...prodAcc.entries()]
      .map(([produto, v]) => ({ produto, resgates: v.resgates, valor: Math.round(v.valor) }))
      .sort((a, b) => b.resgates - a.resgates)
      .slice(0, 14);
  } else {
    extrasErro = resgatesR.reason instanceof Error ? resgatesR.reason.message : 'falha nos resgates';
  }

  if (pontosR.status === 'fulfilled') {
    const mesAcc = new Map<string, { gerados: number; utilizados: number }>();
    for (const p of pontosR.value) {
      const mes = p.agrupamento_mes ? String(p.agrupamento_mes).slice(0, 7) : null; // YYYY-MM
      if (!mes) continue;
      const a = mesAcc.get(mes) || { gerados: 0, utilizados: 0 };
      a.gerados += n(p.pontos_gerados);
      a.utilizados += n(p.pontos_utilizados);
      mesAcc.set(mes, a);
    }
    evolucaoMensal = [...mesAcc.entries()]
      .map(([mes, v]) => ({ mes, gerados: Math.round(v.gerados), utilizados: Math.round(v.utilizados) }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  } else if (!extrasErro) {
    extrasErro = pontosR.reason instanceof Error ? pontosR.reason.message : 'falha nos pontos';
  }

  return NextResponse.json({
    success: true,
    disponivel: true,
    resumo: { ...resumo, valorBeneficios: Math.round(valorBeneficios), qtdResgates },
    porStatus,
    topProdutosResgatados,
    evolucaoMensal,
    extrasErro,
    clientes,
  });
}
