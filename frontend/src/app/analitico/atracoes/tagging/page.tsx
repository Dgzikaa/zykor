'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Music, Check, X, Sparkles, Copy, Loader2, AlertCircle, Star, ChevronRight,
} from 'lucide-react';

interface ArtistaTag {
  artista_id: number | null;
  artista_nome: string;
  tipo: string;
  cachet?: number;
  principal?: boolean;
}
interface EventoRow {
  id: number;
  data_evento: string;
  dia_semana: string;
  nome: string;
  faturamento: number;
  publico: number;
  ticket: number | null;
  artista_texto: string;
  artistas: ArtistaTag[];
  sugestao: Array<{ nome: string; tipo: string }>;
  custo_atracao_total: number;
  principal_nome: string | null;
  principal_cachet: number | null;
  pct_principal: number | null;
  retorno: number | null;
  ca_maior: { nome: string; valor: number } | null;
  ca_lancamentos: CaLancamento[];
}
interface CaLancamento {
  contaazul_id: string;
  pessoa: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  overridden: boolean;
  artista_id: number | null;
  artista_nome: string | null;
}
interface Cadastro { id: number; nome: string; tipo: string; }
type SaveStatus = 'saving' | 'saved' | 'error' | undefined;

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
// formata "YYYY-MM-DD" -> "DD/MM/YYYY" sem passar por Date (evita shift de fuso)
const fmtData = (iso: string) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

export default function TaggingArtistasPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;

  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState<string>('');
  const [rows, setRows] = useState<EventoRow[]>([]);
  const [eventosCorrigir, setEventosCorrigir] = useState<Array<{ id: number; data_evento: string; nome: string }>>([]);
  const [cadastro, setCadastro] = useState<Cadastro[]>([]);
  const [status, setStatus] = useState<Record<number, SaveStatus>>({});
  const [soVazios, setSoVazios] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = async (mesAlvo?: string) => {
    if (!barId) return;
    setLoading(true);
    try {
      const url = `/api/eventos/tagging${mesAlvo ? `?mes=${mesAlvo}` : ''}`;
      const res = await fetch(url, { headers: { 'x-selected-bar-id': String(barId) } });
      const j = await res.json();
      if (j.success) {
        setMeses(j.meses || []);
        setMes(j.mes || '');
        setRows(j.eventos || []);
        setEventosCorrigir(j.eventosCorrigir || []);
        setCadastro(j.cadastro || []);
        // guarda o mês na URL pra sobreviver ao refresh (fica na tela onde você estava)
        if (j.mes && typeof window !== 'undefined') {
          const u = new URL(window.location.href);
          u.searchParams.set('mes', j.mes);
          window.history.replaceState(null, '', u.toString());
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const mesUrl = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('mes') || undefined
      : undefined;
    carregar(mesUrl);
    /* eslint-disable-next-line */
  }, [barId]);

  const tipoDoNome = (nome: string): { tipo: string; artista_id: number | null } => {
    const hit = cadastro.find((c) => c.nome.toLowerCase() === nome.trim().toLowerCase());
    if (hit) return { tipo: hit.tipo, artista_id: hit.id };
    return { tipo: /\bdj\b/i.test(nome) ? 'dj' : 'banda', artista_id: null };
  };

  const salvar = async (evento_id: number, artistas: ArtistaTag[]) => {
    if (!barId) return;
    const row = rows.find((r) => r.id === evento_id);
    if (!row) return;
    setStatus((s) => ({ ...s, [evento_id]: 'saving' }));
    try {
      const res = await fetch('/api/eventos/artistas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({
          data_evento: row.data_evento,
          artistas: artistas.map((a) => ({ artista_id: a.artista_id, artista_nome: a.artista_nome, tipo: a.tipo })),
        }),
      });
      const j = await res.json();
      setStatus((s) => ({ ...s, [evento_id]: j.success ? 'saved' : 'error' }));
    } catch {
      setStatus((s) => ({ ...s, [evento_id]: 'error' }));
    }
  };

  const atualizarRow = (evento_id: number, artistas: ArtistaTag[]) => {
    setRows((rs) => rs.map((r) => (r.id === evento_id ? { ...r, artistas, sugestao: [] } : r)));
    salvar(evento_id, artistas);
  };

  const aceitarSugestao = (row: EventoRow) => {
    const artistas: ArtistaTag[] = row.sugestao.map((s) => {
      const { artista_id } = tipoDoNome(s.nome);
      return { artista_id, artista_nome: s.nome, tipo: s.tipo };
    });
    atualizarRow(row.id, artistas);
  };

  const adicionar = (row: EventoRow, nome: string) => {
    const limpo = nome.trim();
    if (!limpo) return;
    if (row.artistas.some((a) => a.artista_nome.toLowerCase() === limpo.toLowerCase())) return;
    const { tipo, artista_id } = tipoDoNome(limpo);
    atualizarRow(row.id, [...row.artistas, { artista_id, artista_nome: limpo, tipo }]);
  };

  const remover = (row: EventoRow, idx: number) => {
    atualizarRow(row.id, row.artistas.filter((_, i) => i !== idx));
  };

  // mapeia um favorecido do CA a um artista (persistente) e recarrega p/ recomputar
  const atribuirCA = async (pessoa: string, artistaId: number) => {
    if (!barId) return;
    await fetch('/api/eventos/artista-ca-pessoa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
      body: JSON.stringify({ ca_pessoa_nome: pessoa, artista_id: artistaId }),
    });
    carregar(mes);
  };

  // "corrigir dia": aponta o pagamento do CA pro show certo (quando a competência ≠ dia do show)
  const corrigirDia = async (l: CaLancamento, evento_id: number, data_evento: string, artistaNome: string, artistaId: number | null) => {
    if (!barId) return;
    await fetch('/api/eventos/ca-atracao-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
      body: JSON.stringify({
        contaazul_id: l.contaazul_id,
        evento_id,
        data_evento,
        artista_id: artistaId,
        artista_nome: artistaNome,
        valor: l.valor,
        pessoa_nome: l.pessoa,
        descricao: l.descricao,
        data_competencia: l.data_competencia,
      }),
    });
    carregar(mes);
  };

  // desfaz a correção de um lançamento (volta pro casamento automático)
  const desfazerCorrigir = async (l: CaLancamento) => {
    if (!barId) return;
    await fetch(`/api/eventos/ca-atracao-override?contaazul_id=${encodeURIComponent(l.contaazul_id)}`, {
      method: 'DELETE',
      headers: { 'x-selected-bar-id': String(barId) },
    });
    carregar(mes);
  };

  const propagar = (row: EventoRow) => {
    const alvo = row.nome.trim().toLowerCase();
    if (!alvo) return;
    const iguais = rows.filter((r) => r.id !== row.id && r.nome.trim().toLowerCase() === alvo);
    if (!iguais.length) return;
    if (!confirm(`Aplicar estes artistas a ${iguais.length} evento(s) com o mesmo nome neste mês?`)) return;
    for (const r of iguais) {
      const copia = row.artistas.map((a) => ({ ...a }));
      atualizarRow(r.id, copia);
    }
  };

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (soVazios && r.artistas.length > 0) return false;
      if (q && !(`${r.nome} ${r.artista_texto}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, soVazios, busca]);

  const taggeados = rows.filter((r) => r.artistas.length > 0).length;

  if (!barId) {
    return <div className="p-6 text-gray-500">Selecione um bar.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <Link href="/analitico/atracoes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2">
              <ArrowLeft className="w-4 h-4" /> Voltar para análise
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Music className="w-6 h-6" /> Taggear Artistas nos Eventos
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedBar?.nome} · {rows.length} eventos no mês · <span className="text-emerald-600 font-medium">{taggeados} taggeados</span> · {rows.length - taggeados} pendentes
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mes} onValueChange={(v) => carregar(v)}>
              <SelectTrigger className="w-40 bg-white dark:bg-gray-800"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                {meses.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={soVazios ? 'default' : 'outline'} onClick={() => setSoVazios((v) => !v)} size="sm">
              Só pendentes
            </Button>
            <Input placeholder="🔍 buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48 bg-white dark:bg-gray-800" />
          </div>
        </div>

        {/* datalist compartilhado para autocomplete */}
        <datalist id="cadastro-artistas">
          {cadastro.map((c) => <option key={c.id} value={c.nome} />)}
        </datalist>

        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-0 divide-y divide-gray-100 dark:divide-gray-700">
              {visiveis.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">Nenhum evento com os filtros atuais.</div>
              )}
              {visiveis.map((row) => (
                <div key={row.id} className="p-3 md:p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* data + evento */}
                  <div className="md:w-64 shrink-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {fmtData(row.data_evento)} <span className="font-normal text-gray-500 capitalize">{row.dia_semana}</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[16rem]" title={row.nome}>{row.nome || '—'}</div>
                  </div>

                  {/* métricas */}
                  <div className="md:w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    <div className="font-medium text-gray-700 dark:text-gray-300">{fmtBRL(row.faturamento)}</div>
                    <div>{row.publico} PAX{row.ticket ? ` · ${fmtBRL(row.ticket)}` : ''}</div>
                  </div>

                  {/* artistas */}
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    {row.artistas.map((a, idx) => {
                      // vermelho: artista taggeado sem cachê, mas o dia TEM pagamento no CA
                      // (sinal de que a grana caiu toda em outro artista e este ficou de fora)
                      const semPagamento = !a.cachet && row.custo_atracao_total > 0;
                      return (
                      <Badge
                        key={idx}
                        variant={a.principal ? 'default' : 'secondary'}
                        className={`gap-1 pr-1 ${semPagamento ? 'border border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600' : ''}`}
                        title={semPagamento ? 'Sem pagamento atrelado — o cachê pode ter caído em outro artista do dia. Ajuste nos "Pagamentos CA" abaixo.' : undefined}
                      >
                        {a.principal && <Star className="w-3 h-3 text-amber-300 fill-amber-300" />}
                        <span className="capitalize text-[10px] opacity-60">{a.tipo}</span>
                        {a.artista_nome}
                        {a.cachet
                          ? <span className="text-[10px] opacity-70">· {fmtBRL(a.cachet)}</span>
                          : (semPagamento ? <span className="text-[10px] font-medium">· sem R$</span> : null)}
                        <button onClick={() => remover(row, idx)} className="ml-1 rounded hover:bg-black/10 dark:hover:bg-white/10">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                      );
                    })}

                    {row.artistas.length === 0 && row.sugestao.length > 0 && (
                      <button
                        onClick={() => aceitarSugestao(row)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100"
                        title="Aceitar sugestão"
                      >
                        <Sparkles className="w-3 h-3" />
                        {row.sugestao.map((s) => s.nome).join(' + ')}
                        <Check className="w-3 h-3" />
                      </button>
                    )}

                    <AddArtista onAdd={(nome) => adicionar(row, nome)} />

                    {row.artistas.length > 0 && (
                      <button
                        onClick={() => propagar(row)}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        title="Aplicar a eventos com nome igual neste mês"
                      >
                        <Copy className="w-3 h-3" /> iguais
                      </button>
                    )}
                  </div>

                  {/* principal / custo CA */}
                  <div className="md:w-56 shrink-0 text-xs">
                    {row.principal_nome ? (
                      <>
                        <div className="flex items-center gap-1 font-medium text-gray-900 dark:text-white">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {row.principal_nome}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          {fmtBRL(row.principal_cachet || 0)}
                          {row.pct_principal != null && ` · ${(row.pct_principal * 100).toFixed(0)}% do fat`}
                          {row.retorno != null && ` · ${row.retorno.toFixed(1)}x`}
                        </div>
                      </>
                    ) : row.ca_maior ? (
                      <div className="text-amber-600 dark:text-amber-400" title="Maior cachê do CA no dia — não casou com os artistas taggeados; ajuste o nome do artista pra casar">
                        CA: {row.ca_maior.nome} · {fmtBRL(row.ca_maior.valor)} <span className="opacity-70">(sem match)</span>
                      </div>
                    ) : row.custo_atracao_total > 0 ? (
                      <div className="text-gray-500">atração {fmtBRL(row.custo_atracao_total)}</div>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </div>

                  {/* status */}
                  <div className="md:w-16 shrink-0 text-right">
                    {status[row.id] === 'saving' && <Loader2 className="w-4 h-4 animate-spin text-gray-400 inline" />}
                    {status[row.id] === 'saved' && <span className="text-xs text-emerald-600 inline-flex items-center gap-0.5"><Check className="w-3 h-3" /> salvo</span>}
                    {status[row.id] === 'error' && <span className="text-xs text-red-600 inline-flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> erro</span>}
                  </div>
                  </div>

                  {/* pagamentos do CA do dia: collapse com cada lançamento, quem casou e opção de trocar/desfazer */}
                  {row.ca_lancamentos && row.ca_lancamentos.length > 0 && (
                    <CaPagamentos
                      lancamentos={row.ca_lancamentos}
                      eventos={eventosCorrigir.length ? eventosCorrigir : rows}
                      cadastro={cadastro}
                      artistasDoDia={row.artistas.filter((a) => a.artista_id)}
                      currentEvento={{ id: row.id, data_evento: row.data_evento, nome: row.nome }}
                      onAtribuir={atribuirCA}
                      onCorrigir={corrigirDia}
                      onDesfazer={desfazerCorrigir}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Painel colapsável com TODOS os pagamentos do CA do dia: quem casou, quanto, e
// controle pra trocar/desfazer cada vínculo. Auto-abre quando há algo sem match.
function CaPagamentos({
  lancamentos, eventos, cadastro, artistasDoDia, currentEvento, onAtribuir, onCorrigir, onDesfazer,
}: {
  lancamentos: CaLancamento[];
  eventos: Array<{ id: number; data_evento: string; nome: string }>;
  cadastro: Cadastro[];
  artistasDoDia: ArtistaTag[];
  currentEvento: { id: number; data_evento: string; nome: string };
  onAtribuir: (pessoa: string, artistaId: number) => void;
  onCorrigir: (l: CaLancamento, eventoId: number, dataEvento: string, artistaNome: string, artistaId: number | null) => void;
  onDesfazer: (l: CaLancamento) => void;
}) {
  const semMatch = lancamentos.filter((l) => l.artista_id == null).length;
  const [aberto, setAberto] = useState(semMatch > 0);
  const total = lancamentos.reduce((s, l) => s + l.valor, 0);
  return (
    <div className="mt-2 md:pl-[17rem]">
      <button
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${aberto ? 'rotate-90' : ''}`} />
        Pagamentos CA · {lancamentos.length} · {fmtBRL(total)}
        {semMatch > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">· {semMatch} sem match</span>}
      </button>
      {aberto && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-gray-100 dark:border-gray-700 pl-3">
          {lancamentos.map((l, i) => (
            <CaLinha
              key={l.contaazul_id || i}
              l={l}
              eventos={eventos}
              cadastro={cadastro}
              artistasDoDia={artistasDoDia}
              currentEvento={currentEvento}
              onAtribuir={onAtribuir}
              onCorrigir={onCorrigir}
              onDesfazer={onDesfazer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Uma linha de pagamento do CA. Mostra pra quem casou (ou "sem match") e abre um
// editor: escolher o dia (show) + o artista. Se já foi corrigido, oferece "desfazer".
function CaLinha({
  l, eventos, cadastro, artistasDoDia, currentEvento, onAtribuir, onCorrigir, onDesfazer,
}: {
  l: CaLancamento;
  eventos: Array<{ id: number; data_evento: string; nome: string }>;
  cadastro: Cadastro[];
  artistasDoDia: ArtistaTag[];
  currentEvento: { id: number; data_evento: string; nome: string };
  onAtribuir: (pessoa: string, artistaId: number) => void;
  onCorrigir: (l: CaLancamento, eventoId: number, dataEvento: string, artistaNome: string, artistaId: number | null) => void;
  onDesfazer: (l: CaLancamento) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [evId, setEvId] = useState(String(currentEvento.id));
  const [artista, setArtista] = useState('');
  const matched = l.artista_id != null;
  const selCls = 'rounded border border-gray-200 dark:border-gray-600 bg-transparent px-1 py-0.5 text-xs';
  const commit = () => {
    const ev = eventos.find((e) => String(e.id) === evId) || currentEvento;
    if (!ev || !artista.trim()) return;
    const hit = cadastro.find((c) => c.nome.toLowerCase() === artista.trim().toLowerCase());
    onCorrigir(l, ev.id, ev.data_evento, artista.trim(), hit?.id ?? null);
    setArtista(''); setAberto(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {matched
        ? <Check className="w-3 h-3 text-emerald-500 shrink-0" />
        : <span className="text-amber-600 dark:text-amber-400 font-medium shrink-0">sem match</span>}
      <span className="text-gray-700 dark:text-gray-300">{l.pessoa || l.descricao}</span>
      {l.pessoa && l.descricao && <span className="text-gray-400 truncate max-w-[13rem]" title={l.descricao}>{l.descricao}</span>}
      <span className="text-gray-500">{fmtBRL(l.valor)}</span>
      {matched && <span className="text-gray-500">→ <span className="font-medium text-gray-700 dark:text-gray-300">{l.artista_nome}</span></span>}
      {l.overridden && <span className="text-[10px] text-purple-500 dark:text-purple-400">corrigido</span>}

      <button onClick={() => setAberto((v) => !v)} className="text-purple-600 dark:text-purple-400 hover:underline">
        {matched ? 'trocar' : 'corrigir'}
      </button>
      {l.overridden && (
        <button onClick={() => onDesfazer(l)} className="text-gray-400 hover:text-red-500 hover:underline">desfazer</button>
      )}

      {aberto && (
        <span className="inline-flex flex-wrap items-center gap-1 basis-full pl-5 mt-0.5">
          {!matched && artistasDoDia.length > 0 && (
            <>
              <select className={selCls} defaultValue="" onChange={(e) => { const id = Number(e.target.value); if (id) { onAtribuir(l.pessoa, id); setAberto(false); } }}>
                <option value="">atribuir a… (mesmo dia)</option>
                {artistasDoDia.map((a) => <option key={a.artista_id} value={a.artista_id!}>{a.artista_nome}</option>)}
              </select>
              <span className="text-gray-300 dark:text-gray-600">|</span>
            </>
          )}
          <span className="text-gray-400">dia:</span>
          <select className={selCls} value={evId} onChange={(e) => setEvId(e.target.value)}>
            {eventos.map((e) => <option key={e.id} value={e.id}>{fmtData(e.data_evento)} · {e.nome || '—'}</option>)}
          </select>
          <input
            list="cadastro-artistas"
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
            onBlur={commit}
            placeholder="artista"
            className="w-32 rounded border border-gray-200 dark:border-gray-600 bg-transparent px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </span>
      )}
    </div>
  );
}

function AddArtista({ onAdd }: { onAdd: (nome: string) => void }) {
  const [valor, setValor] = useState('');
  const commit = () => { if (valor.trim()) { onAdd(valor); setValor(''); } };
  return (
    <input
      list="cadastro-artistas"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      onBlur={commit}
      placeholder="+ artista"
      className="w-32 rounded border border-gray-200 dark:border-gray-600 bg-transparent px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
    />
  );
}
