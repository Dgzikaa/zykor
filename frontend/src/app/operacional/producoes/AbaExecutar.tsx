'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api-client';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import {
  Timer, Play, Pause, RotateCcw, Save, Search, Plus, Trash2, User,
  Loader2, History, Package, Clock, X, Scale, AlertTriangle, CalendarCheck, CheckCircle2,
} from 'lucide-react';
import {
  fmtDM, fmtData, fmtCrono, fmtBRL, fmtNum, fmtPeso, entradaPeso, AvisoUnidade, fmtPct, fmtTempo,
  getDeviceId, secaoDeCodigo, MOD_GERIR_EQUIPE, pf,
  type Secao, type FichaItem, type ActiveProd,
} from './_shared';

export function AbaExecutar({ fichas, responsaveis, secaoAtiva }: { fichas: any[]; responsaveis: any[]; secaoAtiva: Secao }) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const { can } = useAuth();
  const barId = selectedBar?.id;
  // Quem pode "Gerir equipe > excluir" também pode DESCARTAR um rascunho de outro aparelho
  // (limpar produção abandonada na hora, sem esperar o cron).
  const podeExcluirRascunho = can(MOD_GERIR_EQUIPE, 'excluir');

  // seleção de ficha para adicionar
  const [busca, setBusca] = useState('');
  const [picker, setPicker] = useState(false);

  // produções ativas + qual está aberta no detalhe
  const [prods, setProds] = useState<ActiveProd[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ prod: ActiveProd; suspeitos: { campo: string; valor: number; unidade: string | null; esperado: number }[] } | null>(null);
  // status do autosave no servidor (feedback pro operador: "tá salvo, pode recarregar")
  const [saveInfo, setSaveInfo] = useState<{ status: 'salvando' | 'salvo' | 'offline'; at: number } | null>(null);
  // confirmação de ação destrutiva (descartar/zerar) — evita perda por toque acidental no tablet
  const [confirmarAcao, setConfirmarAcao] = useState<{ tipo: 'descartar' | 'zerar'; localId: string; nome: string } | null>(null);
  const [confirmarDup, setConfirmarDup] = useState<any | null>(null); // produção já em andamento → confirmar 2ª fornada
  // produção em andamento achada em OUTRO device do bar (cache do tablet limpo / trocou de aparelho)
  const [resumivel, setResumivel] = useState<any[] | null>(null);
  const idRef = useRef(0);
  // espelho de prods p/ os gravadores lerem sempre o valor atual sem recriar os intervals
  const prodsRef = useRef(prods);
  prodsRef.current = prods;

  const [deviceId] = useState(getDeviceId);          // id do tablet (escopo dos rascunhos no servidor)
  const [nowTick, setNowTick] = useState(() => Date.now()); // re-render de 1/1s p/ o cronômetro "andar"
  const lastLocalRef = useRef<string>('');           // assinatura do último write no localStorage
  const lastServerRef = useRef<string>('');          // assinatura do último autosave no servidor
  const persistLocalErroRef = useRef(false);         // já avisei que o localStorage falhou? (não spamar)
  const claimKeysRef = useRef<Set<string>>(new Set()); // idempotencyKeys sendo ASSUMIDAS (Retomar) no próximo autosave

  // tempo decorrido REAL de uma produção (âncora de relógio): segundos bancados + segmento em curso.
  const elapsedOf = (p: { segundos: number; rodando: boolean; rodandoDesde?: number | null }, now = Date.now()) =>
    Math.max(0, Math.round((Number(p.segundos) || 0) + (p.rodando && p.rodandoDesde ? (now - p.rodandoDesde) / 1000 : 0)));

  // Epoch ms de quando a produção começou (pro card "em andamento"): usa iniciadoEm (novo);
  // senão o criado_em do rascunho no servidor (drafts antigos/de outro aparelho); senão deriva
  // da âncora do relógio (rodandoDesde − tempo bancado). null quando não dá pra saber.
  const inicioDe = (p: any): number | null => {
    if (p?.iniciadoEm) return Number(p.iniciadoEm);
    if (p?.criado_em) { const t = Date.parse(p.criado_em); if (!Number.isNaN(t)) return t; }
    const seg = (Number(p?.segundos) || 0) * 1000;
    if (p?.rodando && p?.rodandoDesde) return Number(p.rodandoDesde) - seg;
    return null;
  };

  // snapshot serializável (sem flags de UI voláteis) — base dos writes local/servidor
  const snapshotProds = () => prodsRef.current.map(p => ({ ...p, loadingItens: false }));

  // aplica um conjunto de estados salvos na tela. Usado na hidratação e no "retomar por bar".
  // fromServer=true SÓ quando o dado veio do servidor DESTE device → aí suprime o echo do PUT.
  // Se veio do localStorage (ou de outro device no retomar), NÃO suprime → o writeServer empurra
  // pro servidor (senão o rascunho ficava só no aparelho). O localStorage sempre re-sincroniza.
  const aplicarEstados = useCallback((estados: any[], fromServer = false): boolean => {
    const validos = (Array.isArray(estados) ? estados : []).filter((p: any) => p && p.localId && p.ficha);
    // Colapsa duplicatas EXATAS (mesma produção salva 2x em devices/ciclos diferentes),
    // identidade estável = idempotencyKey. Sem chave (rascunho antigo) → nunca dedupa.
    // Fica com a de maior tempo cronometrado pra não perder progresso.
    const porChave = new Map<string, any>();
    validos.forEach((p: any, i: number) => {
      const chave = p.idempotencyKey ? `k:${p.idempotencyKey}` : `i:${i}`;
      const ant = porChave.get(chave);
      if (!ant || (Number(p.segundos) || 0) >= (Number(ant.segundos) || 0)) porChave.set(chave, p);
    });
    // localId SEMPRE reatribuído único nesta sessão: o "retomar por bar" mescla rascunhos de
    // vários aparelhos que começam em p1 → localId colidia e clicar num chip selecionava
    // todos os que dividiam o id ("seleciona 3"). idempotencyKey preserva a identidade real.
    const restored: ActiveProd[] = [...porChave.values()].map((p: any) => ({
      ...p,
      localId: `p${++idRef.current}`,
      loadingItens: false,
      segundos: Number(p.segundos) || 0,
      rodandoDesde: p.rodando ? (Number(p.rodandoDesde) || Date.now()) : null,
    }));
    if (!restored.length) return false;
    setProds(restored);
    setSelId(restored[restored.length - 1].localId);
    if (fromServer) lastServerRef.current = JSON.stringify(restored.map(p => ({ ...p, loadingItens: false })));
    return true;
  }, []);

  // tick de 1s enquanto há algo rodando (minha lista OU o monitor do bar) → o cronômetro
  // "anda" suave, inclusive das produções acompanhadas de outros aparelhos (tempo vem da âncora).
  const anyRodando = prods.some(p => p.rodando) || (resumivel || []).some((p: any) => p.rodando);
  useEffect(() => {
    if (!anyRodando) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anyRodando]);

  // grava no localStorage (cache offline). C: se falhar (quota/modo privado), AVISA em vez de
  // engolir em silêncio — o servidor continua sendo a fonte durável.
  const writeLocal = useCallback(() => {
    if (!barId) return;
    const cur = snapshotProds();
    const sig = cur.length ? JSON.stringify(cur) : '';
    if (sig === lastLocalRef.current) return;
    lastLocalRef.current = sig;
    try {
      const key = `zykor:producoes:ativas:${barId}`;
      if (cur.length) localStorage.setItem(key, JSON.stringify({ _ts: Date.now(), prods: cur }));
      else localStorage.removeItem(key);
      persistLocalErroRef.current = false;
    } catch {
      if (!persistLocalErroRef.current) {
        persistLocalErroRef.current = true;
        toast({ title: 'Armazenamento local cheio', description: 'Não consegui salvar o progresso neste aparelho, mas ele está sendo salvo no servidor. Finalize as produções abertas para liberar espaço.', variant: 'destructive' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId]);

  // A: autosave no SERVIDOR (rascunho) — fonte durável que sobrevive a reload/deploy/quota/descarte
  // de aba. Só reenvia quando muda. Remoções vão por DELETE em remover()/no finalizar.
  const writeServer = useCallback(async () => {
    if (!barId) return;
    const cur = snapshotProds();
    if (!cur.length) return;
    const sig = JSON.stringify(cur);
    if (sig === lastServerRef.current) return;
    lastServerRef.current = sig;
    const now = Date.now();
    const rascunhos = cur.map(p => ({
      idempotencia_key: p.idempotencyKey,
      secao: p.ficha?.codigo ? secaoDeCodigo(p.ficha.codigo) : secaoAtiva,
      producao_id: p.ficha?.id ?? null,
      responsavel_id: p.responsavelId ?? null,
      rodando: !!p.rodando,
      duracao_seg: elapsedOf(p, now),
      estado: p,
    }));
    const claim_keys = [...claimKeysRef.current];
    setSaveInfo({ status: 'salvando', at: Date.now() });
    try {
      const r = await api.put('/api/operacional/producoes/execucao/rascunho', { bar_id: barId, device_id: deviceId, rascunhos, claim_keys });
      if (r?.success === false) throw new Error(r?.error || 'falha');
      claim_keys.forEach(k => claimKeysRef.current.delete(k)); // claim confirmado → limpa pendência
      // rejeitados = produções que foram ASSUMIDAS em outro aparelho (não sou mais dono).
      // Tira da minha tela (dono único) e avisa; elas reaparecem no quadro amarelo p/ retomar de volta.
      const rejeitados: string[] = Array.isArray(r?.rejeitados) ? r.rejeitados : [];
      if (rejeitados.length) {
        const set = new Set(rejeitados);
        const perdidas = prodsRef.current.filter(p => set.has(p.idempotencyKey));
        if (perdidas.length) {
          setProds(prev => prev.filter(p => !set.has(p.idempotencyKey)));
          lastServerRef.current = '';
          perdidas.forEach(p => toast({ title: 'Produção assumida em outro aparelho', description: `${p.ficha?.nome || 'Produção'} foi retomada em outro dispositivo. Ela segue no quadro "em andamento no bar" caso queira retomar de volta.` }));
        }
      }
      setSaveInfo({ status: 'salvo', at: Date.now() });
    } catch {
      lastServerRef.current = '';            // falhou → retenta no próximo ciclo
      setSaveInfo({ status: 'offline', at: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId, secaoAtiva, deviceId, toast]);

  // SINCRONIZAÇÃO com o servidor (fonte da verdade, escopo BAR) — modelo de DONO ÚNICO:
  //  • minhas produções (owner_device == este aparelho) hidratam/permanecem na lista ativa;
  //  • as de OUTROS aparelhos vão pro quadro amarelo "em andamento no bar" (retomar individual);
  //  • se ROUBARAM uma que eu tinha (virou de outro dono), ela sai da minha lista aqui (+ toast).
  // Roda na abertura e a cada 8s (monitor ao vivo, leve). A âncora de relógio reconstrói o tempo.
  const hidratou = useRef(false);
  const sincronizarBar = useCallback(async (primeira: boolean) => {
    if (!barId) return;
    let rows: any[] = [];
    try {
      const r = await api.get(`/api/operacional/producoes/execucao/rascunho?bar_id=${barId}`);
      if (!r?.success || !Array.isArray(r.rascunhos)) return;
      rows = r.rascunhos;
    } catch { return; }
    const donoDe = (row: any): string | null => (row.owner_device || row.device_id) || null;

    if (primeira && !hidratou.current) {
      // hidratação inicial: aplica minhas produções; se o servidor não tiver, cai no cache local.
      const meus = rows.filter(row => donoDe(row) === deviceId).map(row => row.estado).filter((e: any) => e && e.localId && e.ficha);
      let applied = false;
      if (meus.length) applied = aplicarEstados(meus, true);
      if (!applied) {
        try {
          const raw = localStorage.getItem(`zykor:producoes:ativas:${barId}`);
          if (raw) { const saved = JSON.parse(raw); aplicarEstados(Array.isArray(saved?.prods) ? saved.prods : []); }
        } catch { /* ignore */ }
      }
      hidratou.current = true;
    } else {
      // já hidratado: solta da minha lista o que virou de OUTRO dono (roubado), exceto o que
      // estou assumindo agora (claim pendente). O autosave (rejeitados) faz o mesmo — convergem.
      const donoMap = new Map(rows.map(row => [row.idempotencia_key, donoDe(row)]));
      const perder = prodsRef.current.filter(p => {
        if (claimKeysRef.current.has(p.idempotencyKey)) return false;
        const d = donoMap.get(p.idempotencyKey);
        return d && d !== deviceId;
      });
      if (perder.length) {
        const set = new Set(perder.map(p => p.idempotencyKey));
        setProds(prev => prev.filter(p => !set.has(p.idempotencyKey)));
        lastServerRef.current = '';
        perder.forEach(p => toast({ title: 'Produção assumida em outro aparelho', description: `${p.ficha?.nome || 'Produção'} foi retomada em outro dispositivo. Segue no quadro "em andamento no bar" p/ retomar de volta.` }));
      }
    }

    // Quadro amarelo = produções do bar de OUTROS aparelhos que eu não tenho na lista ativa.
    // NÃO mostra produção só ABERTA (timer nunca iniciado): 0s parada não é "em andamento" — é fila
    // pré-play. Ninguém inicia+pausa em <0,1s, então 0s+parada = rascunho de autosave antes do play.
    const iniciada = (row: any) =>
      !!row.rodando || (Number(row.duracao_seg) || 0) > 0 || (Number(row?.estado?.segundos) || 0) > 0;
    const meusKeys = new Set(prodsRef.current.map(p => p.idempotencyKey));
    const outros = rows
      .filter(row => donoDe(row) !== deviceId && iniciada(row))
      // leva o criado_em do rascunho junto do estado — fallback de "início" p/ drafts sem iniciadoEm
      .map(row => ({ ...row.estado, criado_em: row.criado_em }))
      .filter((e: any) => e && e.localId && e.ficha && !meusKeys.has(e.idempotencyKey));
    setResumivel(outros.length ? outros : null);
  }, [barId, deviceId, aplicarEstados, toast]);

  useEffect(() => {
    if (!barId) return;
    hidratou.current = false;
    let cancel = false;
    void sincronizarBar(true);
    // Poll só de FALLBACK (rede caiu / realtime desconectou). O caminho rápido é o realtime abaixo.
    const t = setInterval(() => { if (!cancel) void sincronizarBar(false); }, 20000);
    return () => { cancel = true; clearInterval(t); };
  }, [barId, sincronizarBar]);

  // REAL-TIME: o servidor empurra as mudanças (iniciar/pausar/finalizar/assumir em qualquer
  // aparelho do bar) via Supabase Realtime → a tela reflete na hora, sem esperar o poll.
  // Debounce curto pra colapsar rajadas (vários rascunhos mudando juntos) num só sync.
  useEffect(() => {
    if (!barId) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let deb: ReturnType<typeof setTimeout> | null = null;
    const agendarSync = () => {
      if (deb) clearTimeout(deb);
      deb = setTimeout(() => { if (!cancelled) void sincronizarBar(false); }, 600);
    };
    (async () => {
      const supabase = await getSupabaseClient();
      if (!supabase || cancelled) return;
      channel = supabase
        .channel(`producao_rascunho:${barId}`)
        .on('postgres_changes', { event: '*', schema: 'operations', table: 'producao_execucao_rascunho', filter: `bar_id=eq.${barId}` }, agendarSync)
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (deb) clearTimeout(deb);
      if (channel) getSupabaseClient().then((s) => s?.removeChannel(channel!)).catch(() => {});
    };
  }, [barId, sincronizarBar]);

  // Gravação periódica + flush ao sair/backgroundear a tela. localStorage a cada 1s (barato);
  // servidor a cada 10s; ambos no pagehide/visibilitychange (tablet indo pra background = o caso
  // clássico de "sumiu"). Flush final ao desmontar/trocar de bar.
  useEffect(() => {
    if (!barId) return;
    const localT = setInterval(writeLocal, 1000);
    const serverT = setInterval(() => { void writeServer(); }, 10000);
    const flush = () => { writeLocal(); void writeServer(); };
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(localT); clearInterval(serverT);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      flush();
    };
  }, [barId, writeLocal, writeServer]);

  // Salvamento IMEDIATO (debounce 1,5s) em mudança estrutural — iniciar/pausar/adicionar/remover/
  // trocar responsável. Encurta a janela de perda: o momento crítico (âncora de início) não espera
  // os 10s do ciclo. Edições de campo (peso/rendimento) seguem no ciclo periódico + flush.
  const structSig = prods.map(p => `${p.localId}:${p.rodando ? 1 : 0}:${p.rodandoDesde ?? ''}:${p.responsavelId ?? ''}`).join('|');
  useEffect(() => {
    if (!barId || !prods.length) return;
    const t = setTimeout(() => { writeLocal(); void writeServer(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structSig, barId]);

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
  // só os itens do plano cuja ficha é da seção ativa (Cozinha/Bar)
  const secaoDoItem = useCallback((it: any): Secao | null => {
    const f = fichas.find(x => x.id === it.producao_id);
    return f ? secaoDeCodigo(f.codigo) : null;
  }, [fichas]);
  const itensSecao = useMemo(() =>
    (planSemana?.itens || []).filter((it: any) => secaoDoItem(it) === secaoAtiva),
    [planSemana, secaoDoItem, secaoAtiva]);
  const diasPlano = useMemo(() => {
    const ini = planSemana?.semana?.ini;
    if (!ini) return [];
    const [y, m, d] = ini.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const iso = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
      return { iso, label: `${DIAS_LBL[i]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`, itens: itensSecao.filter((it: any) => it.dia_producao === iso) };
    });
  }, [planSemana, itensSecao]);
  const semDia = useMemo(() => itensSecao.filter((it: any) => !it.dia_producao), [itensSecao]);

  const fichasControle = useMemo(() => fichas.filter(f => f.controle_producao), [fichas]);
  const fichasView = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return fichasControle.filter(f => {
      if (secaoDeCodigo(f.codigo) !== secaoAtiva) return false;
      return !q || (f.nome || '').toLowerCase().includes(q) || (f.codigo || '').toLowerCase().includes(q);
    });
  }, [fichasControle, busca, secaoAtiva]);

  const patch = useCallback((id: string, p: Partial<ActiveProd>) =>
    setProds(prev => prev.map(x => x.localId === id ? { ...x, ...p } : x)), []);

  const _adicionar = async (f: any) => {
    const localId = `p${++idRef.current}`;
    const nova: ActiveProd = {
      localId, ficha: f, itens: [], loadingItens: true, responsavelId: null,
      pesoBruto: '', pesoMestre: '', rendimentoReal: '', observacao: '', qtdReal: {}, segundos: 0, rodando: false, rodandoDesde: null, dataProducao: '',
      iniciadoEm: Date.now(), // marca quando a produção foi criada (exibido no card em andamento)
      idempotencyKey: (globalThis.crypto?.randomUUID?.() ?? `${localId}-${Date.now()}-${Math.round(Math.random() * 1e9)}`),
    };
    setProds(prev => [...prev, nova]);
    setSelId(localId);
    setBusca(''); setPicker(false);
    try {
      const r = await api.get(`/api/operacional/producoes/ficha?producao_id=${f.id}&bar_id=${barId}`);
      patch(localId, { itens: r.success ? (r.itens || []) : [], loadingItens: false });
    } catch { patch(localId, { loadingItens: false }); }
  };
  // Trava anti-duplicata: adicionar a MESMA produção que já está em andamento NESTE aparelho
  // exige confirmação. Evita 2 rascunhos da mesma coisa (ex.: re-adicionar após reload, sem
  // notar que ela já foi restaurada) — o que gerava cards duplicados e risco de finalizar 2×.
  const adicionar = async (f: any) => {
    if (prodsRef.current.some(p => p.ficha?.id === f.id)) {
      setBusca(''); setPicker(false);
      setConfirmarDup(f);
      return;
    }
    await _adicionar(f);
  };

  const remover = (id: string) => {
    const alvo = prodsRef.current.find(p => p.localId === id);
    setProds(prev => {
      const next = prev.filter(p => p.localId !== id);
      setSelId(s => s === id ? (next[next.length - 1]?.localId ?? null) : s);
      return next;
    });
    // apaga o rascunho no servidor (descartou ou finalizou). Best-effort; o POST da execução
    // também apaga como backstop. Reseta a assinatura p/ o próximo autosave re-sincronizar o resto.
    lastServerRef.current = '';
    if (alvo?.idempotencyKey && barId) {
      api.delete(`/api/operacional/producoes/execucao/rascunho?bar_id=${barId}&key=${encodeURIComponent(alvo.idempotencyKey)}`).catch(() => {});
    }
  };

  // cálculos derivados de uma produção (proporção do mestre, custo, desvio)
  const calc = (prod: ActiveProd) => {
    const mestre = prod.itens.find(i => i.is_mestre) || null;
    const mestreQtd = Number(mestre?.quantidade || 0);
    const baseMestre = (mestre as any)?.unidade_exib || null;
    const entrada = entradaPeso(baseMestre, mestreQtd);       // unidade digitada (kg/L) → base (g/ml)
    const pesoMestreNum = (pf(prod.pesoMestre) || 0) * entrada.fator; // sempre em base p/ o cálculo
    const proporcao = (mestre && pesoMestreNum > 0 && mestreQtd > 0) ? pesoMestreNum / mestreQtd : 1;
    const linhas = prod.itens.map(it => {
      const qtdPlan = Number(it.quantidade || 0);
      const qtdCalc = it.is_mestre ? (pesoMestreNum > 0 ? pesoMestreNum : qtdPlan) : qtdPlan * proporcao;
      const ov = prod.qtdReal[it.id];
      const real = ov != null && ov !== '' ? (pf(ov) || 0) : qtdCalc;
      const precoUn = Number(it.preco_un || 0);
      const cPlan = qtdCalc * precoUn;
      const cReal = real * precoUn;
      const desvio = qtdCalc > 0 ? (real - qtdCalc) / qtdCalc : null;
      return { it, qtdPlan, qtdCalc, real, precoUn, cPlan, cReal, desvio };
    });
    const custoPlan = linhas.reduce((s, l) => s + l.cPlan, 0);
    const custoReal = linhas.reduce((s, l) => s + l.cReal, 0);
    const rendEsperado = Number(prod.ficha?.rendimento || 0) * proporcao;
    // Rendimento vai na unidade do PRODUTO (ficha.unidade) — NÃO na do insumo mestre.
    // Ex.: mestre em grama (fator kg=1000), mas o produto rende em "un" (fator 1) → sem ×1000.
    const entRend = entradaPeso(prod.ficha?.unidade || null, rendEsperado);
    return { mestre, mestreQtd, baseMestre, entrada, entRend, proporcao, linhas, custoPlan, custoReal, rendEsperado };
  };

  const iniciar = (prod: ActiveProd) => {
    if (!prod.responsavelId) { toast({ title: 'Selecione o responsável', variant: 'destructive' }); return; }
    // ancora o início do segmento no relógio; `segundos` (bancado) permanece → "Continuar" soma certo
    patch(prod.localId, { rodando: true, rodandoDesde: Date.now() });
  };

  // tem trabalho de verdade lançado? (usado p/ decidir se pede confirmação antes de descartar/zerar)
  const temProgresso = (p: ActiveProd) =>
    elapsedOf(p) > 0 || !!p.pesoBruto || !!p.pesoMestre || !!p.rendimentoReal || !!p.observacao ||
    Object.values(p.qtdReal || {}).some(v => String(v ?? '').trim() !== '');

  // ações destrutivas com confirmação (só quando há progresso) — no tablet, um toque errado no X/
  // Descartar/Zerar apagava a produção sem volta (agora o descarte também remove o rascunho no servidor).
  const pedirDescartar = (prod: ActiveProd) =>
    temProgresso(prod)
      ? setConfirmarAcao({ tipo: 'descartar', localId: prod.localId, nome: prod.ficha?.nome || 'produção' })
      : remover(prod.localId);
  const pedirZerar = (prod: ActiveProd) =>
    elapsedOf(prod) > 0
      ? setConfirmarAcao({ tipo: 'zerar', localId: prod.localId, nome: prod.ficha?.nome || 'produção' })
      : patch(prod.localId, { rodando: false, segundos: 0, rodandoDesde: null });
  const confirmarAcaoExec = () => {
    if (!confirmarAcao) return;
    if (confirmarAcao.tipo === 'descartar') remover(confirmarAcao.localId);
    else patch(confirmarAcao.localId, { rodando: false, segundos: 0, rodandoDesde: null });
    setConfirmarAcao(null);
  };
  // ASSUME ("rouba") UMA produção do quadro do bar pra este aparelho — dono único. Append (não
  // replace), localId novo/único. O claim imediato no servidor troca o dono; o aparelho de origem
  // perde a posse no próximo autosave/sync (sai da tela dele e volta pro quadro amarelo).
  const retomarUma = (p: any) => {
    const nova: ActiveProd = {
      ...(p as ActiveProd),
      localId: `p${++idRef.current}`,
      loadingItens: false,
      segundos: Number(p.segundos) || 0,
      rodandoDesde: p.rodando ? (Number(p.rodandoDesde) || Date.now()) : null,
    };
    setProds(prev => [...prev, nova]);
    setSelId(nova.localId);
    lastServerRef.current = '';                 // força o autosave re-sincronizar com a nova produção
    setResumivel(prev => {
      const chave = p.idempotencyKey || p.localId;
      const rest = (prev || []).filter((x: any) => (x.idempotencyKey || x.localId) !== chave);
      return rest.length ? rest : null;
    });
    // claim IMEDIATO no servidor (não espera o autosave de 10s) — assume a posse já.
    if (nova.idempotencyKey && barId) {
      claimKeysRef.current.add(nova.idempotencyKey);
      api.put('/api/operacional/producoes/execucao/rascunho', {
        bar_id: barId, device_id: deviceId, claim_keys: [nova.idempotencyKey],
        rascunhos: [{
          idempotencia_key: nova.idempotencyKey,
          secao: nova.ficha?.codigo ? secaoDeCodigo(nova.ficha.codigo) : secaoAtiva,
          producao_id: nova.ficha?.id ?? null,
          responsavel_id: nova.responsavelId ?? null,
          rodando: !!nova.rodando,
          duracao_seg: elapsedOf(nova),
          estado: nova,
        }],
      }).then(() => { claimKeysRef.current.delete(nova.idempotencyKey); })
        .catch(() => { claimKeysRef.current.delete(nova.idempotencyKey); });
    }
  };

  // DESCARTA um rascunho de outro aparelho (produção abandonada) — só quem pode gerir equipe.
  // Tira da lista e apaga no servidor. Não mexe em produção finalizada (histórico intacto).
  const descartarRascunho = (p: any) => {
    if (!p.idempotencyKey || !barId) return;
    if (!window.confirm(`Descartar o rascunho de "${p.ficha?.nome || 'produção'}"? Isso remove essa produção em andamento (não afeta o que já foi finalizado).`)) return;
    setResumivel(prev => {
      const rest = (prev || []).filter((x: any) => (x.idempotencyKey || x.localId) !== (p.idempotencyKey || p.localId));
      return rest.length ? rest : null;
    });
    api.delete(`/api/operacional/producoes/execucao/rascunho?bar_id=${barId}&key=${encodeURIComponent(p.idempotencyKey)}`)
      .then(() => toast({ title: 'Rascunho descartado' }))
      .catch((e: any) => toast({ title: 'Erro ao descartar', description: e?.message, variant: 'destructive' }));
  };

  // detecta valores prováveis de erro de unidade (ex.: digitou 1,2 como se fosse kg onde a meta é 1.020 g)
  const checarUnidades = (prod: ActiveProd) => {
    const { mestre, mestreQtd, baseMestre, entrada, entRend, linhas, rendEsperado } = calc(prod);
    const FATOR = 50; // diferença de ~50x+ quase sempre é confusão de unidade (g×kg, ml×L), não variação real
    const off = (val: number, ref: number) => ref > 0 && val > 0 && (val / ref >= FATOR || ref / val >= FATOR);
    const sus: { campo: string; valor: number; unidade: string | null; esperado: number }[] = [];
    const rreal = (pf(prod.rendimentoReal) || 0) * entRend.fator; // digitado na unidade do produto (un/kg/L) → base
    if (rendEsperado > 0 && off(rreal, rendEsperado)) sus.push({ campo: 'Rendimento real', valor: rreal, unidade: prod.ficha.unidade, esperado: rendEsperado });
    // pm/pb são digitados na unidade de entrada (kg/L) → converte p/ base antes de comparar com a ficha (base)
    const pm = (pf(prod.pesoMestre) || 0) * entrada.fator;
    if (mestre && off(pm, mestreQtd)) sus.push({ campo: `${mestre.insumo_fc ? 'Peso líquido' : 'Peso'} do mestre — ${mestre.nome_componente || ''}`.trim(), valor: pm, unidade: baseMestre, esperado: mestreQtd });
    const pb = (pf(prod.pesoBruto) || 0) * entrada.fator;
    if (mestre?.insumo_fc && off(pb, mestreQtd)) sus.push({ campo: `Peso bruto do mestre — ${mestre.nome_componente || ''}`.trim(), valor: pb, unidade: baseMestre, esperado: mestreQtd });
    for (const l of linhas) {
      if (off(l.real, l.qtdCalc)) sus.push({ campo: l.it.nome_componente || l.it.componente_codigo || 'Insumo', valor: l.real, unidade: l.it.unidade_exib, esperado: l.qtdCalc });
    }
    return sus;
  };

  // "Usado" vazio? (string nula ou só espaço). Obrigatório em todo insumo NÃO-mestre
  // (o mestre é dirigido pelo peso do mestre, não pela coluna Usado).
  const usadoVazio = (prod: ActiveProd, it: FichaItem) => {
    if (it.is_mestre) return false;
    const v = prod.qtdReal[it.id];
    return v == null || String(v).trim() === '';
  };

  // preenche todos os "Usado" com o valor calculado atual (atalho: aceitar o teórico e ajustar o que mudou)
  const preencherCalculado = (prod: ActiveProd) => {
    const { linhas } = calc(prod);
    const next = { ...prod.qtdReal };
    linhas.forEach(l => { next[l.it.id] = String(Math.round(l.qtdCalc * 1000) / 1000); });
    patch(prod.localId, { qtdReal: next });
  };

  const pedirSalvar = (prod: ActiveProd) => {
    const faltaResp = !prod.responsavelId;
    const faltaRend = !prod.rendimentoReal.trim();
    const usadoFaltando = prod.itens.filter(it => usadoVazio(prod, it));
    if (faltaResp || faltaRend || usadoFaltando.length) {
      patch(prod.localId, { tentouSalvar: true }); // liga o destaque vermelho dos vazios
      const partes: string[] = [];
      if (faltaResp) partes.push('responsável');
      if (faltaRend) partes.push('rendimento real');
      if (usadoFaltando.length) partes.push(`${usadoFaltando.length} insumo${usadoFaltando.length > 1 ? 's' : ''} sem "Usado"`);
      toast({ title: 'Preencha os campos obrigatórios', description: partes.join(' · '), variant: 'destructive' });
      return;
    }
    const suspeitos = checarUnidades(prod);
    if (suspeitos.length) { setConfirmar({ prod, suspeitos }); return; }
    executarSalvar(prod);
  };

  const executarSalvar = async (prod: ActiveProd) => {
    if (!barId) return;
    setConfirmar(null);
    setSalvandoId(prod.localId);
    // congela o cronômetro na duração real (âncora de relógio) antes de gravar
    const seg = elapsedOf(prod);
    patch(prod.localId, { rodando: false, segundos: seg, rodandoDesde: null });
    const { linhas, rendEsperado, mestre, entrada, entRend } = calc(prod);
    // retroativa: se lançou uma data passada, ancora fim ao meio-dia dela (o desvio usa inicio::date)
    const hoje = new Date().toISOString().slice(0, 10);
    const agora = (prod.dataProducao && prod.dataProducao !== hoje)
      ? new Date(`${prod.dataProducao}T12:00:00`)
      : new Date();
    const inicio = new Date(agora.getTime() - seg * 1000);
    const resp = responsaveis.find(r => r.id === prod.responsavelId);
    const payload = {
      bar_id: barId,
      producao_id: prod.ficha.id,
      idempotencia_key: prod.idempotencyKey,
      responsavel_id: prod.responsavelId,
      responsavel_nome: resp?.nome ?? null,
      inicio: inicio.toISOString(),
      fim: agora.toISOString(),
      duracao_seg: seg,
      rendimento_esperado: rendEsperado || null,
      // rendimento na unidade do PRODUTO (ficha.unidade): un→fator 1 (sem ×1000), kg/L→×1000 p/ base
      rendimento_real: (pf(prod.rendimentoReal) * entRend.fator) || null,
      // guarda SEMPRE na unidade-base (g/ml): o valor digitado (kg/L) × fator de entrada
      peso_mestre_real: (pf(prod.pesoMestre) * entrada.fator) || null,
      peso_bruto: mestre?.insumo_fc ? ((pf(prod.pesoBruto) * entrada.fator) || null) : null,
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

  // A aba atual (Cozinha/Bar) só mostra as produções ativas DAQUELA seção. O "retomar por
  // bar" recupera TODOS os rascunhos (as duas seções) — sem este filtro a lista vinha tudo
  // junto e confusa (Bar + Cozinha misturados, ver docs/retomarProducao.jpeg). Os timers e o
  // autosave continuam operando sobre `prods` inteiro (as duas seções seguem rodando/salvando).
  const prodsSecao = useMemo(
    () => prods.filter(p => secaoDeCodigo(p.ficha?.codigo) === secaoAtiva),
    [prods, secaoAtiva]
  );
  const sel = prodsSecao.find(p => p.localId === selId) || null;
  // ao trocar de seção (ou remover o selecionado), mantém uma seleção válida dentro da aba
  useEffect(() => {
    if (selId && prodsSecao.some(p => p.localId === selId)) return;
    setSelId(prodsSecao.length ? prodsSecao[prodsSecao.length - 1].localId : null);
  }, [secaoAtiva, prodsSecao, selId]);

  // Resumo "retomar" também filtrado pela aba (Cozinha/Bar) — não mistura mais as seções.
  const resumivelSecao = useMemo(
    () => (resumivel || []).filter((p: any) => secaoDeCodigo(p.ficha?.codigo) === secaoAtiva),
    [resumivel, secaoAtiva]
  );

  return (
    <div className="space-y-4">
      {/* Monitor ao vivo (atualiza a cada 8s): produções EM ANDAMENTO NO BAR que estão sob outro
          aparelho. Só pra acompanhar — ou "Retomar" pra ASSUMIR a posse (vira dono único aqui, e
          sai da tela do aparelho de origem). Filtrado pela seção (Cozinha/Bar) da aba. */}
      {resumivelSecao.length > 0 && (
        <Card className="card-dark border-amber-300 dark:border-amber-800">
          <CardContent className="py-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <History className="w-4 h-4 shrink-0" />
                <span><b>{resumivelSecao.length}</b> produção(ões) de <b>{secaoAtiva}</b> em andamento em outro aparelho do bar. Acompanhe aqui, ou <b>Retomar</b> pra assumir a posse neste aparelho.</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {resumivelSecao.map((p: any, i: number) => {
                const resp = responsaveis.find((r: any) => r.id === p.responsavelId);
                const nItens = Array.isArray(p.itens) ? p.itens.length : 0;
                return (
                  <div key={p.localId || i} className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={p.ficha?.nome}>{p.ficha?.nome || 'Produção'}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-1 ${p.rodando ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {p.rodando ? <><Play className="w-3 h-3" />rodando</> : <><Pause className="w-3 h-3" />pausada</>}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /><span className="tabular-nums">{fmtCrono(elapsedOf(p, nowTick))}</span></span>
                      {resp && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{resp.nome}</span>}
                      {inicioDe(p) && <span className="inline-flex items-center gap-1" title="Quando a produção começou"><CalendarCheck className="w-3 h-3" />Início {fmtData(inicioDe(p))}</span>}
                      {p.dataProducao && <span>Data {fmtDM(p.dataProducao)}</span>}
                    </div>
                    {(p.ficha?.codigo || nItens > 0) && <div className="text-[10px] text-gray-400 mt-0.5">{p.ficha?.codigo || ''}{p.ficha?.codigo && nItens ? ' · ' : ''}{nItens ? `${nItens} itens` : ''}</div>}
                    <div className="mt-2 flex items-center gap-1.5">
                      <Button size="sm" onClick={() => retomarUma(p)} className="flex-1 h-7 bg-amber-600 hover:bg-amber-700"><RotateCcw className="w-3.5 h-3.5 mr-1" />Retomar esta</Button>
                      {podeExcluirRascunho && (
                        <Button size="sm" variant="ghost" onClick={() => descartarRascunho(p)} title="Descartar este rascunho"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-500/10 shrink-0"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1"><Plus className="w-4 h-4" />Iniciar produção {secaoAtiva === 'Cozinha' ? '👨‍🍳' : '🍺'} <span className="text-gray-400 font-normal">{secaoAtiva}</span></span>
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

          {/* Tabs das produções ativas (timers simultâneos) — só as da seção da aba atual */}
          {prodsSecao.length > 0 && (
            <div className="pt-1 space-y-1">
              <div className="flex flex-wrap gap-1.5">
                {prodsSecao.map(p => (
                  <button key={p.localId} onClick={() => setSelId(p.localId)}
                    className={`group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${selId === p.localId ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                    <span className={`w-2 h-2 rounded-full ${p.rodando ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[160px] truncate">{p.ficha.nome}</span>
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{fmtTempo(elapsedOf(p, nowTick))}</span>
                    <span onClick={(e) => { e.stopPropagation(); pedirDescartar(p); }} className="text-gray-300 hover:text-red-500" title="Descartar"><X className="w-3.5 h-3.5" /></span>
                  </button>
                ))}
              </div>
              {/* Indicador de autosave — dá segurança pro operador ("pode recarregar, tá salvo") e
                  denuncia quando cai a conexão (aí o dado fica só no aparelho até voltar). */}
              {saveInfo && (
                <div className={`flex items-center gap-1 text-[11px] ${saveInfo.status === 'salvo' ? 'text-emerald-600 dark:text-emerald-400' : saveInfo.status === 'offline' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                  {saveInfo.status === 'salvando' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveInfo.status === 'salvo' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {saveInfo.status === 'salvando' ? 'Salvando…' : saveInfo.status === 'salvo' ? 'Progresso salvo no servidor — pode recarregar sem perder' : 'Sem conexão com o servidor — salvo só neste aparelho por enquanto'}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhe da produção selecionada */}
      {!sel ? (
        <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400"><Timer className="w-10 h-10 mx-auto mb-2 opacity-40" />Adicione uma produção acima para iniciar. Você pode ter várias rodando ao mesmo tempo.</CardContent></Card>
      ) : (() => {
        const { mestre, mestreQtd, baseMestre, entrada, entRend, proporcao, linhas, custoPlan, custoReal, rendEsperado } = calc(sel);
        const mestreFc = !!mestre?.insumo_fc;
        const pbNum = pf(sel.pesoBruto) || 0;
        const plNum = pf(sel.pesoMestre) || 0;
        const fcReal = mestreFc && pbNum > 0 && plNum > 0 ? plNum / pbNum : 0; // aproveitamento (líquido/bruto), 0–1 — mesma convenção do FC da ficha
        // retroativa: data passada → não tem cronômetro (já foi feita); libera os campos sem precisar iniciar
        const retroativa = !!sel.dataProducao && sel.dataProducao !== new Date().toISOString().slice(0, 10);
        const iniciada = sel.rodando || elapsedOf(sel, nowTick) > 0 || retroativa; // peso/rendimento liberam ao iniciar OU se for retroativa
        const t = !!sel.tentouSalvar;                       // já clicou em salvar → destaca obrigatórios vazios
        const errResp = t && !sel.responsavelId;            // responsável vazio
        const errRend = t && !sel.rendimentoReal.trim();    // rendimento real vazio
        const errUsado = (l: any) => t && usadoVazio(sel, l.it); // "Usado" vazio (não-mestre)
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
                  <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-300 leading-tight">{fmtTempo(elapsedOf(sel, nowTick))}</div>
                </div>
                {!sel.rodando
                  ? <Button size="sm" onClick={() => iniciar(sel)} className="bg-green-600 hover:bg-green-700"><Play className="w-4 h-4 mr-1" />{elapsedOf(sel, nowTick) > 0 ? 'Continuar' : 'Iniciar'}</Button>
                  : <Button size="sm" onClick={() => patch(sel.localId, { rodando: false, segundos: elapsedOf(sel), rodandoDesde: null })} variant="outline"><Pause className="w-4 h-4 mr-1" />Pausar</Button>}
                <Button size="sm" variant="ghost" onClick={() => pedirZerar(sel)} title="Zerar tempo"><RotateCcw className="w-4 h-4" /></Button>
              </div>
            </div>

            {!iniciada && <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><Play className="w-3 h-3" />Selecione o responsável e <b>inicie a produção</b> antes de pesar o bruto e lançar o rendimento.</div>}

            {/* data da produção (permite lançamento retroativo — ex.: esqueceram de iniciar no dia) */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 flex items-center gap-1"><CalendarCheck className="w-3.5 h-3.5" />Data da produção:</span>
              <Input type="date" value={sel.dataProducao || new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)}
                onChange={e => patch(sel.localId, { dataProducao: e.target.value })} className="h-8 w-40" />
              {retroativa && <span className="text-amber-600 dark:text-amber-400 font-medium">retroativa · sem cronômetro (já foi feita)</span>}
            </div>

            {/* Responsável + peso mestre + rendimento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><User className="w-3.5 h-3.5" />Responsável *</label>
                <select value={sel.responsavelId ?? ''} onChange={e => patch(sel.localId, { responsavelId: e.target.value ? Number(e.target.value) : null })}
                  className={`h-10 w-full rounded-md border bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white ${errResp ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  <option value="">Selecione…</option>
                  {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}{r.cargo ? ` (${r.cargo})` : ''}</option>)}
                </select>
                {errResp && <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">Obrigatório — selecione o responsável.</p>}
              </div>
              {mestreFc ? (
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5" />Peso do mestre{entrada.unidade ? ` (${entrada.unidade})` : ''} <span className="text-amber-500 font-medium">· FC</span></label>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] w-12 text-gray-400 shrink-0">Bruto</span>
                      <Input type="text" inputMode="decimal" step="any" disabled={!iniciada} value={sel.pesoBruto} onChange={e => patch(sel.localId, { pesoBruto: e.target.value })} placeholder={`antes de limpar · em ${entrada.unidade || 'un'}`} className="h-9" />
                    </div>
                    <AvisoUnidade valorBase={pbNum * entrada.fator} esperadoBase={mestreQtd} base={baseMestre} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] w-12 text-gray-400 shrink-0">Líquido</span>
                      <Input type="text" inputMode="decimal" step="any" disabled={!iniciada} value={sel.pesoMestre} onChange={e => patch(sel.localId, { pesoMestre: e.target.value })} placeholder={`limpo · ficha ${fmtPeso(mestreQtd, baseMestre)}`} className="h-9" />
                    </div>
                    <AvisoUnidade valorBase={plNum * entrada.fator} esperadoBase={mestreQtd} base={baseMestre} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {(() => { const fcEsp = Number((mestre as any)?.fator_correcao) || 0; return fcReal > 0 ? (
                      <>FC real <b className={fcEsp > 0 && fcReal < fcEsp - 0.02 ? 'text-red-600 dark:text-red-400' : fcEsp > 0 && fcReal > fcEsp + 0.02 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}>{fmtNum(fcReal, 2)}</b>
                        {fcEsp > 0 && fcEsp !== 1 ? ` · esperado ${fmtNum(fcEsp, 2)} (ficha)` : ''} · </>
                    ) : ''; })()}o líquido dirige a receita</p>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5" />Peso real do mestre{mestre && entrada.unidade ? ` (${entrada.unidade})` : ''}</label>
                  <Input type="text" inputMode="decimal" step="any" value={sel.pesoMestre} onChange={e => patch(sel.localId, { pesoMestre: e.target.value })}
                    placeholder={mestre ? `ficha: ${fmtPeso(mestreQtd, baseMestre)}` : 'sem insumo mestre'} disabled={!mestre || !iniciada} className="h-10" />
                  {mestre && <AvisoUnidade valorBase={plNum * entrada.fator} esperadoBase={mestreQtd} base={baseMestre} />}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Package className="w-3.5 h-3.5" />Rendimento real{(entRend.unidade || sel.ficha.unidade) ? ` (${entRend.unidade || sel.ficha.unidade})` : ''} * {rendEsperado > 0 && <span className="text-gray-400">· meta {fmtNum(rendEsperado / entRend.fator, 3)} {entRend.unidade || sel.ficha.unidade || ''}</span>}</label>
                <Input type="text" inputMode="decimal" step="any" disabled={!iniciada} value={sel.rendimentoReal} onChange={e => patch(sel.localId, { rendimentoReal: e.target.value })} placeholder="produzido…" className={`h-10 ${errRend ? 'border-red-500 ring-1 ring-red-500' : ''}`} />
                {errRend && <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">Obrigatório — informe o rendimento produzido.</p>}
                <AvisoUnidade valorBase={(pf(sel.rendimentoReal) || 0) * entRend.fator} esperadoBase={rendEsperado} base={sel.ficha.unidade} />
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
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Informe o <b>usado</b> de cada insumo (obrigatório).</span>
                <button type="button" onClick={() => preencherCalculado(sel)}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                  <Scale className="w-3.5 h-3.5" />Preencher c/ o calculado
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                  <th className="text-left font-medium px-2 py-1.5">Insumo</th>
                  <th className="text-right font-medium px-2 py-1.5">Planejado</th>
                  <th className="text-right font-medium px-2 py-1.5">Calculado</th>
                  <th className="text-right font-medium px-2 py-1.5 w-28">Usado *</th>
                  <th className="text-right font-medium px-2 py-1.5">Desvio</th>
                  <th className="text-right font-medium px-2 py-1.5">Custo real</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sel.loadingItens ? <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  : linhas.length === 0 ? <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400">Ficha sem componentes.</td></tr>
                  : linhas.map(l => {
                    // Mestre é exibido na MESMA unidade amigável do campo de peso (kg/L) pra não
                    // conflitar com o "(kg)" do input; os demais seguem a base do insumo (g/ml/un).
                    const uFat = l.it.is_mestre ? (entrada.fator || 1) : 1;
                    const uLbl = l.it.is_mestre ? (entrada.unidade || '') : (l.it.unidade_exib || '');
                    return (
                    <tr key={l.it.id} className={l.it.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                      <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">
                        {l.it.is_mestre && <span className="text-amber-500 mr-1" title="Insumo mestre">★</span>}
                        {l.it.nome_componente || l.it.componente_codigo || `#${l.it.id}`}
                        <span className="text-xs text-gray-400 ml-1">{uLbl}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtNum(l.qtdPlan / uFat, 3)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(l.qtdCalc / uFat, 3)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {l.it.is_mestre
                          ? <span className="text-xs text-gray-400">via peso ↑</span>
                          : <Input type="text" inputMode="decimal" step="any" value={sel.qtdReal[l.it.id] ?? ''} onChange={e => patch(sel.localId, { qtdReal: { ...sel.qtdReal, [l.it.id]: e.target.value } })}
                              placeholder="obrigatório" className={`h-8 text-right text-sm ${errUsado(l) ? 'border-red-500 ring-1 ring-red-500' : ''}`} />}
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
                  );
                })}
                </tbody>
              </table>
            </div>

            {/* Observação + ações */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              <Input value={sel.observacao} onChange={e => patch(sel.localId, { observacao: e.target.value })} placeholder="Observação (opcional)…" className="flex-1" />
              <Button variant="outline" onClick={() => pedirDescartar(sel)} className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4 mr-1" />Descartar</Button>
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
                  <div className="text-gray-700 dark:text-gray-300">Você digitou <b>{fmtPeso(s.valor, s.unidade)}</b> — esperado ~<b>{fmtPeso(s.esperado, s.unidade)}</b>.</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmar(null)}>Voltar e corrigir</Button>
              <Button onClick={() => executarSalvar(confirmar.prod)} disabled={salvandoId === confirmar.prod.localId} className="bg-amber-600 hover:bg-amber-700">
                {salvandoId === confirmar.prod.localId ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}Está correto, salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de ação destrutiva (descartar / zerar) — evita perda por toque acidental */}
      {confirmarAcao && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmarAcao(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-semibold">{confirmarAcao.tipo === 'descartar' ? 'Descartar produção?' : 'Zerar o tempo?'}</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {confirmarAcao.tipo === 'descartar'
                ? <>Isso apaga <b>{confirmarAcao.nome}</b> e tudo que você já lançou (tempo, pesos, anotações). Não dá pra desfazer.</>
                : <>Isso volta o cronômetro de <b>{confirmarAcao.nome}</b> pra zero. Os campos preenchidos continuam.</>}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmarAcao(null)}>Voltar</Button>
              <Button onClick={confirmarAcaoExec} className="bg-red-600 hover:bg-red-700">
                {confirmarAcao.tipo === 'descartar' ? 'Sim, descartar' : 'Sim, zerar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação anti-duplicata: já existe essa produção em andamento neste aparelho */}
      {confirmarDup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmarDup(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-semibold">Já está em andamento</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <b>{confirmarDup.nome}</b> já está aberta neste aparelho. Se quer só continuar a que já começou, toque em <b>Voltar</b> e use o card existente. Só adicione outra se for mesmo uma <b>segunda fornada</b>.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmarDup(null)}>Voltar</Button>
              <Button onClick={() => { const f = confirmarDup; setConfirmarDup(null); void _adicionar(f); }} className="bg-amber-600 hover:bg-amber-700">
                Adicionar 2ª fornada
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
