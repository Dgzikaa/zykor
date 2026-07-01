'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import {
  Timer, Play, Pause, RotateCcw, Save, Search, Plus, Trash2, User,
  Loader2, History, Package, Clock, TrendingDown, DollarSign, X, Scale, AlertTriangle, CalendarCheck,
  CalendarDays, CheckCircle2, Gauge, ListChecks, Users, Pencil,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';

// ISO de "dia + N" sem fuso (date math em UTC, igual ao restante das telas de planejamento)
const addDiasIso = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const fmtDM = (iso: any) => iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '—';

// Valor em R$ do desvio de RENDIMENTO de uma execução:
// (rendimento real − rendimento esperado) × custo por kg da produção (= custo planejado ÷ rendimento esperado).
// Ex.: rendeu 5,820 vs 5,6375 kg esperado, custo R$113,10/kg → +0,1885 × 113,10 ≈ +R$21,32.
const desvioRendReais = (e: any): number | null => {
  if (e?.rendimento_real == null || e?.rendimento_esperado == null || e?.custo_planejado == null) return null;
  const resp = Number(e.rendimento_esperado);
  if (!(resp > 0)) return null;
  const custoPorKg = Number(e.custo_planejado) / resp;
  return (Number(e.rendimento_real) - resp) * custoPorKg;
};

// ---------- helpers ----------
const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: any, d = 0) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const fmtPct = (v: any, d = 1) => v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d })}%`;
const fmtTempo = (seg: any) => {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
};
const fmtData = (iso: any) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

interface FichaItem {
  id: number;
  componente_tipo: 'insumo' | 'producao';
  insumo_codigo: string | null;
  insumo_id_vmarket: number | null;
  componente_codigo: string | null;
  nome_componente: string | null;
  quantidade: number;
  unidade_exib: string | null;
  preco_un: number | null;
  is_mestre: boolean;
  insumo_fc?: boolean; // insumo tem fator de correção (precisa de peso bruto → líquido)
}

// uma produção em execução (cronômetro próprio) — várias podem rodar em paralelo
interface ActiveProd {
  localId: string;
  ficha: any;
  itens: FichaItem[];
  loadingItens: boolean;
  responsavelId: number | null;
  pesoBruto: string;
  pesoMestre: string;
  rendimentoReal: string;
  observacao: string;
  qtdReal: Record<number, string>;
  segundos: number;
  rodando: boolean;
  dataProducao?: string; // retroativa: data (YYYY-MM-DD) em que a produção foi feita; vazio = hoje
}

// =====================================================================================
// ABA EXECUTAR — múltiplas produções simultâneas, cada uma com seu timer
// =====================================================================================
function AbaExecutar({ fichas, responsaveis }: { fichas: any[]; responsaveis: any[] }) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  // seleção de ficha para adicionar
  const [secao, setSecao] = useState<'Cozinha' | 'Bar' | null>(null);
  const [busca, setBusca] = useState('');
  const [picker, setPicker] = useState(false);

  // produções ativas + qual está aberta no detalhe
  const [prods, setProds] = useState<ActiveProd[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ prod: ActiveProd; suspeitos: { campo: string; valor: number; unidade: string | null; esperado: number }[] } | null>(null);
  const idRef = useRef(0);

  // timer global: incrementa todas as produções rodando, a cada 1s
  useEffect(() => {
    const t = setInterval(() => {
      setProds(prev => prev.some(p => p.rodando) ? prev.map(p => p.rodando ? { ...p, segundos: p.segundos + 1 } : p) : prev);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // calendarização da semana: conversa com o Planejamento da Produção (mesmo time-frame).
  // Mostra o que/quanto foi planejado por dia (planos encerrados) p/ a semana selecionada.
  const [planSemana, setPlanSemana] = useState<any | null>(null);
  const [semanaSel, setSemanaSel] = useState<string | null>(null);
  useEffect(() => {
    if (!barId) return;
    const qs = semanaSel ? `?calendario=1&semana=${encodeURIComponent(semanaSel)}` : '?calendario=1';
    api.get(`/api/operacional/plano-producao${qs}`).then(r => { if (r?.success) setPlanSemana(r); }).catch(() => {});
  }, [barId, semanaSel]);

  const DIAS_LBL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const hojeIso = new Date().toISOString().slice(0, 10);
  const diasPlano = useMemo(() => {
    const ini = planSemana?.semana?.ini;
    if (!ini) return [];
    const [y, m, d] = ini.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const iso = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
      return { iso, label: `${DIAS_LBL[i]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`, itens: (planSemana.itens || []).filter((it: any) => it.dia_producao === iso) };
    });
  }, [planSemana]);
  const semDia = useMemo(() => (planSemana?.itens || []).filter((it: any) => !it.dia_producao), [planSemana]);

  const secaoDe = (f: any) => (f.codigo || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';
  const fichasControle = useMemo(() => fichas.filter(f => f.controle_producao), [fichas]);
  const fichasView = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return fichasControle.filter(f => {
      if (secao && secaoDe(f) !== secao) return false;
      return !q || (f.nome || '').toLowerCase().includes(q) || (f.codigo || '').toLowerCase().includes(q);
    });
  }, [fichasControle, busca, secao]);

  const patch = useCallback((id: string, p: Partial<ActiveProd>) =>
    setProds(prev => prev.map(x => x.localId === id ? { ...x, ...p } : x)), []);

  const adicionar = async (f: any) => {
    const localId = `p${++idRef.current}`;
    const nova: ActiveProd = {
      localId, ficha: f, itens: [], loadingItens: true, responsavelId: null,
      pesoBruto: '', pesoMestre: '', rendimentoReal: '', observacao: '', qtdReal: {}, segundos: 0, rodando: false, dataProducao: '',
    };
    setProds(prev => [...prev, nova]);
    setSelId(localId);
    setBusca(''); setPicker(false);
    try {
      const r = await api.get(`/api/operacional/producoes/ficha?producao_id=${f.id}&bar_id=${barId}`);
      patch(localId, { itens: r.success ? (r.itens || []) : [], loadingItens: false });
    } catch { patch(localId, { loadingItens: false }); }
  };

  const remover = (id: string) => {
    setProds(prev => {
      const next = prev.filter(p => p.localId !== id);
      setSelId(s => s === id ? (next[next.length - 1]?.localId ?? null) : s);
      return next;
    });
  };

  // cálculos derivados de uma produção (proporção do mestre, custo, desvio)
  const calc = (prod: ActiveProd) => {
    const mestre = prod.itens.find(i => i.is_mestre) || null;
    const mestreQtd = Number(mestre?.quantidade || 0);
    const pesoMestreNum = parseFloat(prod.pesoMestre) || 0;
    const proporcao = (mestre && pesoMestreNum > 0 && mestreQtd > 0) ? pesoMestreNum / mestreQtd : 1;
    const linhas = prod.itens.map(it => {
      const qtdPlan = Number(it.quantidade || 0);
      const qtdCalc = it.is_mestre ? (pesoMestreNum > 0 ? pesoMestreNum : qtdPlan) : qtdPlan * proporcao;
      const ov = prod.qtdReal[it.id];
      const real = ov != null && ov !== '' ? (parseFloat(ov) || 0) : qtdCalc;
      const precoUn = Number(it.preco_un || 0);
      const cPlan = qtdCalc * precoUn;
      const cReal = real * precoUn;
      const desvio = qtdCalc > 0 ? (real - qtdCalc) / qtdCalc : null;
      return { it, qtdPlan, qtdCalc, real, precoUn, cPlan, cReal, desvio };
    });
    const custoPlan = linhas.reduce((s, l) => s + l.cPlan, 0);
    const custoReal = linhas.reduce((s, l) => s + l.cReal, 0);
    const rendEsperado = Number(prod.ficha?.rendimento || 0) * proporcao;
    return { mestre, mestreQtd, proporcao, linhas, custoPlan, custoReal, rendEsperado };
  };

  const iniciar = (prod: ActiveProd) => {
    if (!prod.responsavelId) { toast({ title: 'Selecione o responsável', variant: 'destructive' }); return; }
    patch(prod.localId, { rodando: true });
  };

  // detecta valores prováveis de erro de unidade (ex.: digitou 1,2 como se fosse kg onde a meta é 1.020 g)
  const checarUnidades = (prod: ActiveProd) => {
    const { mestre, mestreQtd, linhas, rendEsperado } = calc(prod);
    const FATOR = 50; // diferença de ~50x+ quase sempre é confusão de unidade (g×kg, ml×L), não variação real
    const off = (val: number, ref: number) => ref > 0 && val > 0 && (val / ref >= FATOR || ref / val >= FATOR);
    const sus: { campo: string; valor: number; unidade: string | null; esperado: number }[] = [];
    const rreal = parseFloat(prod.rendimentoReal) || 0;
    if (rendEsperado > 0 && off(rreal, rendEsperado)) sus.push({ campo: 'Rendimento real', valor: rreal, unidade: prod.ficha.unidade, esperado: rendEsperado });
    const pm = parseFloat(prod.pesoMestre) || 0;
    if (mestre && off(pm, mestreQtd)) sus.push({ campo: `${mestre.insumo_fc ? 'Peso líquido' : 'Peso'} do mestre — ${mestre.nome_componente || ''}`.trim(), valor: pm, unidade: mestre.unidade_exib, esperado: mestreQtd });
    const pb = parseFloat(prod.pesoBruto) || 0;
    if (mestre?.insumo_fc && off(pb, mestreQtd)) sus.push({ campo: `Peso bruto do mestre — ${mestre.nome_componente || ''}`.trim(), valor: pb, unidade: mestre.unidade_exib, esperado: mestreQtd });
    for (const l of linhas) {
      if (off(l.real, l.qtdCalc)) sus.push({ campo: l.it.nome_componente || l.it.componente_codigo || 'Insumo', valor: l.real, unidade: l.it.unidade_exib, esperado: l.qtdCalc });
    }
    return sus;
  };

  const pedirSalvar = (prod: ActiveProd) => {
    if (!prod.responsavelId) { toast({ title: 'Selecione o responsável', variant: 'destructive' }); return; }
    if (!prod.rendimentoReal.trim()) { toast({ title: 'Informe o rendimento real produzido', variant: 'destructive' }); return; }
    const suspeitos = checarUnidades(prod);
    if (suspeitos.length) { setConfirmar({ prod, suspeitos }); return; }
    executarSalvar(prod);
  };

  const executarSalvar = async (prod: ActiveProd) => {
    if (!barId) return;
    setConfirmar(null);
    setSalvandoId(prod.localId);
    patch(prod.localId, { rodando: false });
    const { linhas, rendEsperado, mestre } = calc(prod);
    // retroativa: se lançou uma data passada, ancora fim ao meio-dia dela (o desvio usa inicio::date)
    const hoje = new Date().toISOString().slice(0, 10);
    const agora = (prod.dataProducao && prod.dataProducao !== hoje)
      ? new Date(`${prod.dataProducao}T12:00:00`)
      : new Date();
    const inicio = new Date(agora.getTime() - prod.segundos * 1000);
    const resp = responsaveis.find(r => r.id === prod.responsavelId);
    const payload = {
      bar_id: barId,
      producao_id: prod.ficha.id,
      responsavel_id: prod.responsavelId,
      responsavel_nome: resp?.nome ?? null,
      inicio: inicio.toISOString(),
      fim: agora.toISOString(),
      duracao_seg: prod.segundos,
      rendimento_esperado: rendEsperado || null,
      rendimento_real: parseFloat(prod.rendimentoReal) || null,
      peso_mestre_real: parseFloat(prod.pesoMestre) || null,
      peso_bruto: mestre?.insumo_fc ? (parseFloat(prod.pesoBruto) || null) : null,
      observacao: prod.observacao.trim() || null,
      insumos: linhas.map(l => ({
        insumo_codigo: l.it.insumo_codigo ?? l.it.componente_codigo ?? null,
        insumo_id_vmarket: l.it.insumo_id_vmarket ?? null,
        nome: l.it.nome_componente ?? l.it.componente_codigo ?? null,
        is_mestre: l.it.is_mestre,
        qtd_planejada: l.qtdPlan,
        qtd_calculada: l.qtdCalc,
        qtd_real: l.real,
        unidade: l.it.unidade_exib ?? null,
        preco_un: l.precoUn,
      })),
    };
    try {
      const r = await api.post('/api/operacional/producoes/execucao', payload);
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Produção registrada', description: `${prod.ficha.nome} · aderência ${fmtPct(r.aderencia_pct)} · custo real ${fmtBRL(r.custo_real)}` });
      remover(prod.localId);
    } catch (e: any) { toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' }); }
    finally { setSalvandoId(null); }
  };

  const sel = prods.find(p => p.localId === selId) || null;

  return (
    <div className="space-y-4">
      {/* Calendário do Planejamento da Produção (mesma semana do Planejamento) */}
      {planSemana && (
        <Card className="card-dark border-violet-200 dark:border-violet-900/40">
          <CardContent className="py-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4" />Planejamento da produção
              </div>
              <select value={semanaSel ?? planSemana.semana_sel ?? ''} onChange={e => setSemanaSel(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 cursor-pointer">
                {(planSemana.semanas_disponiveis || []).map((s: any) => {
                  const dm = (x: string) => x.split('-').reverse().slice(0, 2).join('/');
                  return <option key={s.ini} value={s.ini} disabled={!s.tem_contagem} className="text-gray-900">{dm(s.ini)} – {dm(s.fim)}{s.tem_contagem ? '' : ' (aguardando contagem)'}</option>;
                })}
              </select>
              <span className="text-xs text-gray-400">clique numa produção pra iniciar (ou faça outra coisa)</span>
            </div>

            {(planSemana.itens || []).length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum planejamento encerrado para esta semana. Finalize o planejamento em <b>Planejamento da Produção</b> pra a calendarização aparecer aqui — mas você já pode <b>iniciar qualquer produção abaixo</b>, fora do planejamento.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {diasPlano.map((d) => (
                  <div key={d.iso} className={`rounded-lg border p-2 min-h-[64px] ${d.iso === hojeIso ? 'border-violet-400 bg-violet-50/60 dark:bg-violet-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className={`text-[11px] font-medium mb-1.5 ${d.iso === hojeIso ? 'text-violet-700 dark:text-violet-300' : 'text-gray-500 dark:text-gray-400'}`}>{d.label}{d.iso === hojeIso ? ' · hoje' : ''}</div>
                    <div className="space-y-1">
                      {d.itens.length === 0 ? <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>
                        : d.itens.map((it: any) => {
                          const f = fichas.find(x => x.id === it.producao_id);
                          return (
                            <button key={it.producao_id} onMouseDown={() => f && adicionar(f)} disabled={!f}
                              title={f ? 'Adicionar ao cronômetro' : 'Ficha indisponível p/ este bar'}
                              className="w-full text-left inline-flex items-center gap-1 rounded border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-1 text-[11px] hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50">
                              <Plus className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0" />
                              <span className="text-gray-900 dark:text-gray-100 truncate">{it.producao_nome}</span>
                              <span className="ml-auto text-violet-600 dark:text-violet-400 shrink-0">{fmtNum(it.decidido_receitas, 0)}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {semDia.length > 0 && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400">⚠ {semDia.length} produç{semDia.length > 1 ? 'ões' : 'ão'} planejada{semDia.length > 1 ? 's' : ''} sem dia definido (defina o dia no Planejamento p/ aparecer no calendário).</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Adicionar produção */}
      <Card className="card-dark">
        <CardContent className="py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1"><Plus className="w-4 h-4" />Iniciar produção</span>
            <div className="flex gap-1">
              {(['Cozinha', 'Bar'] as const).map(c => (
                <button key={c} onClick={() => setSecao(s => s === c ? null : c)}
                  className={`text-[11px] rounded px-2.5 py-0.5 border ${secao === c ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  {c === 'Cozinha' ? '👨‍🍳 Cozinha' : '🍺 Bar'}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={busca} onChange={e => { setBusca(e.target.value); setPicker(true); }} onFocus={() => setPicker(true)}
                onBlur={() => setTimeout(() => setPicker(false), 200)} placeholder="Buscar produção para adicionar…" className="pl-9 h-9" />
              {picker && fichasView.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {fichasView.slice(0, 30).map(f => (
                    <button key={f.id} onMouseDown={() => adicionar(f)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      {f.nome}<span className="block text-xs text-gray-400">{f.codigo ? `${f.codigo} · ` : ''}rend. {fmtNum(f.rendimento, 3)} {f.unidade || ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {picker && fichasView.length === 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg px-3 py-3 text-xs text-gray-500">
                  {fichasControle.length === 0
                    ? 'Nenhuma produção marcada para o Controle. Marque as fichas em Fichas Técnicas → aba Produção (checkbox).'
                    : 'Nenhuma produção encontrada com esse filtro/busca.'}
                </div>
              )}
            </div>
          </div>

          {/* Tabs das produções ativas (timers simultâneos) */}
          {prods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {prods.map(p => (
                <button key={p.localId} onClick={() => setSelId(p.localId)}
                  className={`group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${selId === p.localId ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                  <span className={`w-2 h-2 rounded-full ${p.rodando ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[160px] truncate">{p.ficha.nome}</span>
                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{fmtTempo(p.segundos)}</span>
                  <span onClick={(e) => { e.stopPropagation(); remover(p.localId); }} className="text-gray-300 hover:text-red-500" title="Remover"><X className="w-3.5 h-3.5" /></span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhe da produção selecionada */}
      {!sel ? (
        <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400"><Timer className="w-10 h-10 mx-auto mb-2 opacity-40" />Adicione uma produção acima para iniciar. Você pode ter várias rodando ao mesmo tempo.</CardContent></Card>
      ) : (() => {
        const { mestre, mestreQtd, proporcao, linhas, custoPlan, custoReal, rendEsperado } = calc(sel);
        const mestreFc = !!mestre?.insumo_fc;
        const pbNum = parseFloat(sel.pesoBruto) || 0;
        const plNum = parseFloat(sel.pesoMestre) || 0;
        const fcReal = mestreFc && pbNum > 0 && plNum > 0 ? plNum / pbNum : 0; // aproveitamento (líquido/bruto), 0–1 — mesma convenção do FC da ficha
        const iniciada = sel.rodando || sel.segundos > 0; // peso/rendimento só liberam depois de iniciar a produção
        return (
          <Card className="card-dark"><CardContent className="py-3 space-y-4">
            {/* Cabeçalho + timer */}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{sel.ficha.nome}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{sel.ficha.codigo ? `${sel.ficha.codigo} · ` : ''}rendimento ficha {fmtNum(sel.ficha.rendimento, 3)} {sel.ficha.unidade || ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-4 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center min-w-[110px]">
                  <div className="text-[10px] text-blue-600/80 dark:text-blue-300/80 uppercase tracking-wide flex items-center justify-center gap-1"><Clock className="w-3 h-3" />Tempo</div>
                  <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-300 leading-tight">{fmtTempo(sel.segundos)}</div>
                </div>
                {!sel.rodando
                  ? <Button size="sm" onClick={() => iniciar(sel)} className="bg-green-600 hover:bg-green-700"><Play className="w-4 h-4 mr-1" />{sel.segundos > 0 ? 'Continuar' : 'Iniciar'}</Button>
                  : <Button size="sm" onClick={() => patch(sel.localId, { rodando: false })} variant="outline"><Pause className="w-4 h-4 mr-1" />Pausar</Button>}
                <Button size="sm" variant="ghost" onClick={() => patch(sel.localId, { rodando: false, segundos: 0 })} title="Zerar tempo"><RotateCcw className="w-4 h-4" /></Button>
              </div>
            </div>

            {!iniciada && <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><Play className="w-3 h-3" />Selecione o responsável e <b>inicie a produção</b> antes de pesar o bruto e lançar o rendimento.</div>}

            {/* data da produção (permite lançamento retroativo — ex.: esqueceram de iniciar no dia) */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 flex items-center gap-1"><CalendarCheck className="w-3.5 h-3.5" />Data da produção:</span>
              <Input type="date" value={sel.dataProducao || new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)}
                onChange={e => patch(sel.localId, { dataProducao: e.target.value })} className="h-8 w-40" />
              {sel.dataProducao && sel.dataProducao !== new Date().toISOString().slice(0, 10) && <span className="text-amber-600 dark:text-amber-400 font-medium">retroativa</span>}
            </div>

            {/* Responsável + peso mestre + rendimento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><User className="w-3.5 h-3.5" />Responsável *</label>
                <select value={sel.responsavelId ?? ''} onChange={e => patch(sel.localId, { responsavelId: e.target.value ? Number(e.target.value) : null })}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
                  <option value="">Selecione…</option>
                  {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}{r.cargo ? ` (${r.cargo})` : ''}</option>)}
                </select>
              </div>
              {mestreFc ? (
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5" />Peso do mestre{mestre?.unidade_exib ? ` (${mestre.unidade_exib})` : ''} <span className="text-amber-500 font-medium">· FC</span></label>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] w-12 text-gray-400 shrink-0">Bruto</span>
                      <Input type="number" inputMode="decimal" step="any" disabled={!iniciada} value={sel.pesoBruto} onChange={e => patch(sel.localId, { pesoBruto: e.target.value })} placeholder="antes de limpar" className="h-9" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] w-12 text-gray-400 shrink-0">Líquido</span>
                      <Input type="number" inputMode="decimal" step="any" disabled={!iniciada} value={sel.pesoMestre} onChange={e => patch(sel.localId, { pesoMestre: e.target.value })} placeholder={`limpo · ficha ${fmtNum(mestreQtd, 3)}`} className="h-9" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {(() => { const fcEsp = Number((mestre as any)?.fator_correcao) || 0; return fcReal > 0 ? (
                      <>FC real <b className={fcEsp > 0 && fcReal < fcEsp - 0.02 ? 'text-red-600 dark:text-red-400' : fcEsp > 0 && fcReal > fcEsp + 0.02 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}>{fmtNum(fcReal, 2)}</b>
                        {fcEsp > 0 && fcEsp !== 1 ? ` · esperado ${fmtNum(fcEsp, 2)} (ficha)` : ''} · </>
                    ) : ''; })()}o líquido dirige a receita</p>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5" />Peso real do mestre{mestre ? ` (${mestre.unidade_exib || ''})` : ''}</label>
                  <Input type="number" inputMode="decimal" step="any" value={sel.pesoMestre} onChange={e => patch(sel.localId, { pesoMestre: e.target.value })}
                    placeholder={mestre ? `ficha: ${fmtNum(mestreQtd, 3)}` : 'sem insumo mestre'} disabled={!mestre || !iniciada} className="h-10" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Package className="w-3.5 h-3.5" />Rendimento real * {rendEsperado > 0 && <span className="text-gray-400">· meta {fmtNum(rendEsperado, 3)} {sel.ficha.unidade || ''}</span>}</label>
                <Input type="number" inputMode="decimal" step="any" disabled={!iniciada} value={sel.rendimentoReal} onChange={e => patch(sel.localId, { rendimentoReal: e.target.value })} placeholder="produzido…" className="h-10" />
              </div>
            </div>

            {/* Resumo de custo */}
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo planejado</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(custoPlan)}</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/15 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo real</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400">{fmtBRL(custoReal)}</div>
              </div>
              {proporcao !== 1 && (
                <div className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/15 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Proporção</div>
                  <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">×{fmtNum(proporcao, 3)}</div>
                </div>
              )}
            </div>

            {/* Insumos */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                  <th className="text-left font-medium px-2 py-1.5">Insumo</th>
                  <th className="text-right font-medium px-2 py-1.5">Planejado</th>
                  <th className="text-right font-medium px-2 py-1.5">Calculado</th>
                  <th className="text-right font-medium px-2 py-1.5 w-28">Usado</th>
                  <th className="text-right font-medium px-2 py-1.5">Desvio</th>
                  <th className="text-right font-medium px-2 py-1.5">Custo real</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sel.loadingItens ? <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  : linhas.length === 0 ? <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400">Ficha sem componentes.</td></tr>
                  : linhas.map(l => (
                    <tr key={l.it.id} className={l.it.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                      <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">
                        {l.it.is_mestre && <span className="text-amber-500 mr-1" title="Insumo mestre">★</span>}
                        {l.it.nome_componente || l.it.componente_codigo || `#${l.it.id}`}
                        <span className="text-xs text-gray-400 ml-1">{l.it.unidade_exib || ''}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtNum(l.qtdPlan, 3)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(l.qtdCalc, 3)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Input type="number" inputMode="decimal" step="any" value={sel.qtdReal[l.it.id] ?? ''} onChange={e => patch(sel.localId, { qtdReal: { ...sel.qtdReal, [l.it.id]: e.target.value } })}
                          placeholder={fmtNum(l.qtdCalc, 3)} className="h-8 text-right text-sm" />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {l.desvio == null ? '—' : (
                          <span className={Math.abs(l.desvio) < 0.05 ? 'text-emerald-600' : Math.abs(l.desvio) < 0.15 ? 'text-amber-600' : 'text-red-600'}>
                            {l.desvio > 0 ? '+' : ''}{fmtPct(l.desvio * 100)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(l.cReal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Observação + ações */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              <Input value={sel.observacao} onChange={e => patch(sel.localId, { observacao: e.target.value })} placeholder="Observação (opcional)…" className="flex-1" />
              <Button variant="outline" onClick={() => remover(sel.localId)} className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4 mr-1" />Descartar</Button>
              <Button onClick={() => pedirSalvar(sel)} disabled={salvandoId === sel.localId} className="bg-indigo-600 hover:bg-indigo-700">
                {salvandoId === sel.localId ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Salvar execução
              </Button>
            </div>
          </CardContent></Card>
        );
      })()}

      {/* Alerta de confirmação de unidade ao salvar */}
      {confirmar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmar(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-semibold">Confira as unidades</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Alguns valores parecem fora da unidade esperada. Confira se não houve confusão de unidade (ex.: <b>g × kg</b>, <b>ml × L</b>):</p>
            <div className="space-y-2">
              {confirmar.suspeitos.map((s, i) => (
                <div key={i} className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/15 px-3 py-2 text-sm">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{s.campo}</div>
                  <div className="text-gray-700 dark:text-gray-300">Você digitou <b>{fmtNum(s.valor, 3)} {s.unidade || ''}</b> — esperado ~<b>{fmtNum(s.esperado, 3)} {s.unidade || ''}</b>.</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmar(null)}>Voltar e corrigir</Button>
              <Button onClick={() => executarSalvar(confirmar.prod)} className="bg-amber-600 hover:bg-amber-700">Está correto, salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================================
// ABA HISTÓRICO
// =====================================================================================
function AbaHistorico({ fichas, responsaveis }: { fichas: any[]; responsaveis: any[] }) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  const [execs, setExecs] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [fProd, setFProd] = useState<number | null>(null);
  const [fResp, setFResp] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [detInsumos, setDetInsumos] = useState<any[]>([]);
  // filtro de semana — mesmo time-frame do Planejamento da Produção (null = todas)
  const [semanaSel, setSemanaSel] = useState<string | null>(null);
  const [planSemana, setPlanSemana] = useState<any | null>(null);

  // lista de semanas + itens planejados (planos encerrados) da semana selecionada
  useEffect(() => {
    if (!barId) return;
    const qs = semanaSel ? `?calendario=1&semana=${encodeURIComponent(semanaSel)}` : '?calendario=1';
    api.get(`/api/operacional/plano-producao${qs}`).then(r => { if (r?.success) setPlanSemana(r); }).catch(() => {});
  }, [barId, semanaSel]);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ bar_id: String(barId) });
      if (fProd) qs.set('producao_id', String(fProd));
      if (fResp) qs.set('responsavel_id', String(fResp));
      if (semanaSel) { qs.set('de', semanaSel); qs.set('ate', `${addDiasIso(semanaSel, 6)}T23:59:59.999`); }
      const r = await api.get(`/api/operacional/producoes/execucao?${qs.toString()}`);
      if (r.success) { setExecs(r.execucoes || []); setBaselines(r.baselines || {}); }
    } finally { setLoading(false); }
  }, [barId, fProd, fResp, semanaSel]);
  useEffect(() => { carregar(); }, [carregar]);

  // Resumo da Semana: cruza o plano encerrado da semana com as execuções da semana
  const resumo = useMemo(() => {
    if (!semanaSel) return null;
    const planejados: any[] = (planSemana?.itens || []).filter((it: any) => Number(it.decidido_receitas) > 0);
    const planProdIds = new Set(planejados.map((it: any) => Number(it.producao_id)));
    const execProdIds = new Set(execs.map((e: any) => Number(e.producao_id)));
    const planejadasExecutadas = [...planProdIds].filter(id => execProdIds.has(id)).length;
    const comRend = execs.filter((e: any) => e.rendimento_real != null && e.rendimento_esperado != null && e.rendimento_esperado > 0);
    const dentro = comRend.filter((e: any) => Math.abs(e.rendimento_real / e.rendimento_esperado - 1) <= 0.05).length;
    const aders = execs.filter((e: any) => e.aderencia_pct != null).map((e: any) => Number(e.aderencia_pct));
    const aderMedia = aders.length ? aders.reduce((s: number, v: number) => s + v, 0) / aders.length : null;
    const tempoTotal = execs.reduce((s: number, e: any) => s + (Number(e.duracao_seg) || 0), 0);
    const custoPlan = execs.reduce((s: number, e: any) => s + (Number(e.custo_planejado) || 0), 0);
    const custoReal = execs.reduce((s: number, e: any) => s + (Number(e.custo_real) || 0), 0);
    const desvioRendTotal = execs.reduce((s: number, e: any) => s + (desvioRendReais(e) ?? 0), 0);
    return {
      planejadas: planProdIds.size,
      planejadasExecutadas,
      executadas: execs.length,
      aderMedia,
      rendDentro: dentro,
      rendTotal: comRend.length,
      tempoTotal,
      custoPlan, custoReal, desvioRendTotal,
    };
  }, [semanaSel, planSemana, execs]);

  const abrirDetalhe = async (e: any) => {
    setDetalhe(e); setDetInsumos([]);
    try {
      const r = await api.get(`/api/operacional/producoes/execucao?bar_id=${barId}&execucao_id=${e.id}`);
      if (r.success) setDetInsumos(r.insumos || []);
    } catch (err: any) { toast({ title: 'Erro', description: err?.message, variant: 'destructive' }); }
  };

  // flags de controle por execução
  const flags = (e: any) => {
    const out: { icon: any; label: string; cls: string }[] = [];
    const base = baselines[e.producao_id];
    const limite = e.tempo_meta_seg || (base?.tempo_medio_seg ? base.tempo_medio_seg * 1.3 : null);
    if (e.duracao_seg != null && limite && e.duracao_seg > limite)
      out.push({ icon: Clock, label: 'demorou', cls: 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-900/20' });
    if (e.custo_real != null && e.custo_planejado != null && e.custo_planejado > 0 && e.custo_real > e.custo_planejado * 1.1)
      out.push({ icon: DollarSign, label: 'gasto alto', cls: 'text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20' });
    if (e.aderencia_pct != null && e.aderencia_pct < 85)
      out.push({ icon: Package, label: 'insumo fora', cls: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20' });
    if (e.rendimento_real != null && e.rendimento_esperado != null && e.rendimento_esperado > 0 && e.rendimento_real < e.rendimento_esperado * 0.95)
      out.push({ icon: TrendingDown, label: 'baixo rend.', cls: 'text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20' });
    return out;
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex items-center gap-1.5 text-sm">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          <select value={semanaSel ?? ''} onChange={e => setSemanaSel(e.target.value || null)}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
            <option value="">Todas as semanas</option>
            {(planSemana?.semanas_disponiveis || []).filter((s: any) => s.tem_contagem).map((s: any) =>
              <option key={s.ini} value={s.ini}>{fmtDM(s.ini)} – {fmtDM(s.fim)}</option>)}
          </select>
        </div>
        <select value={fProd ?? ''} onChange={e => setFProd(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
          <option value="">Todas as produções</option>
          {fichas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <select value={fResp ?? ''} onChange={e => setFResp(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
          <option value="">Todos os responsáveis</option>
          {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        {(fProd || fResp || semanaSel) && <button onClick={() => { setFProd(null); setFResp(null); setSemanaSel(null); }} className="text-xs text-gray-400 underline">limpar</button>}
        <span className="text-xs text-gray-400 ml-auto">{execs.length} execuç{execs.length === 1 ? 'ão' : 'ões'}</span>
      </div>

      {/* Resumo da Semana — cruza o que foi planejado (plano encerrado) com o que foi executado */}
      {resumo && (
        <Card className="card-dark border-violet-200 dark:border-violet-900/40">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <CalendarCheck className="w-4 h-4" />Resumo da semana {fmtDM(semanaSel)} – {fmtDM(addDiasIso(semanaSel!, 6))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><ListChecks className="w-3.5 h-3.5" />Planejado × executado</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{resumo.planejadasExecutadas}<span className="text-gray-400 text-sm font-normal">/{resumo.planejadas}</span></div>
                <div className="text-[11px] text-gray-400">{resumo.executadas} execuç{resumo.executadas === 1 ? 'ão' : 'ões'} no total</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><Package className="w-3.5 h-3.5" />Aderência média</div>
                <div className={`text-lg font-bold tabular-nums ${resumo.aderMedia == null ? 'text-gray-400' : resumo.aderMedia >= 90 ? 'text-emerald-600' : resumo.aderMedia >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{fmtPct(resumo.aderMedia)}</div>
                <div className="text-[11px] text-gray-400">insumos calc. × usado</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><CheckCircle2 className="w-3.5 h-3.5" />Rend. no esperado</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{resumo.rendDentro}<span className="text-gray-400 text-sm font-normal">/{resumo.rendTotal}</span></div>
                <div className="text-[11px] text-gray-400">dentro de ±5%</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><Package className="w-3.5 h-3.5" />Desvio insumos</div>
                {(() => { const di = resumo.custoReal - resumo.custoPlan; return <div className={`text-base font-bold tabular-nums ${di > 0.005 ? 'text-red-600' : di < -0.005 ? 'text-emerald-600' : 'text-gray-900 dark:text-gray-100'}`}>{di >= 0 ? '+' : ''}{fmtBRL(di)}</div>; })()}
                <div className="text-[11px] text-gray-400">real − planejado</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><DollarSign className="w-3.5 h-3.5" />Desvio rendimento</div>
                <div className={`text-base font-bold tabular-nums ${resumo.desvioRendTotal > 0.005 ? 'text-emerald-600' : resumo.desvioRendTotal < -0.005 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{resumo.desvioRendTotal >= 0 ? '+' : ''}{fmtBRL(resumo.desvioRendTotal)}</div>
                <div className="text-[11px] text-gray-400">vs esperado</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />Tempo total</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{fmtTempo(resumo.tempoTotal)}</div>
                <div className="text-[11px] text-gray-400">soma das execuções</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Baseline da ficha filtrada */}
      {fProd && baselines[fProd] && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="text-blue-600 border-blue-300"><Clock className="w-3 h-3 mr-1" />tempo médio {baselines[fProd].tempo_medio_seg != null ? fmtTempo(baselines[fProd].tempo_medio_seg) : '—'}</Badge>
          <Badge variant="outline" className="text-emerald-600 border-emerald-300"><DollarSign className="w-3 h-3 mr-1" />custo médio {fmtBRL(baselines[fProd].custo_medio)}</Badge>
          <Badge variant="outline" className="text-amber-600 border-amber-300"><Package className="w-3 h-3 mr-1" />aderência média {fmtPct(baselines[fProd].aderencia_media)}</Badge>
        </div>
      )}

      <Card className="card-dark">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
              <th className="text-left font-medium px-3 py-2">Data</th>
              <th className="text-left font-medium px-3 py-2">Produção</th>
              <th className="text-left font-medium px-3 py-2">Responsável</th>
              <th className="text-right font-medium px-3 py-2">Tempo</th>
              <th className="text-right font-medium px-3 py-2">Custo plan./real</th>
              <th className="text-right font-medium px-3 py-2" title="Desvio de insumos = custo real − custo planejado (usaram mais/menos ingrediente do que a ficha pedia)">Desvio Insumos</th>
              <th className="text-right font-medium px-3 py-2">Aderência</th>
              <th className="text-right font-medium px-3 py-2">Rend. real/meta</th>
              <th className="text-right font-medium px-3 py-2" title="Rendimento real ÷ rendimento esperado">% Rend.</th>
              <th className="text-right font-medium px-3 py-2" title="Desvio de rendimento em R$ = (rend. real − rend. esperado) × custo por kg da produção">Desvio Rend.</th>
              <th className="text-left font-medium px-3 py-2">Alertas</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : execs.length === 0 ? <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">Nenhuma execução registrada ainda.</td></tr>
              : execs.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer" onClick={() => abrirDetalhe(e)}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{fmtData(e.criado_em)}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{e.producao_nome || `#${e.producao_id}`}<span className="block text-xs text-gray-400">{e.producao_codigo || ''}</span></td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.responsavel_nome || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.duracao_seg != null ? fmtTempo(e.duracao_seg) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(e.custo_planejado)} <span className="text-gray-400">/</span> <span className="font-medium">{fmtBRL(e.custo_real)}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {(e.custo_real == null || e.custo_planejado == null) ? <span className="text-gray-400">—</span>
                      : (() => { const d = Number(e.custo_real) - Number(e.custo_planejado); return <span className={d > 0.005 ? 'text-red-600 font-medium' : d < -0.005 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>{d >= 0 ? '+' : ''}{fmtBRL(d)}</span>; })()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={e.aderencia_pct == null ? 'text-gray-400' : e.aderencia_pct >= 90 ? 'text-emerald-600' : e.aderencia_pct >= 80 ? 'text-amber-600' : 'text-red-600'}>{fmtPct(e.aderencia_pct)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{e.rendimento_real != null ? fmtNum(e.rendimento_real, 2) : '—'} <span className="text-gray-400">/</span> {e.rendimento_esperado != null ? fmtNum(e.rendimento_esperado, 2) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(e.rendimento_real == null || e.rendimento_esperado == null || !(e.rendimento_esperado > 0)) ? <span className="text-gray-400">—</span>
                      : (() => { const p = (e.rendimento_real / e.rendimento_esperado) * 100; return <span className={p >= 95 && p <= 105 ? 'text-emerald-600' : p >= 90 ? 'text-amber-600' : 'text-red-600'}>{fmtPct(p)}</span>; })()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {(() => { const d = desvioRendReais(e); return d == null ? <span className="text-gray-400">—</span>
                      : <span className={d > 0.005 ? 'text-emerald-600 font-medium' : d < -0.005 ? 'text-red-600 font-medium' : 'text-gray-400'}>{d >= 0 ? '+' : ''}{fmtBRL(d)}</span>; })()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {flags(e).map((f, i) => {
                        const Icon = f.icon;
                        return <span key={i} className={`inline-flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 border ${f.cls}`}><Icon className="w-3 h-3" />{f.label}</span>;
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetalhe(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{detalhe.producao_nome}</h4>
                <p className="text-xs text-gray-500">{fmtData(detalhe.criado_em)} · {detalhe.responsavel_nome || '—'} · {detalhe.duracao_seg != null ? fmtTempo(detalhe.duracao_seg) : '—'}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {flags(detalhe).map((f, i) => { const Icon = f.icon; return <span key={i} className={`inline-flex items-center gap-0.5 text-[11px] rounded px-1.5 py-0.5 border ${f.cls}`}><Icon className="w-3 h-3" />{f.label}</span>; })}
              {/* FC resultante (líquido/bruto) vs esperado da ficha — só quando pesou o bruto (mestre com FC) */}
              {Number(detalhe.peso_bruto) > 0 && Number(detalhe.peso_mestre_real) > 0 && (() => {
                const fcReal = Number(detalhe.peso_mestre_real) / Number(detalhe.peso_bruto);
                const fcEsp = Number(detalhe.fc_esperado) || 0;
                const cls = fcEsp > 0 && fcReal < fcEsp - 0.02 ? 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-800' : fcEsp > 0 && fcReal > fcEsp + 0.02 ? 'text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800' : 'text-gray-600 border-gray-300 dark:text-gray-300 dark:border-gray-700';
                return <span className={`inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 border ${cls}`} title="Fator de correção resultante (líquido ÷ bruto) vs o esperado da ficha">FC real {fmtNum(fcReal, 2)}{fcEsp > 0 ? ` · esperado ${fmtNum(fcEsp, 2)}` : ''}</span>;
              })()}
              {detalhe.observacao && <span className="text-xs text-gray-500 italic">“{detalhe.observacao}”</span>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                <th className="text-left font-medium px-2 py-1.5">Insumo</th>
                <th className="text-right font-medium px-2 py-1.5" title="Peso pesado antes de limpar (mestre com fator de correção)">Bruto</th>
                <th className="text-right font-medium px-2 py-1.5">Calculado</th>
                <th className="text-right font-medium px-2 py-1.5" title="Líquido que foi pra receita">Usado</th>
                <th className="text-right font-medium px-2 py-1.5">Desvio</th>
                <th className="text-right font-medium px-2 py-1.5">Custo real</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {detInsumos.length === 0 ? <tr><td colSpan={6} className="px-2 py-4 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                : detInsumos.map(i => (
                  <tr key={i.id} className={i.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                    <td className="px-2 py-1.5">{i.is_mestre && <span className="text-amber-500 mr-1">★</span>}{i.nome || i.insumo_codigo || '—'} <span className="text-xs text-gray-400">{i.unidade || ''}</span></td>
                    {/* Bruto: só o mestre com peso bruto lançado (FC). É o que de fato saiu do estoque antes da limpeza. */}
                    <td className="px-2 py-1.5 text-right tabular-nums">{i.is_mestre && detalhe.peso_bruto != null && Number(detalhe.peso_bruto) > 0
                      ? <span className="font-medium text-gray-700 dark:text-gray-200">{fmtNum(detalhe.peso_bruto, 3)}</span>
                      : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(i.qtd_calculada, 3)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(i.qtd_real, 3)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {i.desvio_pct == null ? '—' : <span className={Math.abs(i.desvio_pct) < 0.05 ? 'text-emerald-600' : Math.abs(i.desvio_pct) < 0.15 ? 'text-amber-600' : 'text-red-600'}>{i.desvio_pct > 0 ? '+' : ''}{fmtPct(i.desvio_pct * 100)}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(i.custo_real)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================================
// MODAL — GERIR EQUIPE (responsáveis de produção). Só admin chega aqui (botão + server gate).
// =====================================================================================
function GerirEquipeModal({ barId, responsaveis, onClose, onChanged }: {
  barId: number; responsaveis: any[]; onClose: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCargo, setEditCargo] = useState('');

  const adicionar = async () => {
    const nome = novoNome.trim();
    if (!nome) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    setSalvando(true);
    const r = await api.post('/api/operacional/pessoas-responsaveis', { bar_id: barId, nome, cargo: novoCargo.trim() || null });
    setSalvando(false);
    if (r.success) { setNovoNome(''); setNovoCargo(''); onChanged(); }
    else toast({ title: 'Erro ao adicionar', description: r.error, variant: 'destructive' });
  };

  const iniciarEdicao = (p: any) => { setEditId(p.id); setEditNome(p.nome); setEditCargo(p.cargo || ''); };
  const salvarEdicao = async () => {
    const nome = editNome.trim();
    if (!nome) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    setSalvando(true);
    const r = await api.put('/api/operacional/pessoas-responsaveis', { id: editId, nome, cargo: editCargo.trim() || null });
    setSalvando(false);
    if (r.success) { setEditId(null); onChanged(); }
    else toast({ title: 'Erro ao salvar', description: r.error, variant: 'destructive' });
  };

  const desativar = async (p: any) => {
    setSalvando(true);
    const r = await api.delete(`/api/operacional/pessoas-responsaveis?id=${p.id}`);
    setSalvando(false);
    if (r.success) onChanged();
    else toast({ title: 'Erro ao remover', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Gerir equipe de produção</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>

        {/* Adicionar */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <p className="text-xs font-medium text-gray-500 mb-2">Adicionar pessoa</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-gray-400">Nome *</label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome completo"
                onKeyDown={e => { if (e.key === 'Enter') adicionar(); }} />
            </div>
            <div className="w-36">
              <label className="text-[11px] text-gray-400">Cargo</label>
              <Input value={novoCargo} onChange={e => setNovoCargo(e.target.value)} placeholder="Ex.: Cozinha"
                onKeyDown={e => { if (e.key === 'Enter') adicionar(); }} />
            </div>
            <Button onClick={adicionar} disabled={salvando} className="gap-1.5">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Adicionar
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-80 overflow-y-auto px-5 py-3">
          {responsaveis.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Nenhuma pessoa cadastrada ainda.</p>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {responsaveis.map(p => (
              <li key={p.id} className="py-2 flex items-center gap-2">
                {editId === p.id ? (
                  <>
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="flex-1 h-8" />
                    <Input value={editCargo} onChange={e => setEditCargo(e.target.value)} placeholder="Cargo" className="w-28 h-8" />
                    <Button size="sm" onClick={salvarEdicao} disabled={salvando} className="h-8">Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="h-8">Cancelar</Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900 dark:text-white">{p.nome}</span>
                      {p.cargo && <span className="text-xs text-gray-400 ml-2">{p.cargo}</span>}
                    </div>
                    <button onClick={() => iniciarEdicao(p)} title="Editar"
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => desativar(p)} disabled={salvando} title="Remover"
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// =====================================================================================
// PÁGINA
// =====================================================================================
export default function ProducoesPage() {
  const { selectedBar } = useBar();
  const { isRole } = useAuth();
  const isAdmin = isRole('admin');
  const barId = selectedBar?.id;
  const [aba, setAba] = useState<'executar' | 'historico'>('executar');
  const [fichas, setFichas] = useState<any[]>([]);
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const [gerirEquipe, setGerirEquipe] = useState(false);

  const loadFichas = useCallback(async () => {
    if (!barId) return;
    const r = await api.get(`/api/operacional/producoes?bar_id=${barId}`);
    if (r.success) setFichas(r.producoes || []);
  }, [barId]);
  const loadResponsaveis = useCallback(async () => {
    if (!barId) return;
    const r = await api.get(`/api/operacional/pessoas-responsaveis?bar_id=${barId}`);
    if (r.success) setResponsaveis(r.data || []);
  }, [barId]);
  useEffect(() => { loadFichas(); loadResponsaveis(); }, [loadFichas, loadResponsaveis]);

  return (
    <PageShell width="wide">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl"><Timer className="w-6 h-6 text-orange-600 dark:text-orange-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle da Produção</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Execução com cronômetro (várias em paralelo), aderência à ficha e controle de tempo, custo e insumos</p>
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => setGerirEquipe(true)} className="gap-1.5 shrink-0">
              <Users className="w-4 h-4" />Gerir equipe
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => setAba('executar')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'executar' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><Play className="w-4 h-4" />Executar</button>
          <button onClick={() => setAba('historico')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'historico' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><History className="w-4 h-4" />Histórico</button>
        </div>

        {aba === 'executar'
          ? <AbaExecutar fichas={fichas} responsaveis={responsaveis} />
          : <AbaHistorico fichas={fichas} responsaveis={responsaveis} />}

        {gerirEquipe && isAdmin && barId && (
          <GerirEquipeModal
            barId={barId}
            responsaveis={responsaveis}
            onClose={() => setGerirEquipe(false)}
            onChanged={loadResponsaveis}
          />
        )}
    </PageShell>
  );
}
