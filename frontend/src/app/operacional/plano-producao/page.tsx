'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { ChefHat, Search, Loader2, CalendarDays, Sparkles, RefreshCw, Play, Lock, Unlock, CheckCircle2, AlertTriangle } from 'lucide-react';

const fmtN = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtDM = (s: string) => s ? s.split('-').reverse().slice(0, 2).join('/') : '';

// De/para Nível de Serviço → Fator de Serviço (z-score da normal), igual à planilha.
const NIVEIS = [50, 60, 70, 80, 85, 90, 95, 96, 97, 98, 99, 99.9];
const NIVEL_Z: Record<number, number> = { 50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282, 95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1 };
const zDe = (n: number) => NIVEL_Z[n] ?? 1.645;
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Ponto de Ressuprimento + Sugestão (mesma regra do servidor).
function calcular(it: any) {
  const pr = it.media6 + it.desvpad * zDe(it.nivel_servico);
  const gap = Math.max(0, pr - it.estoque);
  const naoProduzir = gap <= 0;
  const receitas = !naoProduzir && it.rend_contagem > 0 ? Math.ceil((gap / it.rend_contagem) * (it.semanas_receita || 1)) : 0;
  const sugestaoQtd = receitas * it.rend_contagem;
  const diasEstoque = it.media6 > 0 ? it.estoque / (it.media6 / 6) : null; // ÷6, igual à planilha
  return { pr, naoProduzir, receitas, sugestaoQtd, diasEstoque };
}

export default function PlanoProducaoPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [res, setRes] = useState<any | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [soControle, setSoControle] = useState(true);
  const [soFazer, setSoFazer] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!barId) return; setLoading(true);
    try { const r = await api.get('/api/operacional/plano-producao'); if (r.success) { setRes(r); setItens(r.itens || []); } }
    finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { carregar(); }, [carregar]);

  const plano = res?.plano || null;
  const emRascunho = plano?.status === 'rascunho';
  const encerrado = plano?.status === 'encerrado';

  // dias da próxima semana p/ a calendarização (value = ISO, label = "Ter 01/07")
  const diasOpcoes = useMemo(() => {
    if (!res?.semana?.ini) return [];
    const [y, m, d] = res.semana.ini.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(Date.UTC(y, m - 1, d + i));
      const iso = dt.toISOString().slice(0, 10);
      return { iso, label: `${DIAS_SEMANA[i]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}` };
    });
  }, [res]);

  const patchItem = (id: number, patch: any) => setItens((prev) => prev.map((i) => i.producao_id === id ? { ...i, ...patch } : i));

  // ---- salvamentos ----
  const salvarConfig = async (it: any, campo: 'nivel_servico' | 'semanas_receita', valor: number) => {
    patchItem(it.producao_id, { [campo]: valor });
    await api.post('/api/operacional/plano-producao', { action: 'config', producao_id: it.producao_id, producao_cod: it.codigo, [campo]: valor });
  };
  const toggleFlag = async (it: any) => {
    const novo = !it.controle_producao;
    patchItem(it.producao_id, { controle_producao: novo });
    await api.post('/api/operacional/plano-producao', { action: 'flag', producao_id: it.producao_id, controle_producao: novo });
  };
  const salvarDecisao = async (it: any, patch: any) => {
    const novaDec = { ...(it.decisao || {}), ...patch };
    patchItem(it.producao_id, { decisao: novaDec });
    if (!plano?.id) return;
    const c = calcular(it);
    const decididoReceitas = novaDec.decidido_receitas != null ? Number(novaDec.decidido_receitas) : c.receitas;
    await api.post('/api/operacional/plano-producao', {
      action: 'decidir', plano_id: plano.id, producao_id: it.producao_id, producao_cod: it.codigo, producao_nome: it.nome,
      media6: it.media6, desvpad: it.desvpad, nivel_servico: it.nivel_servico, ponto_ressupr: c.pr, estoque: it.estoque,
      sugestao_qtd: c.sugestaoQtd, sugestao_receitas: c.receitas,
      decidido_receitas: decididoReceitas, decidido_qtd: decididoReceitas * it.rend_contagem,
      seguiu_sugestao: decididoReceitas === c.receitas, dia_producao: novaDec.dia_producao ?? null,
    });
  };
  const acao = async (action: string, extra: any = {}) => {
    setSalvando(true);
    try { const r = await api.post('/api/operacional/plano-producao', { action, ...extra }); if (!r.success && r.error) alert(r.error); await carregar(); }
    finally { setSalvando(false); }
  };

  // recalcula derivados + aplica filtros/ordenação
  const linhas = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return itens
      .map((it) => ({ ...it, ...calcular(it) }))
      .filter((i) => (!soControle || i.controle_producao)
        && (!soFazer || !i.naoProduzir)
        && (!s || (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)))
      .sort((a, b) => b.sugestaoQtd - a.sugestaoQtd);
  }, [itens, busca, soControle, soFazer]);

  const totProduzir = useMemo(() => linhas.filter((i) => !i.naoProduzir).length, [linhas]);
  const totReceitas = useMemo(() => linhas.reduce((s, i) => s + (emRascunho || encerrado ? Number(i.decisao?.decidido_receitas ?? i.receitas) : i.receitas), 0), [linhas, emRascunho, encerrado]);

  const contagemOk = !!res?.contagem?.data;
  const planejando = emRascunho || encerrado;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl"><ChefHat className="w-6 h-6 text-violet-600 dark:text-violet-400" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planejamento da Produção</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ponto de Ressuprimento = média 6 semanas + desvio padrão × fator de serviço · {selectedBar?.nome || ''}</p>
          </div>
          <button onClick={carregar} title="Atualizar estoque e sugestões" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar estoque</button>
        </div>

        {/* Status da sessão + ações */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {res?.semana && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-3 py-1"><CalendarDays className="w-4 h-4" />Semana <b>{fmtDM(res.semana.ini)} – {fmtDM(res.semana.fim)}</b></span>}
          {(res?.eventos || []).length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-1"><Sparkles className="w-4 h-4" />{res.eventos.map((e: any) => e.nome).join(', ')}</span>}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${contagemOk ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>{contagemOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}Contagem: {contagemOk ? fmtDM(res.contagem.data) : 'pendente'}</span>

          <div className="flex-1" />

          {!plano && <button disabled={!contagemOk || salvando} onClick={() => acao('iniciar')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"><Play className="w-4 h-4" />Iniciar planejamento</button>}
          {emRascunho && <><span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1">Em planejamento (rascunho)</span><button disabled={salvando} onClick={() => acao('encerrar', { plano_id: plano.id })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"><Lock className="w-4 h-4" />Encerrar e calendarizar</button></>}
          {encerrado && <><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-1"><CheckCircle2 className="w-4 h-4" />Encerrado — foi pro Controle de Produção</span><button disabled={salvando} onClick={() => acao('reabrir', { plano_id: plano.id })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><Unlock className="w-4 h-4" />Reabrir</button></>}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Produções a fazer</div><div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{totProduzir}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">{planejando ? 'Receitas decididas' : 'Receitas sugeridas'}</div><div className="text-2xl font-bold">{totReceitas}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Itens no plano</div><div className="text-2xl font-bold">{linhas.length}</div></CardContent></Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produção…" className="pl-9" /></div>
          <button onClick={() => setSoControle(v => !v)}><Badge variant="outline" className={`cursor-pointer ${soControle ? 'ring-1 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700' : ''}`}>Só controle de produção</Badge></button>
          <button onClick={() => setSoFazer(v => !v)}><Badge variant="outline" className={`cursor-pointer ${soFazer ? 'ring-1 ring-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700' : ''}`}>Só o que produzir</Badge></button>
        </div>

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Produção</th>
              <th className="text-right font-medium px-3 py-2" title="Média semanal do uso indireto das últimas 6 semanas">Média 6s</th>
              <th className="text-right font-medium px-3 py-2" title="Desvio padrão amostral das 6 semanas">Desv.</th>
              <th className="text-center font-medium px-3 py-2" title="Nível de serviço (define o fator de segurança)">Nível</th>
              <th className="text-center font-medium px-3 py-2" title="Semanas de receita: produz pra cobrir N semanas de uma vez">Sem.</th>
              <th className="text-right font-medium px-3 py-2" title="Ponto de Ressuprimento = média + desvio × fator de serviço">PR</th>
              <th className="text-right font-medium px-3 py-2">Estoque</th>
              <th className="text-right font-medium px-3 py-2" title="Estoque ÷ ritmo diário (÷6)">Dias</th>
              <th className="text-right font-medium px-3 py-2">Sugestão</th>
              {planejando && <th className="text-right font-medium px-3 py-2" title="O que foi decidido na reunião (receitas)">Decidido</th>}
              {planejando && <th className="text-center font-medium px-3 py-2">Dia</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={11} className="px-3 py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : linhas.length === 0 ? <tr><td colSpan={11} className="px-3 py-12 text-center text-gray-400">Sem produções no filtro.</td></tr>
              : linhas.map((it) => {
                const decidido = it.decisao?.decidido_receitas;
                const override = decidido != null && Number(decidido) !== it.receitas;
                return (
                <tr key={it.producao_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    <span className="inline-flex items-center gap-1.5">
                      <button onClick={() => toggleFlag(it)} title={it.controle_producao ? 'Sai do controle de produção' : 'Entra no controle de produção'} className={`w-2.5 h-2.5 rounded-full ${it.controle_producao ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      {it.nome}{it.curva_a && <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-300">A</Badge>}
                    </span>
                    <span className="block text-[11px] text-gray-400 pl-4">rende {fmtN(it.rend_contagem)} {it.unidade || ''}/receita</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtN(it.media6)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtN(it.desvpad)}</td>
                  <td className="px-3 py-2 text-center">
                    <select disabled={encerrado} value={it.nivel_servico} onChange={e => salvarConfig(it, 'nivel_servico', Number(e.target.value))} className="bg-transparent text-xs outline-none cursor-pointer disabled:cursor-default rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 px-1">
                      {NIVEIS.map(n => <option key={n} value={n} className="text-gray-900">{n}%</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input disabled={encerrado} type="number" min={0} step={0.5} value={it.semanas_receita}
                      onChange={e => patchItem(it.producao_id, { semanas_receita: Number(e.target.value) })}
                      onBlur={e => salvarConfig(it, 'semanas_receita', Number(e.target.value))}
                      className="w-12 bg-transparent text-xs text-center outline-none rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 disabled:hover:border-transparent" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200 font-medium">{fmtN(it.pr)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtN(it.estoque)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${(it.diasEstoque ?? 99) < 3 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500'}`}>{it.diasEstoque == null ? '—' : `${fmtN(it.diasEstoque)}d`}</td>
                  <td className="px-3 py-2 text-right">
                    {it.naoProduzir
                      ? <span className="text-emerald-600 dark:text-emerald-400 text-xs">Não produzir</span>
                      : <span className="inline-flex flex-col items-end"><span className="font-bold text-violet-700 dark:text-violet-300 tabular-nums">{it.receitas} rec.</span><span className="text-[10px] text-gray-400">≈ {fmtN(it.sugestaoQtd)} {it.unidade || ''}</span></span>}
                  </td>
                  {planejando && <td className="px-3 py-2 text-right">
                    <input disabled={encerrado} type="number" min={0} step={1}
                      value={decidido ?? (it.naoProduzir ? 0 : it.receitas)}
                      onChange={e => patchItem(it.producao_id, { decisao: { ...(it.decisao || {}), decidido_receitas: e.target.value === '' ? null : Number(e.target.value) } })}
                      onBlur={e => salvarDecisao(it, { decidido_receitas: e.target.value === '' ? null : Number(e.target.value) })}
                      className={`w-16 bg-transparent text-right tabular-nums outline-none rounded border px-1 ${override ? 'border-amber-400 text-amber-600 dark:text-amber-400 font-medium' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`} title={override ? 'Diferente da sugestão (override registrado)' : ''} />
                  </td>}
                  {planejando && <td className="px-3 py-2 text-center">
                    <select disabled={encerrado} value={it.decisao?.dia_producao ?? ''} onChange={e => salvarDecisao(it, { dia_producao: e.target.value || null })} className="bg-transparent text-xs outline-none cursor-pointer disabled:cursor-default rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 px-1">
                      <option value="" className="text-gray-900">—</option>
                      {diasOpcoes.map(d => <option key={d.iso} value={d.iso} className="text-gray-900">{d.label}</option>)}
                    </select>
                  </td>}
                </tr>
              );})}
            </tbody>
          </table>
        </div></CardContent></Card>
        <p className="text-[11px] text-gray-400">Saída = uso indireto (vendas explodidas pela ficha técnica, inclusive preparo-dentro-de-preparo); recalcula com a ficha atual nas 6 semanas. O ponto azul liga/desliga a produção no Controle de Produção. Ao <b>encerrar</b>, os itens com dia definido viram a calendarização que aparece na tela Executar do dia.</p>
      </div>
    </div>
  );
}
