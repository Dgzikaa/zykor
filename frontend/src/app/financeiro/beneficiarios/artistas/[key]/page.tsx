'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ArrowLeft, Loader2, Music, TrendingUp, CalendarClock, Users2 } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtBRL2 = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0);
const fmtData = (d: string) => { try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y.slice(2)}`; } catch { return d; } };

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card><CardContent className="py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent></Card>
  );
}

export default function ArtistaPerfilPage() {
  const params = useParams();
  const router = useRouter();
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { setPageTitle } = usePageTitle();
  const key = decodeURIComponent((params?.key as string) || '');

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<any>(null);
  const [shows, setShows] = useState<any[]>([]);
  const [participacoes, setParticipacoes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [semAtracao, setSemAtracao] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!selectedBar || !key) return;
    setLoading(true);
    try {
      const [det, prod, comSem] = await Promise.all([
        api.get(`/api/financeiro/beneficiarios/artistas/detalhe?key=${encodeURIComponent(key)}`),
        api.get(`/api/financeiro/beneficiarios/artistas/produtos?key=${encodeURIComponent(key)}`),
        api.get('/api/financeiro/beneficiarios/artistas/dia-com-sem'),
      ]);
      setHeader(det.header); setShows(det.shows || []); setParticipacoes(det.participacoes || []);
      setProdutos(prod.produtos || []); setGrupos(prod.grupos || []);
      const geralSem = (comSem.linhas || []).find((l: any) => l.segmento === 'sem' && l.dia_semana === null);
      setSemAtracao(geralSem ? geralSem.fat_medio : null);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar artista', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, key, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    setPageTitle(header?.nome ? `🎵 ${header.nome}` : '🎵 Beneficiário');
    return () => setPageTitle('');
  }, [setPageTitle, header?.nome]);

  const chartData = useMemo(() => shows.filter((s) => !s.futuro).map((s) => ({
    data: fmtData(s.data), fat: s.fat, custo: s.custo_total, publico: s.publico,
  })), [shows]);

  const deltaSemAtracao = useMemo(() => {
    if (!header || !semAtracao) return null;
    return Math.round(((header.fat_medio - semAtracao) / semAtracao) * 1000) / 10;
  }, [header, semAtracao]);

  const previstos = shows.filter((s) => s.futuro);

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5 max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/financeiro/beneficiarios')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />Atrações
        </Button>

        {loading ? (
          <div className="py-24 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !header ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Artista não encontrado.</CardContent></Card>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Music className="w-5 h-5" />
              {header.genero && <span className="text-xs rounded bg-muted px-2 py-0.5 text-muted-foreground">{header.genero}</span>}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {header.shows_feitos} show{header.shows_feitos !== 1 ? 's' : ''} realizado{header.shows_feitos !== 1 ? 's' : ''}
              {header.primeira && header.ultima ? ` · ${fmtData(header.primeira)} a ${fmtData(header.ultima)}` : ''}
              {header.shows_previstos > 0 ? ` · ${header.shows_previstos} previsto${header.shows_previstos > 1 ? 's' : ''}` : ''}
            </p>

            {/* KPIs principais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <Kpi label="Custo total" value={fmtBRL(header.custo_total)} sub={header.shows_previstos > 0 ? `realizado: ${fmtBRL(header.custo_total_feito)}` : undefined} />
              <Kpi label="Custo médio / show" value={fmtBRL(header.custo_medio)} sub={`${header.custo_pct_fat}% do faturamento`} />
              <Kpi label="Faturamento médio" value={fmtBRL(header.fat_medio)} sub={`total ${fmtBRL(header.fat_total)}`} />
              <Kpi label="Público médio" value={fmtNum(header.publico_medio)} sub={`ticket ${fmtBRL2(header.ticket_medio)}`} />
            </div>

            {/* Impacto vs casa sem atração */}
            {deltaSemAtracao !== null && (
              <Card className="mb-4">
                <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                  <TrendingUp className={`w-5 h-5 ${deltaSemAtracao >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                  <div className="text-sm">
                    Em média, um dia com <b>{header.nome}</b> fatura{' '}
                    <b className={deltaSemAtracao >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {deltaSemAtracao >= 0 ? '+' : ''}{deltaSemAtracao}%
                    </b>{' '}
                    vs a média da casa em dias sem atração ({fmtBRL(semAtracao!)}).
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Próximos shows */}
            {previstos.length > 0 && (
              <Card className="mb-4">
                <CardContent className="py-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium mb-2"><CalendarClock className="w-4 h-4" />Próximos shows</div>
                  <div className="flex flex-wrap gap-2">
                    {previstos.map((s) => (
                      <span key={s.evento_id} className="text-xs rounded bg-muted px-2 py-1">
                        {fmtData(s.data)} <span className="text-muted-foreground">({s.dia_semana})</span>
                        {s.custo_total > 0 && <> · {fmtBRL(s.custo_total)}</>}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Participações em line-ups (combos) — custo compartilhado, fora do headline */}
            {participacoes.length > 0 && (
              <Card className="mb-4">
                <CardContent className="py-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium mb-1"><Users2 className="w-4 h-4" />Também tocou em {participacoes.length} line-up{participacoes.length > 1 ? 's' : ''}</div>
                  <p className="text-[11px] text-muted-foreground mb-2">Noites com mais de uma atração. Não entram no custo acima (é dividido com o line-up), mas contam pra presença dele na casa.</p>
                  <div className="space-y-1">
                    {participacoes.map((p) => (
                      <div key={p.evento_id} className="flex items-center justify-between text-xs gap-2 flex-wrap">
                        <span className="truncate flex-1 min-w-[160px]">
                          <span className="text-muted-foreground">{fmtData(p.data)}</span> · {p.line_up}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                          {fmtNum(p.publico)} pessoas · <b className="text-foreground">{fmtBRL(p.fat)}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráfico fat x custo por show */}
            {chartData.length > 1 && (
              <Card className="mb-4">
                <CardContent className="py-4">
                  <div className="text-sm font-medium mb-3">Faturamento × custo por show</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="data" fontSize={11} tickMargin={6} interval="preserveStartEnd" />
                      <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} />
                      <Tooltip formatter={(v: any, n: any) => [fmtBRL(Number(v)), n === 'fat' ? 'Faturamento' : 'Custo']} labelClassName="text-xs" />
                      <Legend formatter={(v) => (v === 'fat' ? 'Faturamento' : 'Custo atração')} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="fat" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={36} />
                      <Line dataKey="custo" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Top produtos + mix por grupo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <Card>
                <CardContent className="py-3">
                  <div className="text-sm font-medium mb-2">Produtos mais vendidos nos dias dele</div>
                  {produtos.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-3">Sem dados de produto pra esses dias.</div>
                  ) : (
                    <div className="space-y-1">
                      {produtos.map((p) => (
                        <div key={p.produto} className="flex items-center justify-between text-xs gap-2">
                          <span className="truncate flex-1">{p.produto}</span>
                          <span className="text-muted-foreground whitespace-nowrap tabular-nums">{fmtNum(p.qtd)}× · <b className="text-foreground">{fmtBRL(p.valor)}</b></span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <div className="text-sm font-medium mb-2">Mix por grupo</div>
                  {grupos.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-3">Sem dados.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {grupos.slice(0, 8).map((g) => (
                        <div key={g.grupo}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="truncate">{g.grupo}</span>
                            <span className="text-muted-foreground tabular-nums">{g.share}% · {fmtBRL(g.valor)}</span>
                          </div>
                          <div className="h-1.5 rounded bg-muted overflow-hidden">
                            <div className="h-full bg-blue-500/70" style={{ width: `${Math.min(100, g.share)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tabela de shows */}
            <Card className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b"><tr>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Data</th>
                  <th className="text-left px-3 py-2">Evento</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Custo</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Faturamento</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Público</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Ticket</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">% Fat.</th>
                </tr></thead>
                <tbody>
                  {shows.slice().reverse().map((s) => (
                    <tr key={s.evento_id} className={`border-b last:border-0 ${s.futuro ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(s.data)} <span className="text-muted-foreground text-[11px]">{s.dia_semana}</span></td>
                      <td className="px-3 py-1.5 truncate max-w-[200px] text-muted-foreground">{s.nome_evento || '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(s.custo_total)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium">{s.futuro ? '—' : fmtBRL(s.fat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{s.futuro ? '—' : fmtNum(s.publico)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{s.futuro ? '—' : fmtBRL2(s.ticket)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{s.pct_art_fat ? `${s.pct_art_fat}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
