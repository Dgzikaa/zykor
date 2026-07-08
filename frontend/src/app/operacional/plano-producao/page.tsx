'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/PageShell';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { ChefHat, Search, Loader2, CalendarDays, Sparkles, RefreshCw, Play, Lock, Unlock, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Beer, X } from 'lucide-react';

const fmtN = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const comUni = (v: any, un?: string) => v == null ? '—' : `${fmtN(v)}${un ? ` ${un}` : ''}`; // número com unidade de medida
const fmtDM = (s: string) => s ? s.split('-').reverse().slice(0, 2).join('/') : '';
const secaoDe = (it: any) => (it.codigo || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';

// De/para Nível de Serviço → Fator de Serviço (z-score da normal), igual à planilha.
const NIVEIS = [50, 60, 70, 80, 85, 90, 95, 96, 97, 98, 99, 99.9];
const NIVEL_Z: Record<number, number> = { 50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282, 95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1 };
const zDe = (n: number) => NIVEL_Z[n] ?? 1.645;
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Ponto de Ressuprimento + Sugestão (fórmulas exatas da planilha do sócio).
function calcular(it: any) {
  const pr = it.media6 + it.desvpad * zDe(it.nivel_servico); // média já vem ponderada do servidor
  const gap = pr - it.estoque;
  const ae = gap < 0 ? gap : gap + it.media6 * ((it.semanas_receita || 1) - 1); // cada semana extra repõe a Média6s (não o PR cheio)
  const naoProduzir = ae <= 0;
  const receitas = !naoProduzir && it.rend_contagem > 0 ? Math.ceil(ae / it.rend_contagem) : 0;
  const sugestaoQtd = receitas * it.rend_contagem;
  const diasEstoque = it.media6 > 0 ? it.estoque / (it.media6 / 6) : null; // ÷6, igual à planilha
  return { pr, naoProduzir, receitas, sugestaoQtd, diasEstoque };
}

export default function PlanoProducaoPage() {
  const { selectedBar } = useBar();
  const { soLeitura } = useModuloPermissao('/operacional/plano-producao');
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('👨‍🍳 Planejamento da Produção'); return () => setPageTitle(''); }, [setPageTitle]);
  const barId = selectedBar?.id;
  const [res, setRes] = useState<any | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<'Cozinha' | 'Bar'>('Cozinha'); // planejamento separado Cozinha × Bar
  const [filtroProd, setFiltroProd] = useState<'todos' | 'produzir' | 'nao'>('todos');
  const [soSemDia, setSoSemDia] = useState(false); // toggle independente: só itens sem dia cadastrado (combina com Produzir)
  const [aberto, setAberto] = useState<number | null>(null); // linha expandida (6 semanas)
  const [semanaSel, setSemanaSel] = useState<string | null>(null); // semana escolhida (null = mais recente)
  const [salvando, setSalvando] = useState(false);
  const [diaModal, setDiaModal] = useState<any | null>(null); // produção com o modal de dias aberto
  const [modalDias, setModalDias] = useState<Record<string, string>>({}); // iso → receitas (digitado)

  const carregar = useCallback(async () => {
    if (!barId) return; setLoading(true);
    try {
      const qs = semanaSel ? `?semana=${encodeURIComponent(semanaSel)}` : '';
      const r = await api.get(`/api/operacional/plano-producao${qs}`);
      if (r.success) { setRes(r); setItens(r.itens || []); }
    } finally { setLoading(false); }
  }, [barId, semanaSel]);
  useEffect(() => { carregar(); }, [carregar]);

  const semanaAtual = semanaSel ?? res?.semana_sel ?? null; // semana em foco

  const plano = res?.planos?.[aba] || null; // sessão da aba atual (Cozinha × Bar são independentes)
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

  // iso → abreviação do dia (Seg, Ter…) da semana em foco, p/ exibir a distribuição
  const diaAbrev = useMemo(() => new Map(diasOpcoes.map((d, i) => [d.iso, DIAS_SEMANA[i]])), [diasOpcoes]);
  // distribuição por dia de um item (multi-dia); cai no dia_producao legado se não houver
  const diasDoItem = (it: any): { dia: string; receitas: number }[] => {
    if (it.dias && it.dias.length) return it.dias.map((d: any) => ({ dia: d.dia, receitas: Number(d.decidido_receitas) || 0 }));
    if (it.decisao?.dia_producao) return [{ dia: it.decisao.dia_producao, receitas: Number(it.decisao?.decidido_receitas ?? it.receitas) || 0 }];
    return [];
  };

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
      seguiu_sugestao: decididoReceitas === c.receitas, motivo_override: novaDec.motivo_override ?? null,
      dia_producao: novaDec.dia_producao ?? null,
    });
  };
  // abre o modal de dias com a distribuição atual pré-preenchida
  const abrirDias = (it: any) => {
    const atual: Record<string, string> = {};
    for (const d of diasDoItem(it)) if (d.receitas > 0) atual[d.dia] = String(d.receitas);
    setModalDias(atual);
    setDiaModal(it);
  };
  const toggleDiaModal = (iso: string, on: boolean) =>
    setModalDias(prev => { const n = { ...prev }; if (on) n[iso] = n[iso] ?? '1'; else delete n[iso]; return n; });
  const totalModal = useMemo(() => Object.values(modalDias).reduce((s, v) => s + (Number(v) || 0), 0), [modalDias]);
  // grava a distribuição por dia (action decidir_dias) — o item-pai vira o total
  const salvarDias = async () => {
    const it = diaModal;
    if (!it || !plano?.id) return;
    const c = calcular(it);
    const dias = Object.entries(modalDias).map(([dia, v]) => ({ dia, receitas: Number(v) || 0 })).filter(d => d.receitas > 0);
    setSalvando(true);
    try {
      const r = await api.post('/api/operacional/plano-producao', {
        action: 'decidir_dias', plano_id: plano.id, producao_id: it.producao_id, producao_cod: it.codigo, producao_nome: it.nome,
        media6: it.media6, desvpad: it.desvpad, nivel_servico: it.nivel_servico, ponto_ressupr: c.pr, estoque: it.estoque,
        sugestao_qtd: c.sugestaoQtd, sugestao_receitas: c.receitas, rend_contagem: it.rend_contagem, dias,
      });
      if (!r.success) { if (r.error) alert(r.error); return; }
      setDiaModal(null);
      await carregar();
    } finally { setSalvando(false); }
  };

  const acao = async (action: string, extra: any = {}) => {
    setSalvando(true);
    try { const r = await api.post('/api/operacional/plano-producao', { action, ...extra }); if (!r.success && r.error) alert(r.error); await carregar(); }
    finally { setSalvando(false); }
  };

  // Cascata de demanda dependente ("massa baseada na sugestão da porção"):
  // consumo planejado de cada preparo = Σ (receitas planejadas do pai × qtd do filho por receita).
  // Receitas do pai = o que foi decidido (senão a sugestão). Um nível por vez — recalcula
  // ao vivo conforme as decisões mudam, então a cadeia croquete→massa→carne converge na reunião.
  const consumoMap = useMemo(() => {
    const m = new Map<number, number>();
    const recById = new Map<number, number>(itens.map((it) => {
      const dec = it.decisao?.decidido_receitas;
      const base = it.frozen ? it.sugestao_receitas : calcular(it).receitas;
      return [it.producao_id, dec != null ? Number(dec) : base];
    }));
    (res?.bom || []).forEach((b: any) => {
      const rec = recById.get(b.pai) || 0;
      if (rec > 0) m.set(b.filho, (m.get(b.filho) || 0) + rec * b.qtd_receita);
    });
    return m;
  }, [itens, res]);

  // recalcula derivados + aplica filtros/ordenação
  const linhas = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return itens
      .map((it) => {
        // semana congelada (encerrada): usa os valores do snapshot, não recalcula
        const calc = it.frozen
          ? { pr: it.pr, naoProduzir: it.nao_produzir, receitas: it.sugestao_receitas, sugestaoQtd: it.sugestao_qtd, diasEstoque: it.media6 > 0 ? it.estoque / (it.media6 / 6) : null }
          : calcular(it);
        const consumo = it.frozen ? (it.consumo || 0) : (consumoMap.get(it.producao_id) || 0);
        const planejadoQtd = it.decisao?.decidido_receitas != null ? Number(it.decisao.decidido_receitas) * it.rend_contagem : calc.sugestaoQtd;
        const falta = consumo > 0 ? Math.max(0, consumo - (it.estoque + planejadoQtd)) : 0; // não cobre a produção dos pais
        return { ...it, ...calc, consumo, falta };
      })
      .filter((i) => i.controle_producao                                  // a tela só mostra o que está no Controle de Produção
        && secaoDe(i) === aba                                             // aba Cozinha × Bar
        && (filtroProd === 'todos'
          || (filtroProd === 'produzir' && !i.naoProduzir)
          || (filtroProd === 'nao' && i.naoProduzir))
        && (!soSemDia || !(i.dias?.length || i.decisao?.dia_producao))       // sem dia cadastrado (multi-dia ou legado)
        && (!s || (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)))
      .sort((a, b) => b.sugestaoQtd - a.sugestaoQtd);
  }, [itens, busca, aba, filtroProd, soSemDia, consumoMap]);

  const totProduzir = useMemo(() => linhas.filter((i) => !i.naoProduzir).length, [linhas]);
  const totReceitas = useMemo(() => linhas.reduce((s, i) => s + (emRascunho || encerrado ? Number(i.decisao?.decidido_receitas ?? i.receitas) : i.receitas), 0), [linhas, emRascunho, encerrado]);

  const contagemOk = !!res?.contagem?.data;
  const planejando = emRascunho || encerrado;
  const nCols = planejando ? 13 : 11; // colunas da tabela (com/sem Decidido+Dia)
  const semanaEhAtiva = !!semanaAtual && semanaAtual === res?.semana_ativa; // só a semana ativa é planejável; anteriores = consulta

  const cancelar = async () => {
    if (!plano?.id) return;
    if (!window.confirm(`Cancelar o planejamento de ${aba} desta semana? Tudo que foi decidido será apagado.`)) return;
    await acao('cancelar', { plano_id: plano.id });
  };

  return (
    <PageShell width="wide">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl"><ChefHat className="w-6 h-6 text-violet-600 dark:text-violet-400" /></div>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">{soLeitura && <BadgeSomenteLeitura />}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ponto de Ressuprimento = média 6 semanas + desvio padrão × fator de serviço · {selectedBar?.nome || ''}</p>
          </div>
          <button onClick={carregar} title="Atualizar estoque e sugestões" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar estoque</button>
        </div>

        {/* Status da sessão + ações */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {res?.semanas_disponiveis && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-3 py-1"><CalendarDays className="w-4 h-4" />Semana:
            <select value={semanaAtual ?? ''} onChange={e => { setSemanaSel(e.target.value); setAberto(null); }} className="bg-transparent font-semibold outline-none cursor-pointer">
              {res.semanas_disponiveis.map((s: any) => <option key={s.ini} value={s.ini} disabled={!s.tem_contagem} className="text-gray-900">{fmtDM(s.ini)} – {fmtDM(s.fim)}{s.tem_contagem ? '' : ' (aguardando contagem)'}</option>)}
            </select>
          </span>}
          {(res?.eventos || []).length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-1"><Sparkles className="w-4 h-4" />{res.eventos.map((e: any) => e.nome).join(', ')}</span>}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${contagemOk ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>{contagemOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}Contagem: {contagemOk ? fmtDM(res.contagem.data) : 'pendente'}</span>

          <div className="flex-1" />

          {!plano && (semanaEhAtiva
            ? <button disabled={!contagemOk || salvando} onClick={() => acao('iniciar', { area: aba, semana: semanaAtual })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"><Play className="w-4 h-4" />Iniciar planejamento ({aba})</button>
            : <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 px-3 py-1">Semana anterior — só consulta</span>)}
          {emRascunho && <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1">{aba} em planejamento (rascunho){!semanaEhAtiva && ' — semana anterior'}</span>
            {semanaEhAtiva && <button disabled={salvando} onClick={() => acao('encerrar', { plano_id: plano.id })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"><Lock className="w-4 h-4" />Encerrar e calendarizar</button>}
            <button disabled={salvando} onClick={cancelar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"><X className="w-4 h-4" />Cancelar planejamento</button>
          </>}
          {encerrado && <><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-1"><CheckCircle2 className="w-4 h-4" />Encerrado — foi pro Controle de Produção</span>{semanaEhAtiva && <button disabled={salvando} onClick={() => acao('reabrir', { plano_id: plano.id })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><Unlock className="w-4 h-4" />Reabrir</button>}</>}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Produções a fazer</div><div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{totProduzir}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">{planejando ? 'Receitas decididas' : 'Receitas sugeridas'}</div><div className="text-2xl font-bold">{totReceitas}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Itens no plano</div><div className="text-2xl font-bold">{linhas.length}</div></CardContent></Card>
        </div>

        {/* Abas Cozinha × Bar */}
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
          {(['Cozinha', 'Bar'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a ? 'border-violet-600 text-violet-700 dark:text-violet-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {a === 'Cozinha' ? <ChefHat className="w-4 h-4" /> : <Beer className="w-4 h-4" />}{a}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produção…" className="pl-9" /></div>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
            {([['todos', 'Todos'], ['produzir', 'Produzir'], ['nao', 'Não produzir']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setFiltroProd(v)} className={`px-3 py-1.5 ${filtroProd === v ? 'bg-violet-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{label}</button>
            ))}
          </div>
          <button onClick={() => setSoSemDia(v => !v)} title="Combina com o filtro ao lado (ex.: Produzir + Sem dia)" className={`text-xs rounded-lg border px-3 py-1.5 ${soSemDia ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Sem dia</button>
        </div>

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-2 py-2">Produção</th>
              <th className="text-right font-medium px-2 py-2" title="Uso indireto da última semana (clique p/ abrir as 6 semanas)">Uso Indireto</th>
              <th className="text-right font-medium px-2 py-2" title="Média ponderada do uso indireto das últimas 6 semanas — peso maior para a semana mais recente; semana em branco fica fora. Clique no valor para ver as semanas.">Média 6s</th>
              <th className="text-right font-medium px-2 py-2" title="Desvio padrão amostral das 6 semanas">Desv. padrão</th>
              <th className="text-center font-medium px-2 py-2" title="Define o fator de segurança do Ponto de Ressuprimento">Nível de Serviço</th>
              <th className="text-center font-medium px-2 py-2" title="Quantas semanas de receita produzir de uma vez">Qtde x Semanas</th>
              <th className="text-right font-medium px-2 py-2" title="Ponto de Ressuprimento = média + desvio × fator de serviço">PR</th>
              <th className="text-right font-medium px-2 py-2" title="Última contagem (início da semana planejada)">Estoque Atual</th>
              <th className="text-right font-medium px-2 py-2" title="Estoque ÷ ritmo diário (÷6)">Dias de Estoque</th>
              <th className="text-right font-medium px-2 py-2" title="Aviso (não muda a sugestão): quanto deste preparo a produção planejada dos pais vai consumir">Qtde p/ pais</th>
              <th className="text-right font-medium px-2 py-2">Sugestão</th>
              {planejando && <th className="text-right font-medium px-2 py-2" title="O que foi decidido na reunião (receitas)">Decidido</th>}
              {planejando && <th className="text-center font-medium px-2 py-2">Dia</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={nCols} className="px-3 py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : linhas.length === 0 ? <tr><td colSpan={nCols} className="px-3 py-12 text-center text-gray-400">Sem produções no filtro.</td></tr>
              : linhas.map((it) => {
                const decidido = it.decisao?.decidido_receitas;
                const override = decidido != null && Number(decidido) !== it.receitas;
                const ultima = it.saidas?.length ? it.saidas[it.saidas.length - 1] : null;
                const expandido = aberto === it.producao_id;
                return (
                <Fragment key={it.producao_id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-2 py-2 text-gray-900 dark:text-gray-100 max-w-[180px]">
                    <span className="inline-flex items-start gap-1.5 leading-tight">
                      <button onClick={() => toggleFlag(it)} title={it.controle_producao ? 'Sai do controle de produção' : 'Entra no controle de produção'} className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${it.controle_producao ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      {it.nome}{it.curva_a && <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-300">A</Badge>}
                    </span>
                    {it.codigo && <span className="block text-[11px] text-gray-500 dark:text-gray-400 font-mono pl-4">{it.codigo}</span>}
                    <span className="block text-[11px] text-gray-400 pl-4">rende {comUni(it.rend_contagem, it.unidade)}/receita</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{comUni(ultima, it.unidade)}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    <button onClick={() => setAberto(expandido ? null : it.producao_id)} className="inline-flex items-center gap-1 hover:text-violet-600 dark:hover:text-violet-400" title="Ver as 6 semanas que formam a média">
                      {expandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}{comUni(it.media6, it.unidade)}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-500">{fmtN(it.desvpad)}</td>
                  <td className="px-2 py-2 text-center">
                    <select disabled={encerrado} value={it.nivel_servico} onChange={e => salvarConfig(it, 'nivel_servico', Number(e.target.value))} className="bg-transparent text-xs outline-none cursor-pointer disabled:cursor-default rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 px-1">
                      {NIVEIS.map(n => <option key={n} value={n} className="text-gray-900">{n}%</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input disabled={encerrado} type="number" min={0} step={0.5} value={it.semanas_receita}
                      onChange={e => patchItem(it.producao_id, { semanas_receita: Number(e.target.value) })}
                      onBlur={e => salvarConfig(it, 'semanas_receita', Number(e.target.value))}
                      className="w-12 bg-transparent text-xs text-center outline-none rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 disabled:hover:border-transparent" />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap">{comUni(it.pr, it.unidade)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-500 whitespace-nowrap">{comUni(it.estoque, it.unidade)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${(it.diasEstoque ?? 99) < 3 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500'}`}>{it.diasEstoque == null ? '—' : `${fmtN(it.diasEstoque)}d`}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {it.consumo > 0
                      ? <span className={it.falta > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500'} title={it.falta > 0 ? `Faltam ${comUni(it.falta, it.unidade)} p/ cobrir a produção planejada dos pais` : 'Coberto pelo estoque + plano'}>{comUni(it.consumo, it.unidade)}{it.falta > 0 ? ' ⚠' : ''}</span>
                      : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {it.naoProduzir
                      ? <span className="text-emerald-600 dark:text-emerald-400 text-xs">Não produzir</span>
                      : <span className="inline-flex flex-col items-end"><span className="font-bold text-violet-700 dark:text-violet-300 tabular-nums">{it.receitas} rec.</span><span className="text-[10px] text-gray-400 whitespace-nowrap">≈ {comUni(it.sugestaoQtd, it.unidade)}</span></span>}
                  </td>
                  {planejando && <td className="px-2 py-2 text-right">
                    <input disabled={encerrado || (it.dias?.length > 0)} type="number" min={0} step={1}
                      value={decidido ?? (it.naoProduzir ? 0 : it.receitas)}
                      onChange={e => patchItem(it.producao_id, { decisao: { ...(it.decisao || {}), decidido_receitas: e.target.value === '' ? null : Number(e.target.value) } })}
                      onBlur={e => salvarDecisao(it, { decidido_receitas: e.target.value === '' ? null : Number(e.target.value) })}
                      title={it.dias?.length > 0 ? 'Total definido pela distribuição por dia (edite nos Dias)' : (override ? 'Diferente da sugestão (override registrado)' : '')}
                      className={`w-16 bg-transparent text-right tabular-nums outline-none rounded border px-1 disabled:opacity-60 disabled:cursor-default ${override ? 'border-amber-400 text-amber-600 dark:text-amber-400 font-medium' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`} />
                    {override && <input disabled={encerrado} type="text" placeholder="motivo do override…"
                      value={it.decisao?.motivo_override ?? ''}
                      onChange={e => patchItem(it.producao_id, { decisao: { ...(it.decisao || {}), motivo_override: e.target.value } })}
                      onBlur={e => salvarDecisao(it, { motivo_override: e.target.value || null })}
                      className="block mt-1 w-32 ml-auto bg-transparent text-[11px] text-right outline-none rounded border border-amber-300 dark:border-amber-700/60 px-1 py-0.5 placeholder:text-amber-400/60" />}
                  </td>}
                  {planejando && <td className="px-2 py-2 text-center">
                    {(() => {
                      const dd = diasDoItem(it);
                      const resumo = dd.map(d => `${diaAbrev.get(d.dia) || fmtDM(d.dia)} ${d.receitas}`).join(' · ');
                      return (
                        <button disabled={encerrado} onClick={() => abrirDias(it)} title={resumo ? `Dias de produção: ${resumo} · clique p/ editar` : 'Marcar em quais dias produzir (pode ser vários, com qtd por dia)'}
                          className={`text-xs rounded border px-2 py-1 whitespace-nowrap disabled:cursor-default ${dd.length ? 'border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-violet-50/60 dark:bg-violet-900/15' : 'border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-violet-400 hover:text-violet-500'}`}>
                          {dd.length === 0 ? '+ dias' : dd.length === 1 ? resumo : <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{dd.length} dias</span>}
                        </button>
                      );
                    })()}
                  </td>}
                </tr>
                {expandido && <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                  <td colSpan={nCols} className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 pl-4">
                      <span className="font-medium text-gray-600 dark:text-gray-300">Semanas que formam a média (ponderada por recência):</span>
                      {(it.semanas || []).map((wk: string, i: number) => {
                        const v = it.saidas?.[i] ?? 0;
                        return <span key={wk} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${v > 0 ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through'}`} title={v > 0 ? `peso ${i + 1}` : 'Semana em branco — desconsiderada na média'}>{fmtDM(wk)}: <b>{comUni(v, it.unidade)}</b> <span className="opacity-60">×{i + 1}</span></span>;
                      })}
                      <span className="text-gray-600 dark:text-gray-300">= média <b>{comUni(it.media6, it.unidade)}</b></span>
                    </div>
                  </td>
                </tr>}
                </Fragment>
              );})}
            </tbody>
          </table>
        </div></CardContent></Card>
        <p className="text-[11px] text-gray-400">Saída = uso indireto (vendas explodidas pela ficha técnica, inclusive preparo-dentro-de-preparo); recalcula com a ficha atual nas 6 semanas. O ponto azul liga/desliga a produção no Controle de Produção. Ao <b>encerrar</b>, os itens com dia definido viram a calendarização que aparece na tela Executar do dia.</p>

        {/* Modal: distribuir a produção em vários dias (qtd por dia) */}
        {diaModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDiaModal(null); }}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-violet-500" />Dias de produção</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{diaModal.nome} · sugestão <b className="text-violet-600 dark:text-violet-300">{diaModal.receitas} rec.</b></p>
                </div>
                <button onClick={() => setDiaModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-1.5 max-h-[50vh] overflow-y-auto">
                <p className="text-[11px] text-gray-400 mb-2">Marque os dias e informe quantas <b>receitas</b> em cada um (ex.: pastel Seg 2 · Ter 3). O total da semana é a soma dos dias.</p>
                {diasOpcoes.map(d => {
                  const on = d.iso in modalDias;
                  return (
                    <div key={d.iso} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${on ? 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/15' : 'border-gray-200 dark:border-gray-700'}`}>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input type="checkbox" checked={on} onChange={e => toggleDiaModal(d.iso, e.target.checked)} className="w-4 h-4 accent-violet-600" />
                        <span className={`text-sm ${on ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500'}`}>{d.label}</span>
                      </label>
                      <input type="number" min={0} step={1} inputMode="numeric" disabled={!on}
                        value={modalDias[d.iso] ?? ''} onChange={e => setModalDias(prev => ({ ...prev, [d.iso]: e.target.value }))}
                        placeholder="0" className="w-20 h-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-right tabular-nums text-sm text-gray-900 dark:text-gray-100 disabled:opacity-40" />
                      <span className="text-[11px] text-gray-400 w-8">rec</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-800">
                <div className="text-sm">
                  <span className="text-gray-500">Total: </span>
                  <b className={`tabular-nums ${totalModal === diaModal.receitas ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-700 dark:text-violet-300'}`}>{totalModal} rec.</b>
                  {diaModal.rend_contagem > 0 && <span className="text-gray-400"> ≈ {comUni(totalModal * diaModal.rend_contagem, diaModal.unidade)}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDiaModal(null)} className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
                  <button onClick={salvarDias} disabled={salvando} className="text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 disabled:opacity-50 inline-flex items-center gap-1.5">{salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Salvar</button>
                </div>
              </div>
            </div>
          </div>
        )}
    </PageShell>
  );
}
