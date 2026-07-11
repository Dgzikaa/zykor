'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import {
  Play, Pause, RotateCcw, Save, Search, Plus, Trash2, User,
  Loader2, History, Clock, X, AlertTriangle, CalendarCheck, CheckCircle2,
  ListChecks, Users, UtensilsCrossed,
} from 'lucide-react';
import {
  addDiasIso, fmtDM, fmtBRL, fmtPeso, fmtTempo, getDeviceId, pf,
} from './_shared';

const TIPOS_REFEICAO = [
  { v: 'janta', label: 'Janta' },
  { v: 'almoco', label: 'Almoço' },
  { v: 'ceia', label: 'Ceia' },
] as const;
const tipoLabel = (v: string) => TIPOS_REFEICAO.find(t => t.v === v)?.label ?? v;

// unidade de ENTRADA da quantidade do insumo (o preço é por unidade-base g/ml/un):
// g→kg, ml→L (mais natural pra cozinha pesar), un→un. fator = p/ voltar à base.
function entradaInsumo(base: string | null): { unidade: string; fator: number } {
  if (base === 'g') return { unidade: 'kg', fator: 1000 };
  if (base === 'ml') return { unidade: 'L', fator: 1000 };
  return { unidade: 'un', fator: 1 };
}

// item selecionado na refeição (linha do modal)
interface RefeicaoItem {
  codigo: string;
  nome: string;
  base: string | null;   // g | ml | un
  precoUn: number;       // R$ por unidade-base (preco ÷ embalagem)
  qtd: string;           // digitado na unidade de entrada (kg/L/un)
}

export function AbaAlimentacao({ responsaveis, podeExcluir }: { responsaveis: any[]; podeExcluir: boolean }) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const hojeIso = new Date().toISOString().slice(0, 10);

  // catálogo de insumos (mesma fonte do cadastro: silver.insumo_catalogo via /operacional/insumos)
  const [catalogo, setCatalogo] = useState<{ codigo: string; nome: string; base: string | null; precoUn: number }[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  useEffect(() => {
    if (!barId) return;
    setLoadingCat(true);
    api.get(`/api/operacional/insumos?bar_id=${barId}`)
      .then(r => {
        if (!r?.success) return;
        const list = (r.insumos || [])
          .filter((i: any) => i.codigo)
          .map((i: any) => {
            const emb = Number(i.embalagem) > 0 ? Number(i.embalagem) : 1;
            const preco = i.preco_atual != null ? Number(i.preco_atual) : null;
            return { codigo: i.codigo, nome: i.nome, base: i.base ?? null, precoUn: (preco != null ? preco / emb : 0) };
          });
        setCatalogo(list);
      })
      .finally(() => setLoadingCat(false));
  }, [barId]);

  // refeição em montagem (null = nenhuma aberta). Painel inline na página (não é modal).
  // O cronômetro NÃO começa ao abrir: a pessoa preenche/seleciona insumos e só clica
  // "Iniciar" quando começa a fazer de fato — igual ao fluxo da execução de produção.
  // Cronômetro por âncora de relógio (igual à aba Executar): `segundos` = bancado, `rodandoDesde`
  // = epoch ms do segmento atual. `idempotencyKey` = chave estável do rascunho no servidor.
  const [sessao, setSessao] = useState<null | {
    segundos: number; rodando: boolean; rodandoDesde?: number | null; idempotencyKey: string;
    responsavelId: number | null; data: string; tipo: string; numPessoas: string;
    observacao: string; itens: RefeicaoItem[];
  }>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [picker, setPicker] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [saveInfo, setSaveInfo] = useState<{ status: 'salvando' | 'salvo' | 'offline'; at: number } | null>(null);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [resumivel, setResumivel] = useState<any | null>(null); // refeição em andamento de outro aparelho
  const [deviceId] = useState(getDeviceId);
  const sessaoRef = useRef(sessao); sessaoRef.current = sessao;
  const lastLocalRef = useRef(''); const lastServerRef = useRef(''); const persistErroRef = useRef(false);

  const elapsedOf = (s: { segundos: number; rodando: boolean; rodandoDesde?: number | null } | null, now = Date.now()) =>
    s ? Math.max(0, Math.round((Number(s.segundos) || 0) + (s.rodando && s.rodandoDesde ? (now - s.rodandoDesde) / 1000 : 0))) : 0;

  // tick de 1s só enquanto rodando → cronômetro "anda" sem acumular drift
  useEffect(() => {
    if (!sessao?.rodando) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sessao?.rodando]);

  const patch = (p: Partial<NonNullable<typeof sessao>>) => setSessao(s => s ? { ...s, ...p } : s);

  // ---- Persistência (autosave) da refeição em montagem: mesma blindagem da produção ----
  const writeLocal = useCallback(() => {
    if (!barId) return;
    const cur = sessaoRef.current;
    const sig = cur ? JSON.stringify(cur) : '';
    if (sig === lastLocalRef.current) return;
    lastLocalRef.current = sig;
    try {
      const key = `zykor:alimentacao:ativa:${barId}`;
      if (cur) localStorage.setItem(key, JSON.stringify({ _ts: Date.now(), sessao: cur }));
      else localStorage.removeItem(key);
      persistErroRef.current = false;
    } catch {
      if (!persistErroRef.current) { persistErroRef.current = true; toast({ title: 'Armazenamento local cheio', description: 'A refeição está sendo salva no servidor. Finalize pra liberar espaço.', variant: 'destructive' }); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId]);

  const writeServer = useCallback(async () => {
    if (!barId) return;
    const cur = sessaoRef.current;
    const sig = cur ? JSON.stringify(cur) : '';
    if (sig === lastServerRef.current) return;
    lastServerRef.current = sig;
    if (!cur || !cur.idempotencyKey) return;
    const rascunhos = [{
      idempotencia_key: cur.idempotencyKey, secao: null, producao_id: null,
      responsavel_id: cur.responsavelId ?? null, rodando: !!cur.rodando,
      duracao_seg: elapsedOf(cur, Date.now()), estado: cur,
    }];
    setSaveInfo({ status: 'salvando', at: Date.now() });
    try {
      const r = await api.put('/api/operacional/producoes/execucao/rascunho', { bar_id: barId, device_id: deviceId, kind: 'alimentacao', rascunhos });
      if (r?.success === false) throw new Error(r?.error || 'falha');
      setSaveInfo({ status: 'salvo', at: Date.now() });
    } catch { lastServerRef.current = ''; setSaveInfo({ status: 'offline', at: Date.now() }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId, deviceId]);

  const apagarRascunho = useCallback((key?: string) => {
    lastServerRef.current = '';
    if (key && barId) api.delete(`/api/operacional/producoes/execucao/rascunho?bar_id=${barId}&key=${encodeURIComponent(key)}`).catch(() => {});
  }, [barId]);

  const aplicarSessao = useCallback((est: any, fromServer = false): boolean => {
    if (!est || typeof est !== 'object' || !est.idempotencyKey) return false;
    const s = { ...est, segundos: Number(est.segundos) || 0, rodandoDesde: est.rodando ? (Number(est.rodandoDesde) || Date.now()) : null };
    setSessao(s);
    // só suprime o echo do servidor quando o dado veio do servidor deste device (ver aplicarEstados)
    if (fromServer) lastServerRef.current = JSON.stringify(s);
    return true;
  }, []);

  // hidratação: servidor deste device → cache local → "retomar por bar" (outro aparelho)
  useEffect(() => {
    if (!barId) return;
    let cancel = false;
    (async () => {
      if (sessaoRef.current) return; // não clobbera refeição já aberta
      let applied = false;
      try {
        const r = await api.get(`/api/operacional/producoes/execucao/rascunho?bar_id=${barId}&device_id=${encodeURIComponent(deviceId)}&kind=alimentacao`);
        const est = r?.success && Array.isArray(r.rascunhos) && r.rascunhos.length ? r.rascunhos[r.rascunhos.length - 1].estado : null;
        if (!cancel && !sessaoRef.current && est) applied = aplicarSessao(est, true);
      } catch { /* offline */ }
      if (cancel || applied || sessaoRef.current) return;
      try {
        const raw = localStorage.getItem(`zykor:alimentacao:ativa:${barId}`);
        if (raw) { const saved = JSON.parse(raw); applied = aplicarSessao(saved?.sessao); }
      } catch { /* ignore */ }
      if (cancel || applied || sessaoRef.current) return;
      try {
        const r = await api.get(`/api/operacional/producoes/execucao/rascunho?bar_id=${barId}&kind=alimentacao`);
        const est = r?.success && Array.isArray(r.rascunhos) && r.rascunhos.length ? r.rascunhos[r.rascunhos.length - 1].estado : null;
        if (!cancel && est && est.idempotencyKey) setResumivel(est);
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId, deviceId]);

  // gravação periódica + flush ao sair/backgroundear
  useEffect(() => {
    if (!barId) return;
    const localT = setInterval(writeLocal, 1000);
    const serverT = setInterval(() => { void writeServer(); }, 10000);
    const flush = () => { writeLocal(); void writeServer(); };
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(localT); clearInterval(serverT); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVis); flush(); };
  }, [barId, writeLocal, writeServer]);

  // save imediato (1,5s) em mudança estrutural (iniciar/pausar/responsável)
  const structSig = sessao ? `${sessao.idempotencyKey}:${sessao.rodando ? 1 : 0}:${sessao.rodandoDesde ?? ''}:${sessao.responsavelId ?? ''}` : '';
  useEffect(() => {
    if (!barId || !sessao) return;
    const t = setTimeout(() => { writeLocal(); void writeServer(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structSig, barId]);

  const retomarDoBar = () => { if (resumivel && aplicarSessao(resumivel)) setResumivel(null); };
  const descartarRefeicao = () => {
    const key = sessaoRef.current?.idempotencyKey;
    setSessao(null); setConfirmarDescartar(false);
    apagarRascunho(key);
  };
  // descartar só pede confirmação se já tem trabalho lançado (evita perda por toque acidental)
  const temProgressoRefeicao = () => !!sessao && (elapsedOf(sessao) > 0 || !!sessao.responsavelId || sessao.itens.length > 0 || !!sessao.observacao.trim() || !!sessao.numPessoas);
  const pedirDescartarRefeicao = () => temProgressoRefeicao() ? setConfirmarDescartar(true) : descartarRefeicao();

  // abre o painel (sem começar o cronômetro)
  const novaRefeicao = () => {
    setSessao({
      segundos: 0, rodando: false, rodandoDesde: null,
      idempotencyKey: (globalThis.crypto?.randomUUID?.() ?? `alim-${deviceId}-${Date.now()}`),
      responsavelId: null, data: hojeIso, tipo: 'janta', numPessoas: '',
      observacao: '', itens: [],
    });
    setBusca(''); setPicker(false);
  };
  // liga o cronômetro (exige responsável — igual à execução de produção)
  const iniciarTimer = () => {
    if (!sessao?.responsavelId) { toast({ title: 'Selecione o responsável antes de iniciar', variant: 'destructive' }); return; }
    patch({ rodando: true, rodandoDesde: Date.now() });
  };

  const addInsumo = (c: { codigo: string; nome: string; base: string | null; precoUn: number }) => {
    setSessao(s => {
      if (!s) return s;
      if (s.itens.some(i => i.codigo === c.codigo)) return s; // já está na lista
      return { ...s, itens: [...s.itens, { codigo: c.codigo, nome: c.nome, base: c.base, precoUn: c.precoUn, qtd: '' }] };
    });
    setBusca(''); setPicker(false);
  };
  const removeInsumo = (codigo: string) => patch({ itens: (sessao?.itens || []).filter(i => i.codigo !== codigo) });
  const setQtd = (codigo: string, qtd: string) => patch({ itens: (sessao?.itens || []).map(i => i.codigo === codigo ? { ...i, qtd } : i) });

  // custo de uma linha = qtd(base) × precoUn ; qtd(base) = digitado × fator de entrada
  const custoLinha = (i: RefeicaoItem) => {
    const ent = entradaInsumo(i.base);
    const qtdBase = (pf(i.qtd) || 0) * ent.fator;
    return qtdBase * i.precoUn;
  };
  const custoTotal = useMemo(() => (sessao?.itens || []).reduce((s, i) => s + custoLinha(i), 0), [sessao?.itens]);
  const numPessoasNum = Number(sessao?.numPessoas) || 0;
  const custoPorPessoa = numPessoasNum > 0 ? custoTotal / numPessoasNum : null;

  const catalogoView = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return catalogo.slice(0, 30);
    return catalogo.filter(c => (c.nome || '').toLowerCase().includes(q) || (c.codigo || '').toLowerCase().includes(q)).slice(0, 30);
  }, [catalogo, busca]);

  // histórico das refeições
  const [refeicoes, setRefeicoes] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [de, setDe] = useState<string>(addDiasIso(hojeIso, -30));
  const [ate, setAte] = useState<string>(hojeIso);
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [detInsumos, setDetInsumos] = useState<any[]>([]);
  const carregarHist = useCallback(async () => {
    if (!barId) return;
    setLoadingHist(true);
    try {
      const qs = new URLSearchParams({ bar_id: String(barId) });
      if (de) qs.set('de', de);
      if (ate) qs.set('ate', ate);
      const r = await api.get(`/api/operacional/producoes/alimentacao?${qs.toString()}`);
      if (r.success) setRefeicoes(r.refeicoes || []);
    } finally { setLoadingHist(false); }
  }, [barId, de, ate]);
  useEffect(() => { carregarHist(); }, [carregarHist]);

  const abrirDetalhe = async (ref: any) => {
    setDetalhe(ref); setDetInsumos([]);
    const r = await api.get(`/api/operacional/producoes/alimentacao?bar_id=${barId}&execucao_id=${ref.id}`);
    if (r.success) setDetInsumos(r.insumos || []);
  };
  const excluir = async (ref: any) => {
    const r = await api.delete(`/api/operacional/producoes/alimentacao?id=${ref.id}&bar_id=${barId}`);
    if (r.success) { toast({ title: 'Refeição excluída' }); carregarHist(); if (detalhe?.id === ref.id) setDetalhe(null); }
    else toast({ title: 'Erro ao excluir', description: r.error, variant: 'destructive' });
  };

  const salvar = async () => {
    if (!sessao || !barId || salvando) return;
    if (!sessao.responsavelId) { toast({ title: 'Selecione o responsável', variant: 'destructive' }); return; }
    const comQtd = sessao.itens.filter(i => (pf(i.qtd) || 0) > 0);
    if (!comQtd.length) { toast({ title: 'Adicione insumos com quantidade', variant: 'destructive' }); return; }
    // ancora início ao tempo decorrido no cronômetro (âncora de relógio, igual à execução)
    const seg = elapsedOf(sessao);
    const fim = new Date();
    const inicio = new Date(fim.getTime() - seg * 1000);
    const respNome = responsaveis.find(r => r.id === sessao.responsavelId)?.nome ?? null;
    const linhas = comQtd.map(i => {
      const ent = entradaInsumo(i.base);
      return {
        insumo_codigo: i.codigo,
        nome: i.nome,
        qtd: (pf(i.qtd) || 0) * ent.fator, // em unidade-base (g/ml/un)
        unidade: i.base,
        preco_un: i.precoUn,
      };
    });
    setSalvando(true);
    try {
      const r = await api.post('/api/operacional/producoes/alimentacao', {
        bar_id: barId,
        responsavel_id: sessao.responsavelId,
        responsavel_nome: respNome,
        data_refeicao: sessao.data,
        tipo: sessao.tipo,
        num_pessoas: sessao.numPessoas || null,
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        duracao_seg: seg,
        observacao: sessao.observacao.trim() || null,
        insumos: linhas,
      });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Refeição registrada', description: `${tipoLabel(sessao.tipo)} · custo ${fmtBRL(r.custo_total)}` });
      apagarRascunho(sessao.idempotencyKey);   // finalizou → some o rascunho
      setSessao(null);
      carregarHist();
    } catch (e: any) { toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' }); }
    finally { setSalvando(false); }
  };

  return (
    <div className="space-y-4">
      {/* Retomar refeição em andamento achada em outro aparelho do bar (rede de segurança) */}
      {resumivel && !sessao && (
        <Card className="card-dark border-amber-300 dark:border-amber-800">
          <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <History className="w-4 h-4 shrink-0" />
              <span>Há uma <b>refeição em andamento</b> neste bar (iniciada em outro aparelho ou antes de limpar os dados). Retomar?</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => setResumivel(null)}>Ignorar</Button>
              <Button size="sm" onClick={retomarDoBar} className="bg-amber-600 hover:bg-amber-700"><RotateCcw className="w-4 h-4 mr-1" />Retomar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Abrir nova refeição (só quando não há uma em montagem) */}
      {!sessao && (
        <Card className="card-dark">
          <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><UtensilsCrossed className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Alimentação da equipe</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Marque os insumos da refeição do dia (arroz, feijão, linguiça…). O preço vem do catálogo — sem ficha técnica.</p>
              </div>
            </div>
            <Button onClick={novaRefeicao} disabled={!barId} className="bg-amber-600 hover:bg-amber-700 gap-1.5 shrink-0">
              <Plus className="w-4 h-4" />Nova refeição
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Painel inline de montagem da refeição (na página, não é modal) */}
      {sessao && (() => {
        const iniciada = sessao.rodando || elapsedOf(sessao, nowTick) > 0;
        return (
        <Card className="card-dark border-amber-200 dark:border-amber-900/40">
          <CardContent className="py-3 space-y-4">
            {/* Cabeçalho + timer */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar refeição da equipe</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-4 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center min-w-[110px]">
                  <div className="text-[10px] text-blue-600/80 dark:text-blue-300/80 uppercase tracking-wide flex items-center justify-center gap-1"><Clock className="w-3 h-3" />Tempo</div>
                  <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-300 leading-tight">{fmtTempo(elapsedOf(sessao, nowTick))}</div>
                </div>
                {!sessao.rodando
                  ? <Button size="sm" onClick={iniciarTimer} className="bg-green-600 hover:bg-green-700"><Play className="w-4 h-4 mr-1" />{elapsedOf(sessao, nowTick) > 0 ? 'Continuar' : 'Iniciar'}</Button>
                  : <Button size="sm" onClick={() => patch({ rodando: false, segundos: elapsedOf(sessao), rodandoDesde: null })} variant="outline"><Pause className="w-4 h-4 mr-1" />Pausar</Button>}
                <Button size="sm" variant="ghost" onClick={() => patch({ rodando: false, segundos: 0, rodandoDesde: null })} title="Zerar tempo"><RotateCcw className="w-4 h-4" /></Button>
              </div>
            </div>

            {saveInfo && (
              <div className={`flex items-center gap-1 text-[11px] ${saveInfo.status === 'salvo' ? 'text-emerald-600 dark:text-emerald-400' : saveInfo.status === 'offline' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                {saveInfo.status === 'salvando' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveInfo.status === 'salvo' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {saveInfo.status === 'salvando' ? 'Salvando…' : saveInfo.status === 'salvo' ? 'Progresso salvo no servidor — pode recarregar sem perder' : 'Sem conexão — salvo só neste aparelho por enquanto'}
              </div>
            )}

            {!iniciada && <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><Play className="w-3 h-3" />Preencha o responsável e os insumos; clique <b>Iniciar</b> quando começar a fazer a refeição de fato.</div>}

            {/* Responsável, data, tipo, pessoas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><User className="w-3.5 h-3.5" />Responsável *</label>
                <select value={sessao.responsavelId ?? ''} onChange={e => patch({ responsavelId: e.target.value ? Number(e.target.value) : null })}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
                  <option value="">Selecione…</option>
                  {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}{r.cargo ? ` (${r.cargo})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><CalendarCheck className="w-3.5 h-3.5" />Data</label>
                <Input type="date" value={sessao.data} max={hojeIso} onChange={e => patch({ data: e.target.value })} className="h-10" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Refeição</label>
                <select value={sessao.tipo} onChange={e => patch({ tipo: e.target.value })}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
                  {TIPOS_REFEICAO.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Users className="w-3.5 h-3.5" />Nº pessoas</label>
                <Input type="number" inputMode="numeric" min="0" value={sessao.numPessoas} onChange={e => patch({ numPessoas: e.target.value })} placeholder="opcional" className="h-10" />
              </div>
            </div>

            {/* Buscar/adicionar insumo */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={busca} onChange={e => { setBusca(e.target.value); setPicker(true); }} onFocus={() => setPicker(true)}
                onBlur={() => setTimeout(() => setPicker(false), 200)}
                placeholder={loadingCat ? 'Carregando insumos…' : 'Buscar insumo para adicionar (arroz, feijão…)'} className="pl-9 h-9" disabled={loadingCat} />
              {picker && catalogoView.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {catalogoView.map(c => {
                    const ent = entradaInsumo(c.base);
                    return (
                      <button key={c.codigo} onMouseDown={() => addInsumo(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-2">
                        <span className="truncate">{c.nome}<span className="text-xs text-gray-400 ml-1">{c.codigo}</span></span>
                        <span className="text-xs text-gray-400 shrink-0">{c.precoUn > 0 ? `${fmtBRL(c.precoUn * ent.fator)}/${ent.unidade}` : 'sem preço'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {picker && !loadingCat && catalogoView.length === 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg px-3 py-3 text-xs text-gray-500">Nenhum insumo encontrado.</div>
              )}
            </div>

            {/* Itens selecionados */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                  <th className="text-left font-medium px-2 py-1.5">Insumo</th>
                  <th className="text-right font-medium px-2 py-1.5 w-32">Quantidade</th>
                  <th className="text-right font-medium px-2 py-1.5">Custo</th>
                  <th className="px-2 py-1.5 w-8"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sessao.itens.length === 0 ? <tr><td colSpan={4} className="px-2 py-6 text-center text-gray-400">Adicione os insumos da refeição acima.</td></tr>
                  : sessao.itens.map(i => {
                    const ent = entradaInsumo(i.base);
                    return (
                      <tr key={i.codigo}>
                        <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">{i.nome}<span className="text-xs text-gray-400 ml-1">{i.precoUn > 0 ? `${fmtBRL(i.precoUn * ent.fator)}/${ent.unidade}` : 'sem preço'}</span></td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Input type="text" inputMode="decimal" step="any" value={i.qtd} onChange={e => setQtd(i.codigo, e.target.value)} placeholder="0" className="h-8 w-20 text-right text-sm" />
                            <span className="text-xs text-gray-400 w-6">{ent.unidade}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(custoLinha(i))}</td>
                        <td className="px-2 py-1.5 text-right"><button onClick={() => removeInsumo(i.codigo)} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumo de custo */}
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/15 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo total</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400">{fmtBRL(custoTotal)}</div>
              </div>
              {custoPorPessoa != null && (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo / pessoa</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(custoPorPessoa)}</div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              <Input value={sessao.observacao} onChange={e => patch({ observacao: e.target.value })} placeholder="Observação (opcional)…" className="flex-1" />
              <Button variant="outline" onClick={() => !salvando && pedirDescartarRefeicao()} className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4 mr-1" />Descartar</Button>
              <Button onClick={salvar} disabled={salvando} className="bg-amber-600 hover:bg-amber-700">
                {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Registrar refeição
              </Button>
            </div>
          </CardContent>
        </Card>
        );
      })()}

      {/* Histórico das refeições */}
      <Card className="card-dark">
        <CardContent className="py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1"><History className="w-4 h-4" />Refeições registradas</span>
            <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
              <span>de</span><Input type="date" value={de} max={ate} onChange={e => setDe(e.target.value)} className="h-8 w-36" />
              <span>até</span><Input type="date" value={ate} min={de} onChange={e => setAte(e.target.value)} className="h-8 w-36" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                <th className="text-left font-medium px-2 py-1.5">Data</th>
                <th className="text-left font-medium px-2 py-1.5">Refeição</th>
                <th className="text-left font-medium px-2 py-1.5">Responsável</th>
                <th className="text-right font-medium px-2 py-1.5">Pessoas</th>
                <th className="text-right font-medium px-2 py-1.5">Tempo</th>
                <th className="text-right font-medium px-2 py-1.5">Custo</th>
                <th className="text-right font-medium px-2 py-1.5">Custo/pessoa</th>
                <th className="px-2 py-1.5"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loadingHist ? <tr><td colSpan={8} className="px-2 py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                : refeicoes.length === 0 ? <tr><td colSpan={8} className="px-2 py-8 text-center text-gray-400">Nenhuma refeição registrada no período.</td></tr>
                : refeicoes.map((ref: any) => {
                  const cpp = ref.num_pessoas > 0 && ref.custo_total != null ? Number(ref.custo_total) / Number(ref.num_pessoas) : null;
                  return (
                    <tr key={ref.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">{fmtDM(ref.data_refeicao)}</td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="text-[11px]">{tipoLabel(ref.tipo)}</Badge></td>
                      <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{ref.responsavel_nome || '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{ref.num_pessoas || '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{ref.duracao_seg != null ? fmtTempo(ref.duracao_seg) : '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(ref.custo_total)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{cpp != null ? fmtBRL(cpp) : '—'}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <button onClick={() => abrirDetalhe(ref)} title="Ver insumos" className="p-1 text-gray-400 hover:text-indigo-600"><ListChecks className="w-4 h-4" /></button>
                        {podeExcluir && <button onClick={() => excluir(ref)} title="Excluir" className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhe dos insumos de uma refeição do histórico */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetalhe(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-3.5">
              <h4 className="font-semibold text-gray-900 dark:text-white">{tipoLabel(detalhe.tipo)} · {fmtDM(detalhe.data_refeicao)}</h4>
              <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b"><tr>
                  <th className="text-left font-medium px-2 py-1.5">Insumo</th>
                  <th className="text-right font-medium px-2 py-1.5">Qtd</th>
                  <th className="text-right font-medium px-2 py-1.5">Custo</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detInsumos.length === 0 ? <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-400">—</td></tr>
                  : detInsumos.map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">{i.nome || i.insumo_codigo}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{fmtPeso(i.qtd, i.unidade)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(i.custo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 text-sm">
                <span className="text-gray-500">Total{detalhe.num_pessoas > 0 ? ` · ${detalhe.num_pessoas} pessoas` : ''}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{fmtBRL(detalhe.custo_total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de descarte da refeição (só aparece se há trabalho lançado) */}
      {confirmarDescartar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmarDescartar(false); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-semibold">Descartar refeição?</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Isso apaga a refeição e tudo que você já lançou (tempo, insumos, anotações). Não dá pra desfazer.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmarDescartar(false)}>Voltar</Button>
              <Button onClick={descartarRefeicao} className="bg-red-600 hover:bg-red-700">Sim, descartar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
