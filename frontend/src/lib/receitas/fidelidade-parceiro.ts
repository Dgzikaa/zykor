/**
 * Integração de leitura com a API do parceiro do Programa de Fidelidade (Go!Bar).
 *
 * O parceiro expõe views via PostgREST (Supabase). Consumimos apenas leitura, do lado
 * do servidor (nossa API route), nunca do cliente — a chave fica fora do bundle.
 *
 * Views do parceiro:
 *   - vw_ordi_clientes  : consolidado por cliente (cadastro, visitas, pontos, carteira, status)
 *   - vw_ordi_pontos    : histórico de movimentações de pontos      (GRANT pendente no parceiro)
 *   - vw_ordi_resgates  : histórico de resgates                     (GRANT pendente no parceiro)
 *
 * Só o Ordinário (bar_id=3) tem programa hoje; o de-para bar_id -> estabelecimento_id
 * do parceiro fica em BAR_ESTABELECIMENTO. Outros bares não têm dados.
 */

const BASE = (process.env.FIDELIDADE_PARCEIRO_URL || 'https://ekxgimtccchcjtgafmoy.supabase.co/rest/v1').replace(/\/$/, '');
const KEY = process.env.FIDELIDADE_PARCEIRO_KEY || 'sb_publishable_ytPmSi5H9ombHDbT5p6LpQ_uu1WJdYy';

/** bar_id do Zykor -> estabelecimento_id no sistema do parceiro. */
export const BAR_ESTABELECIMENTO: Record<number, string> = {
  3: '1769694302028x316785949103095800', // Ordinário Bar
};

export function estabelecimentoDoBar(barId: number): string | null {
  return BAR_ESTABELECIMENTO[barId] ?? null;
}

/** Cliente consolidado como vem da view vw_ordi_clientes. */
export interface ClienteFidelidade {
  estabelecimento_id: string;
  cliente_id: string;
  nome: string | null;
  telefone_norm: string | null;
  data_cadastro: string | null;
  primeira_visita: string | null;
  ultima_visita: string | null;
  quantidade_visitas: number;
  total_consumido: number;
  ticket_medio: number;
  status_cliente: string | null;
  tem_cadastro: boolean;
  tem_pontos: boolean;
  saldo_pontos: number;
  tem_resgate: boolean;
  tem_itens_carteira: boolean;
  itens_na_carteira: number;
  total_resgates: number;
  pontos_gerados: number;
  pontos_utilizados: number;
}

const PAGE = 1000; // PostgREST corta em 1000 por padrão — paginamos por Range.

/**
 * Busca todos os clientes do estabelecimento na view do parceiro, paginando via Range.
 * Lança em erro de rede/permissão para a route decidir o status/mensagem.
 */
export async function fetchClientesFidelidade(estabelecimentoId: string): Promise<ClienteFidelidade[]> {
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const out: ClienteFidelidade[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const url =
      `${BASE}/vw_ordi_clientes?select=*` +
      `&estabelecimento_id=eq.${encodeURIComponent(estabelecimentoId)}` +
      `&order=total_consumido.desc`;
    const res = await fetch(url, {
      headers: { ...headers, Range: `${offset}-${offset + PAGE - 1}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Parceiro respondeu ${res.status}: ${body.slice(0, 300)}`);
    }
    const lote = (await res.json()) as ClienteFidelidade[];
    out.push(...lote);
    if (lote.length < PAGE) break; // última página
  }

  return out;
}
