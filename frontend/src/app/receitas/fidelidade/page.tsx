'use client';

/**
 * Programa de Fidelidade (Receitas) — espelha, dentro do Zykor, os dados que o parceiro
 * (Go!Bar) devolve pela API dele a partir do que enviamos. Fonte: /api/receitas/fidelidade
 * (agrega no servidor a view vw_ordi_clientes do parceiro). Só o Ordinário (bar_id=3) tem
 * programa hoje; outros bares mostram o aviso de indisponível.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Gift, Search, Calendar } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { PageShell } from '@/components/layout/PageShell';
import { ChartCard, GraficoDonut, GraficoBarraH, GraficoLinha } from '@/components/graficos/Charts';

// Presets de período — só afetam os dados que têm data (resgates/pontos).
// KPIs de "base de clientes" (vw_ordi_clientes) são sempre lifetime.
type Periodo = 'tudo' | 'dia' | 'semana' | 'mes' | 'ano' | 'custom';

const iso = (d: Date) => d.toISOString().slice(0, 10);
function rangeDoPeriodo(p: Periodo): { de?: string; ate?: string } {
  if (p === 'tudo' || p === 'custom') return {};
  const hoje = new Date();
  const ate = iso(hoje);
  const de = new Date(hoje);
  if (p === 'dia') de.setDate(de.getDate()); // = hoje
  else if (p === 'semana') de.setDate(de.getDate() - 6); // últimos 7 dias
  else if (p === 'mes') de.setDate(1); // desde o dia 1 do mês
  else if (p === 'ano') { de.setMonth(0); de.setDate(1); } // desde 1 jan
  return { de: iso(de), ate };
}

const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const moeda = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

interface Cliente {
  cliente_id: string;
  nome: string | null;
  telefone_norm: string | null;
  quantidade_visitas: number;
  total_consumido: number;
  saldo_pontos: number;
  pontos_gerados: number;
  pontos_utilizados: number;
  total_resgates: number;
  status_cliente: string | null;
  ultima_visita: string | null;
}

interface Resumo {
  totalClientes: number;
  comCadastro: number;
  comPontos: number;
  comResgate: number;
  comCarteira: number;
  saldoPontosTotal: number;
  pontosGerados: number;
  pontosUtilizados: number;
  totalResgates: number;
  totalConsumido: number;
  itensCarteira: number;
  ticketMedio: number;
  taxaResgate: number;
  valorBeneficios: number;
  qtdResgates: number;
}

interface Resposta {
  success: boolean;
  disponivel: boolean;
  escopo?: 'lifetime' | 'periodo';
  range?: { de?: string; ate?: string };
  resumo: Resumo | null;
  porStatus: { status: string; clientes: number; saldoPontos: number }[];
  topProdutosResgatados: { produto: string; resgates: number; valor: number }[];
  evolucaoMensal: { mes: string; gerados: number; utilizados: number }[];
  extrasErro: string | null;
  clientes: Cliente[];
}

// Paleta por status na ordem típica do funil de fidelidade.
const CORES_STATUS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#94a3b8'];

function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[hsl(var(--foreground))]">{valor}</div>
      {sub && <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{sub}</div>}
    </div>
  );
}

export default function FidelidadePage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [resp, setResp] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const [rangeCustom, setRangeCustom] = useState<{ de: string; ate: string }>({ de: '', ate: '' });

  useEffect(() => {
    setPageTitle('🎁 Programa de Fidelidade');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  const rangeAtual = useMemo(() => {
    if (periodo === 'custom') {
      return { de: rangeCustom.de || undefined, ate: rangeCustom.ate || undefined };
    }
    return rangeDoPeriodo(periodo);
  }, [periodo, rangeCustom]);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    setErro(null);
    const qs = new URLSearchParams({ bar_id: String(barId) });
    if (rangeAtual.de) qs.set('de', rangeAtual.de);
    if (rangeAtual.ate) qs.set('ate', rangeAtual.ate);
    api
      .get(`/api/receitas/fidelidade?${qs.toString()}`)
      .then((r: any) => {
        if (r?.success) setResp(r as Resposta);
        else setErro(r?.error || 'Falha ao carregar');
      })
      .catch((e: any) => setErro(e?.message || 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, [barId, rangeAtual]);

  const resumo = resp?.resumo;

  const topPontos = useMemo(
    () =>
      [...(resp?.clientes ?? [])]
        .filter((c) => c.saldo_pontos > 0)
        .sort((a, b) => b.saldo_pontos - a.saldo_pontos)
        .slice(0, 14)
        .map((c) => ({ nome: c.nome || 'Sem nome', saldo: Math.round(c.saldo_pontos) })),
    [resp],
  );

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = resp?.clientes ?? [];
    const arr = q
      ? base.filter(
          (c) =>
            (c.nome || '').toLowerCase().includes(q) || (c.telefone_norm || '').includes(q),
        )
      : base;
    return arr.slice(0, 200);
  }, [resp, busca]);

  return (
    <PageShell width="wide">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Gift className="h-4 w-4" />
          Programa de fidelidade de {selectedBar?.nome ?? 'o bar selecionado'} — dados do parceiro.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Calendar className="h-3.5 w-3.5" />
            Período:
          </div>
          {[
            { v: 'dia' as const, l: 'Hoje' },
            { v: 'semana' as const, l: '7 dias' },
            { v: 'mes' as const, l: 'Mês' },
            { v: 'ano' as const, l: 'Ano' },
            { v: 'tudo' as const, l: 'Tudo' },
            { v: 'custom' as const, l: 'Custom' },
          ].map((p) => (
            <button
              key={p.v}
              onClick={() => setPeriodo(p.v)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                periodo === p.v
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {p.l}
            </button>
          ))}
          {periodo === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={rangeCustom.de}
                onChange={(e) => setRangeCustom((r) => ({ ...r, de: e.target.value }))}
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs"
              />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">até</span>
              <input
                type="date"
                value={rangeCustom.ate}
                onChange={(e) => setRangeCustom((r) => ({ ...r, ate: e.target.value }))}
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs"
              />
            </div>
          )}
        </div>
      </div>
      {resp?.escopo === 'periodo' && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
          <div className="font-semibold">Filtrando por período {rangeAtual.de} → {rangeAtual.ate}</div>
          <div className="mt-0.5 text-[11px] opacity-90">
            <strong>Muda com o filtro:</strong> pontos gerados/utilizados, resgates, clientes com pontos/resgates, taxa de resgate, gráficos e produtos resgatados.
            <br />
            <strong>Não muda (lifetime):</strong> total de clientes na base, saldo de pontos, consumo total, ticket médio — o parceiro só entrega essa view consolidada.
          </div>
        </div>
      )}

      {!barId ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Selecione um bar.
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : erro ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--destructive))]">
          {erro}
        </div>
      ) : !resp?.disponivel ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Gift className="h-8 w-8 opacity-50" />
          <span>Este bar ainda não tem programa de fidelidade integrado.</span>
        </div>
      ) : (
        <>
          {/* KPIs — sufixo "(período)" ou "(total)" deixa claro o que muda com o filtro. */}
          {(() => {
            const noPeriodo = resp?.escopo === 'periodo';
            const sufMov = noPeriodo ? ' (período)' : ' (total)';
            const sufBase = ' (atual)';
            return (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                <Kpi
                  label={`Clientes na base${sufBase}`}
                  valor={num(resumo!.totalClientes)}
                  sub={`${num(resumo!.comCadastro)} com cadastro`}
                />
                <Kpi
                  label={`Com pontos${sufMov}`}
                  valor={num(resumo!.comPontos)}
                  sub={`${pct((resumo!.comPontos / Math.max(1, resumo!.totalClientes)) * 100)} da base`}
                />
                <Kpi
                  label={`Saldo de pontos${sufBase}`}
                  valor={num(resumo!.saldoPontosTotal)}
                  sub={`${num(resumo!.pontosGerados)} gerados${sufMov.trim()} · ${num(resumo!.pontosUtilizados)} usados`}
                />
                <Kpi
                  label={`Resgates${sufMov}`}
                  valor={num(resumo!.totalResgates)}
                  sub={`${num(resumo!.comResgate)} clientes · taxa ${pct(resumo!.taxaResgate)}`}
                />
                <Kpi label={`Consumo total${sufBase}`} valor={moeda(resumo!.totalConsumido)} />
                <Kpi label={`Ticket médio${sufBase}`} valor={moeda(resumo!.ticketMedio)} />
                <Kpi
                  label={`Valor em benefícios${sufMov}`}
                  valor={moeda(resumo!.valorBeneficios)}
                  sub={`${num(resumo!.qtdResgates)} resgates`}
                />
                <Kpi
                  label={`Pontos utilizados${sufMov}`}
                  valor={pct((resumo!.pontosUtilizados / Math.max(1, resumo!.pontosGerados)) * 100)}
                  sub="do gerado no período"
                />
              </div>
            );
          })()}

          {/* Gráficos */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard titulo="Clientes por status" subtitulo="composição da base de fidelidade">
              <GraficoDonut
                data={resp.porStatus}
                nameKey="status"
                valueKey="clientes"
                cores={CORES_STATUS}
                formatV={num}
                centro={num(resumo!.totalClientes)}
                height={300}
              />
            </ChartCard>

            <ChartCard titulo="Top clientes por saldo de pontos" subtitulo="maiores saldos acumulados">
              <GraficoBarraH data={topPontos} xKey="nome" valueKey="saldo" formatV={num} height={300} />
            </ChartCard>

            {resp.evolucaoMensal.length > 0 && (
              <ChartCard titulo="Pontos por mês" subtitulo="gerados × utilizados ao longo do tempo">
                <GraficoLinha
                  data={resp.evolucaoMensal}
                  xKey="mes"
                  series={[
                    { key: 'gerados', nome: 'Gerados', cor: '#22c55e' },
                    { key: 'utilizados', nome: 'Utilizados', cor: '#f59e0b' },
                  ]}
                  formatV={num}
                  area
                  height={300}
                />
              </ChartCard>
            )}

            {resp.topProdutosResgatados.length > 0 && (
              <ChartCard titulo="Produtos mais resgatados" subtitulo="por quantidade de resgates">
                <GraficoBarraH data={resp.topProdutosResgatados} xKey="produto" valueKey="resgates" formatV={num} height={300} />
              </ChartCard>
            )}
          </div>

          {resp.extrasErro && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Resgates/pontos detalhados indisponíveis no momento ({resp.extrasErro}). Os indicadores por cliente seguem atualizados.
            </div>
          )}

          {/* Tabela */}
          <ChartCard titulo="Clientes" subtitulo={`${num(resp.clientes.length)} no total — busca por nome ou telefone`}>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2">
              <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Telefone</th>
                    <th className="py-2 pr-3 text-right font-medium">Visitas</th>
                    <th className="py-2 pr-3 text-right font-medium">Consumo</th>
                    <th className="py-2 pr-3 text-right font-medium">Saldo pts</th>
                    <th className="py-2 pr-3 text-right font-medium">Resgates</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c) => (
                    <tr key={c.cliente_id} className="border-b border-[hsl(var(--border))]/50">
                      <td className="py-2 pr-3 text-[hsl(var(--foreground))]">{c.nome || '—'}</td>
                      <td className="py-2 pr-3 text-[hsl(var(--muted-foreground))]">{c.telefone_norm || '—'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{num(c.quantidade_visitas)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{moeda(c.total_consumido)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{num(c.saldo_pontos)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{num(c.total_resgates)}</td>
                      <td className="py-2 pr-3 text-[hsl(var(--muted-foreground))]">{c.status_cliente || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clientesFiltrados.length === 0 && (
                <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  Nenhum cliente encontrado.
                </div>
              )}
              {!busca && resp.clientes.length > 200 && (
                <div className="pt-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
                  Mostrando os 200 maiores consumidores — use a busca para achar um cliente específico.
                </div>
              )}
            </div>
          </ChartCard>
        </>
      )}
    </PageShell>
  );
}
