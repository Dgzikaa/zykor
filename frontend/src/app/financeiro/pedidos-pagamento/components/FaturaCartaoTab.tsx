'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ColumnFilterHeader, useColumnFilters, type FilterCol } from '@/components/ui/column-filter-header';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { getSelectedBarId } from '@/lib/selected-bar';
import { Loader2, Upload, Send, EyeOff, RotateCcw, CheckCircle2, Plus, CreditCard, Lock, Archive, Trash2 } from 'lucide-react';

interface Cartao { id: string; banco: string; tipo: string; dono: string }
interface Fatura {
  id: string; bar_id: number; vencimento: string; valor_informado: number | null;
  status: string; cartao?: Cartao;
  totais?: { total: number; lancado: number; novos: number };
}
interface Linha {
  id: string; banco: string; data_transacao: string; descricao: string; valor: number;
  tipo: 'compra' | 'pagamento' | 'estorno'; parcela: string | null; cartao_final: string | null;
  titular_nome: string | null; bar_id: number | null; categoria_id: string | null;
  categoria_nome: string | null; contaazul_lancamento_id: string | null; status: 'novo' | 'lancado' | 'ignorado';
}
interface Opcao { value: string; label: string }
interface OpcoesBar { categorias: Opcao[]; fornecedores: Opcao[]; contas: Opcao[] }

// Colunas com filtro tipo Excel no cabeçalho (substitui o antigo dropdown "Todos os cartões").
const CARTAO_SEM = '— sem —';
const FILTER_COLS: FilterCol<Linha>[] = [
  { id: 'cartao_final', get: (l) => (l.cartao_final ? `••${l.cartao_final}` : CARTAO_SEM) },
  { id: 'titular_nome', get: (l) => l.titular_nome || CARTAO_SEM },
  { id: 'categoria_nome', get: (l) => l.categoria_nome || '— sem categoria —' },
];

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDataBR = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—'); };
const BANCO_LABEL: Record<string, string> = { itau: 'Itaú', nubank: 'Nubank' };
const bancoNome = (b?: string) => BANCO_LABEL[b || ''] || (b ? b[0].toUpperCase() + b.slice(1) : '');
const cartaoNome = (c?: Cartao) => (c ? `${bancoNome(c.banco)} ${c.tipo} ${c.dono}` : 'Cartão');

export function FaturaCartaoTab() {
  const { showToast } = useToast();
  const { availableBars, selectedBar } = useBar();

  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [encerradas, setEncerradas] = useState<Fatura[]>([]);
  const [verEncerradas, setVerEncerradas] = useState(false);
  const [faturaSelId, setFaturaSelId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [lancandoId, setLancandoId] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  // #25 — seleção p/ lançar várias linhas de uma vez.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [lancandoLote, setLancandoLote] = useState(false);
  const toggleSel = (id: string) => setSelecionadas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // #— Fornecedor escolhido por linha ao lançar (pedido do Gonza). Default = titular do cartão;
  // aqui dá pra trocar pontualmente sem mexer no vínculo do cartão. Vazio = usa o titular (mapa).
  const [fornOverride, setFornOverride] = useState<Record<string, string>>({});

  const [opcoesBar, setOpcoesBar] = useState<Record<number, OpcoesBar>>({});
  const [config, setConfig] = useState<Record<number, { fornecedorId: string; contaId: string }>>({});

  // Filtros dentro da fatura
  const [fBusca, setFBusca] = useState('');
  const [soCompras, setSoCompras] = useState(true);
  const [esconderLancados, setEsconderLancados] = useState(false);

  // Modais
  const [cartoesOpen, setCartoesOpen] = useState(false);

  const faturaSel = useMemo(() => [...faturas, ...encerradas].find(f => f.id === faturaSelId) || null, [faturas, encerradas, faturaSelId]);

  const carregarBase = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([
        api.get('/api/financeiro/cartao-fatura/cartoes'),
        api.get('/api/financeiro/cartao-fatura/faturas?status=aberta'),
      ]);
      setCartoes(c.cartoes || []);
      setFaturas(f.faturas || []);
      setFaturaSelId(prev => prev || (f.faturas?.[0]?.id ?? null));
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message });
    }
  }, [showToast]);

  const carregarEncerradas = useCallback(async () => {
    try {
      const f = await api.get('/api/financeiro/cartao-fatura/faturas?status=encerrada');
      setEncerradas(f.faturas || []);
    } catch { /* ok */ }
  }, []);

  const carregarLinhas = useCallback(async (fid: string) => {
    setCarregando(true);
    try {
      const res = await api.get(`/api/financeiro/cartao-fatura/faturas/${fid}`);
      setLinhas(res.linhas || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar linhas', message: e?.message });
    } finally {
      setCarregando(false);
    }
  }, [showToast]);

  const carregarOpcoesBar = useCallback(async (barId: number) => {
    const j = (p: Promise<Response>) => p.then(r => r.json()).catch(() => ({}));
    const [cat, fo, ct] = await Promise.all([
      j(fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}&tipo=DESPESA`)),
      j(fetch(`/api/financeiro/contaazul/stakeholders?bar_id=${barId}&perfil=FORNECEDOR`)),
      j(fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}&somente_pagadoras=true`)),
    ]);
    const contasRaw = (ct.contas_financeiras || []).filter((c: any) => c.ativo !== false);
    const fornecedoresRaw = (fo.pessoas || []);
    setOpcoesBar(prev => ({
      ...prev,
      [barId]: {
        categorias: (cat.categorias || []).filter((c: any) => c.ativo !== false).map((c: any) => ({ value: c.contaazul_id, label: c.nome || c.categoria_nome })),
        fornecedores: fornecedoresRaw.map((p: any) => ({ value: p.contaazul_id, label: p.nome })),
        contas: contasRaw.map((c: any) => ({ value: String(c.contaazul_id), label: c.banco ? `${c.nome} (${c.banco})` : c.nome })),
      },
    }));
    const padrao = contasRaw.find((c: any) => c.pagadora_padrao);
    setConfig(prev => {
      const cur = prev[barId] || { fornecedorId: '', contaId: '' };
      return { ...prev, [barId]: { fornecedorId: cur.fornecedorId, contaId: cur.contaId || (padrao ? String(padrao.contaazul_id) : '') } };
    });
  }, []);

  // De-para "Fornecedor por cartão" (cartao_final → titular no CA). Carregado por bar.
  const [mapaCartao, setMapaCartao] = useState<Record<number, Record<string, { contaazul_pessoa_id: string; nome: string | null }>>>({});
  const carregarMapaCartao = useCallback(async (barId: number) => {
    try {
      const r = await api.get(`/api/financeiro/cartao-fatura/fornecedor-cartao?bar_id=${barId}`);
      const m: Record<string, { contaazul_pessoa_id: string; nome: string | null }> = {};
      (r.mapa || []).forEach((x: any) => { if (x.cartao_final) m[x.cartao_final] = { contaazul_pessoa_id: x.contaazul_pessoa_id, nome: x.nome }; });
      setMapaCartao(prev => ({ ...prev, [barId]: m }));
    } catch { /* ok */ }
  }, []);

  // De-para aprendido "estabelecimento → categoria" (financial.cartao_categoria_map), por bar.
  // Alimenta a sugestão automática de categoria. Aprende sozinho a cada lançamento (no backend).
  type CatMapRow = { keyword: string; categoria_id: string | null; categoria_nome: string | null; hits: number };
  const [mapaCategoria, setMapaCategoria] = useState<Record<number, CatMapRow[]>>({});
  const carregarMapaCategoria = useCallback(async (barId: number) => {
    try {
      const r = await api.get(`/api/financeiro/cartao-fatura/categoria-sugestao?bar_id=${barId}`);
      setMapaCategoria(prev => ({ ...prev, [barId]: (r.mapa || []) as CatMapRow[] }));
    } catch { /* ok */ }
  }, []);

  useEffect(() => { carregarBase(); }, [carregarBase]);
  useEffect(() => { availableBars.forEach(b => { carregarOpcoesBar(b.id); carregarMapaCartao(b.id); carregarMapaCategoria(b.id); }); }, [availableBars, carregarOpcoesBar, carregarMapaCartao, carregarMapaCategoria]);
  useEffect(() => { if (faturaSelId) carregarLinhas(faturaSelId); else setLinhas([]); }, [faturaSelId, carregarLinhas]);
  useEffect(() => { if (verEncerradas) carregarEncerradas(); }, [verEncerradas, carregarEncerradas]);

  // Sugestão automática de categoria por estabelecimento (só p/ linhas novas sem categoria).
  // Deriva do de-para aprendido; não grava nada até a pessoa lançar (aí o backend confirma+aprende).
  const sugestoes = useMemo(() => {
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const out: Record<string, { categoria_id: string; categoria_nome: string }> = {};
    for (const l of linhas) {
      if (l.status !== 'novo' || l.categoria_id || l.tipo !== 'compra') continue;
      const bar = l.bar_id ?? faturaSel?.bar_id ?? selectedBar?.id ?? null;
      if (!bar) continue;
      const rows = mapaCategoria[bar];
      const cats = opcoesBar[bar]?.categorias;
      if (!rows?.length || !cats?.length) continue;
      const dn = norm(l.descricao);
      // rows já vêm por hits desc; casa por substring da keyword e só aceita categoria válida do bar
      const hit = rows.find(r => r.keyword && r.categoria_id && dn.includes(r.keyword)
        && cats.some(c => c.value === r.categoria_id));
      if (hit?.categoria_id) {
        out[l.id] = {
          categoria_id: hit.categoria_id,
          categoria_nome: hit.categoria_nome || (cats.find(c => c.value === hit.categoria_id)?.label ?? ''),
        };
      }
    }
    return out;
  }, [linhas, mapaCategoria, opcoesBar, faturaSel, selectedBar]);

  const importar = async (file: File) => {
    if (!faturaSelId) return;
    setLendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fatura_id', faturaSelId);
      const barId = getSelectedBarId();
      const res = await fetch('/api/financeiro/cartao-fatura/importar', { method: 'POST', headers: barId ? { 'x-selected-bar-id': barId } : {}, body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'falha ao importar');
      setLinhas(json.linhas || []);
      // #23 — o arquivo do Itaú traz vencimento/valor no cabeçalho; avisa que foi puxado.
      const extra = json.vencimento_arquivo ? ` · vencimento ${fmtDataBR(json.vencimento_arquivo)} e valor do arquivo` : '';
      showToast({ type: 'success', title: `${BANCO_LABEL[json.banco] || json.banco} · ${json.importadas} linhas`, message: `${json.novos} novas, ${json.ja_vistos} já na fatura${extra}.` });
      carregarBase();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao importar', message: e?.message });
    } finally {
      setLendo(false);
    }
  };

  const patchLinha = async (l: Linha, updates: Partial<Linha>) => {
    setLinhas(prev => prev.map(x => (x.id === l.id ? { ...x, ...updates } : x)));
    try { await api.patch(`/api/financeiro/cartao-fatura/${l.id}`, updates); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); if (faturaSelId) carregarLinhas(faturaSelId); }
  };

  const lancar = async (l: Linha) => {
    const bar = l.bar_id || faturaSel?.bar_id || selectedBar?.id || null;
    if (!bar) return showToast({ type: 'error', title: 'Escolha o bar da linha' });
    const catId = l.categoria_id || sugestoes[l.id]?.categoria_id || null;
    const catNome = l.categoria_nome || sugestoes[l.id]?.categoria_nome || null;
    if (!catId) return showToast({ type: 'error', title: 'Escolha a categoria' });
    const cfg = config[bar];
    setLancandoId(l.id);
    try {
      const res = await api.post(`/api/financeiro/cartao-fatura/${l.id}/lancar`, {
        bar_id: bar, categoria_id: catId, categoria_nome: catNome,
        conta_financeira_id: cfg?.contaId || undefined,
        pessoa_id: fornOverride[l.id] || undefined, // vazio → backend usa o titular do cartão
        data_vencimento: faturaSel?.vencimento || undefined,
      });
      setLinhas(prev => prev.map(x => (x.id === l.id ? res.linha : x)));
      showToast({ type: 'success', title: 'Lançado no Conta Azul' });
      carregarBase();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally {
      setLancandoId(null);
    }
  };

  // #25 — lança em LOTE as linhas selecionadas que já têm bar + categoria. Sequencial (sem rajada).
  const lancarLote = async () => {
    const alvos = filtradas.filter(l => selecionadas.has(l.id) && l.tipo === 'compra' && l.status === 'novo');
    const prontos = alvos.filter(l => (l.bar_id ?? faturaSel?.bar_id ?? selectedBar?.id) && (l.categoria_id || sugestoes[l.id]?.categoria_id));
    const semDados = alvos.length - prontos.length;
    if (!prontos.length) return showToast({ type: 'warning', title: 'Nada pronto pra lançar', message: 'Faltam bar/categoria nas linhas selecionadas.' });
    if (!window.confirm(`Lançar ${prontos.length} linha(s) no Conta Azul?${semDados ? `\n${semDados} sem bar/categoria ficam de fora.` : ''}`)) return;
    setLancandoLote(true);
    let ok = 0, err = 0;
    for (const l of prontos) {
      const bar = (l.bar_id ?? faturaSel?.bar_id ?? selectedBar?.id) as number;
      const cfg = config[bar];
      try {
        const res = await api.post(`/api/financeiro/cartao-fatura/${l.id}/lancar`, {
          bar_id: bar, categoria_id: l.categoria_id || sugestoes[l.id]?.categoria_id, categoria_nome: l.categoria_nome || sugestoes[l.id]?.categoria_nome,
          conta_financeira_id: cfg?.contaId || undefined,
          pessoa_id: fornOverride[l.id] || undefined, // vazio → backend usa o titular do cartão
          data_vencimento: faturaSel?.vencimento || undefined,
        });
        setLinhas(prev => prev.map(x => (x.id === l.id ? res.linha : x)));
        ok++;
      } catch { err++; }
    }
    setLancandoLote(false);
    setSelecionadas(new Set());
    showToast({ type: err ? 'warning' : 'success', title: `${ok} lançada(s)`, message: [err ? `${err} com erro` : '', semDados ? `${semDados} puladas (dados faltando)` : ''].filter(Boolean).join(' · ') || undefined });
    carregarBase();
  };

  const encerrarFatura = async () => {
    if (!faturaSel) return;
    const naoLancados = linhas.filter(l => l.tipo === 'compra' && l.status === 'novo').length;
    const msg = naoLancados > 0
      ? `Ainda há ${naoLancados} compra(s) sem lançar. Encerrar mesmo assim?`
      : 'Encerrar esta fatura? Ela sai das faturas abertas.';
    if (!window.confirm(msg)) return;
    setEncerrando(true);
    try {
      await api.patch(`/api/financeiro/cartao-fatura/faturas/${faturaSel.id}`, { status: 'encerrada' });
      showToast({ type: 'success', title: 'Fatura encerrada' });
      setFaturaSelId(null);
      await carregarBase();
      if (verEncerradas) carregarEncerradas();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao encerrar', message: e?.message });
    } finally {
      setEncerrando(false);
    }
  };

  const [excluindoFatura, setExcluindoFatura] = useState(false);
  const excluirFatura = async (f: Fatura) => {
    const mesma = f.id === faturaSel?.id;
    const lancadas = (mesma ? linhas : []).filter(l => l.status === 'lancado').length;
    const nLinhas = mesma ? linhas.length : undefined;
    const base = `Excluir a fatura de ${cartaoNome(f.cartao)} (vence ${fmtDataBR(f.vencimento)})${nLinhas != null ? ` e suas ${nLinhas} linhas` : ' e todas as linhas dela'}? Não dá pra desfazer.`;
    const alerta = lancadas > 0 ? `\n\n⚠ ${lancadas} linha(s) já foram LANÇADAS no Conta Azul. Excluir aqui NÃO remove do CA.` : '';
    if (!window.confirm(base + alerta)) return;
    setExcluindoFatura(true);
    try {
      await api.delete(`/api/financeiro/cartao-fatura/faturas/${f.id}${lancadas > 0 ? '?force=1' : ''}`);
      showToast({ type: 'success', title: 'Fatura excluída' });
      if (faturaSelId === f.id) setFaturaSelId(null);
      await carregarBase();
      if (verEncerradas) carregarEncerradas();
    } catch (e: any) {
      // 409 = tem lançadas e não veio force → repergunta com force
      if (String(e?.message || '').includes('já lançadas') || e?.status === 409) {
        if (window.confirm('Há linhas já lançadas no Conta Azul. Excluir mesmo assim (não remove do CA)?')) {
          try { await api.delete(`/api/financeiro/cartao-fatura/faturas/${f.id}?force=1`); showToast({ type: 'success', title: 'Fatura excluída' }); if (faturaSelId === f.id) setFaturaSelId(null); await carregarBase(); }
          catch (e2: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e2?.message }); }
        }
      } else {
        showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message });
      }
    } finally { setExcluindoFatura(false); }
  };

  const reabrir = async (f: Fatura) => {
    try {
      await api.patch(`/api/financeiro/cartao-fatura/faturas/${f.id}`, { status: 'aberta' });
      showToast({ type: 'success', title: 'Fatura reaberta' });
      await carregarBase(); carregarEncerradas(); setFaturaSelId(f.id);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao reabrir', message: e?.message }); }
  };

  // Base = filtros livres (só compras / esconder lançados / busca); os filtros de coluna operam sobre ela.
  const base = useMemo(() => linhas.filter(l => {
    if (soCompras && l.tipo !== 'compra') return false;
    if (esconderLancados && l.status === 'lancado') return false;
    if (fBusca && !l.descricao.toLowerCase().includes(fBusca.toLowerCase())) return false;
    return true;
  }), [linhas, soCompras, esconderLancados, fBusca]);
  const { setCol, colFilter, optionsByCol, view: filtradas, anyCol, clearAll } = useColumnFilters(base, FILTER_COLS);
  const totalCompras = useMemo(() => linhas.filter(l => l.tipo === 'compra').reduce((s, l) => s + l.valor, 0), [linhas]);
  const totalLancado = useMemo(() => linhas.filter(l => l.tipo === 'compra' && l.status === 'lancado').reduce((s, l) => s + l.valor, 0), [linhas]);
  const pendentes = useMemo(() => linhas.filter(l => l.tipo === 'compra' && l.status === 'novo').length, [linhas]);

  const editavelFatura = faturaSel?.status === 'aberta';
  // Linhas que dá pra selecionar/lançar (compra pendente numa fatura aberta).
  const lancaveis = useMemo(() => filtradas.filter(l => editavelFatura && l.tipo === 'compra' && l.status === 'novo'), [filtradas, editavelFatura]);
  const todasSel = lancaveis.length > 0 && lancaveis.every(l => selecionadas.has(l.id));
  const toggleTodas = () => setSelecionadas(prev => {
    if (lancaveis.every(l => prev.has(l.id))) { const n = new Set(prev); lancaveis.forEach(l => n.delete(l.id)); return n; }
    const n = new Set(prev); lancaveis.forEach(l => n.add(l.id)); return n;
  });
  useEffect(() => { setSelecionadas(new Set()); setFornOverride({}); }, [faturaSelId]);

  // ===== Fornecedor por cartão (titular) =====
  // O cartão tem UM titular (fornecedor), fixo — independe do bar. O bar da linha é só ONDE vai
  // ser lançado (CA/Inter). Como cada bar é uma empresa no CA (contatos próprios), ao vincular
  // propagamos o mesmo titular pra TODOS os bares (acha por nome no CA de cada um, ou cria).
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const barFatura = faturaSel?.bar_id ?? selectedBar?.id ?? null;
  type CartaoResumo = { cartao_final: string; titular_nome: string | null; banco: string | null };

  // acha o mesmo titular no CA de um bar por nome (1º + último token) — p/ propagar o vínculo
  const acharFornecedor = useCallback((bar: number, nome: string | null) => {
    if (!nome) return null;
    const fos = opcoesBar[bar]?.fornecedores || [];
    const toks = norm(nome).split(/\s+/).filter(t => t.length >= 3);
    if (!toks.length) return null;
    const first = toks[0], last = toks[toks.length - 1];
    return fos.find(f => { const n = norm(f.label); return n.includes(first) && n.includes(last); }) || null;
  }, [opcoesBar]);
  // vincula o cartão ao titular e PROPAGA pra todos os bares (match por nome; cria no CA se faltar)
  const vincularCartao = async (card: CartaoResumo, pessoaId: string, nome: string | null) => {
    if (!pessoaId || !barFatura) return;
    try {
      let criados = 0;
      for (const b of availableBars) {
        const bar = b.id;
        let pid: string | null = pessoaId, pnome = nome;
        if (bar !== barFatura) {
          const achado = acharFornecedor(bar, nome);
          if (achado) { pid = achado.value; pnome = achado.label; }
          else {
            const r = await api.post('/api/financeiro/contaazul/pessoas/cadastrar', { bar_id: bar, nome: nome || '', tipo_perfil: 'Fornecedor', tipo_pessoa: 'Física' });
            pid = r.contaazul_id || null; pnome = r.nome || nome; if (pid) criados++;
            if (pid) setOpcoesBar(prev => { const bb = prev[bar]; if (!bb) return prev; return { ...prev, [bar]: { ...bb, fornecedores: [{ value: pid as string, label: pnome || '' }, ...bb.fornecedores] } }; });
          }
        }
        if (!pid) continue;
        await api.post('/api/financeiro/cartao-fatura/fornecedor-cartao', { bar_id: bar, cartao_final: card.cartao_final, banco: card.banco, titular_nome: card.titular_nome, contaazul_pessoa_id: pid, nome: pnome });
        const pidFinal = pid, pnomeFinal = pnome ?? null;
        setMapaCartao(prev => ({ ...prev, [bar]: { ...(prev[bar] || {}), [card.cartao_final]: { contaazul_pessoa_id: pidFinal, nome: pnomeFinal } } }));
      }
      showToast({ type: 'success', title: 'Cartão vinculado ao titular', message: criados ? `titular criado no CA de ${criados} bar(es)` : `vale p/ os ${availableBars.length} bares` });
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao vincular', message: e?.message }); }
  };

  // usados pela tela de Cartões (Final → Fornecedor): cadastrar+vincular e desvincular.
  const cadastrarEVincular = async (final: string, nome: string, tipo: 'Física' | 'Jurídica', doc?: string) => {
    if (!barFatura) throw new Error('Nenhum bar selecionado');
    const r = await api.post('/api/financeiro/contaazul/pessoas/cadastrar', {
      bar_id: barFatura, nome, documento: doc?.replace(/\D/g, '') || undefined, tipo_perfil: 'Fornecedor', tipo_pessoa: tipo,
    });
    const pid = r.contaazul_id; if (!pid) throw new Error('CA não retornou o id do fornecedor');
    setOpcoesBar(prev => { const b = prev[barFatura]; if (!b) return prev; return { ...prev, [barFatura]: { ...b, fornecedores: [{ value: pid, label: r.nome || nome }, ...b.fornecedores] } }; });
    await vincularCartao({ cartao_final: final, titular_nome: null, banco: null }, pid, r.nome || nome);
  };
  const desvincularCartao = async (final: string) => {
    for (const b of availableBars) {
      try { await api.delete(`/api/financeiro/cartao-fatura/fornecedor-cartao?bar_id=${b.id}&cartao_final=${encodeURIComponent(final)}`); } catch { /* ok */ }
      setMapaCartao(prev => { const bb = { ...(prev[b.id] || {}) }; delete bb[final]; return { ...prev, [b.id]: bb }; });
    }
  };

  // Hierarquia Cartão → Faturas: agrupa as faturas abertas por cartão.
  const faturasPorCartao = useMemo(() => {
    const m = new Map<string, { key: string; cartao?: Cartao; faturas: Fatura[] }>();
    for (const f of faturas) {
      const key = f.cartao?.id || `sem-${f.id}`;
      const e = m.get(key) || { key, cartao: f.cartao, faturas: [] };
      e.faturas.push(f);
      m.set(key, e);
    }
    return Array.from(m.values());
  }, [faturas]);
  const cartaoAtivo = faturaSel?.cartao?.id ?? faturasPorCartao[0]?.key ?? null;
  const faturasDoCartao = useMemo(() => faturasPorCartao.find(g => g.key === cartaoAtivo)?.faturas || [], [faturasPorCartao, cartaoAtivo]);

  return (
    <div className="space-y-3">
      {/* Cartões (agrupa as faturas abertas por cartão) + ações */}
      <div className="flex items-center gap-2 flex-wrap">
        {faturasPorCartao.map(g => {
          const ativo = g.key === cartaoAtivo;
          const novos = g.faturas.reduce((s, f) => s + (f.totais?.novos || 0), 0);
          return (
            <button key={g.key} onClick={() => setFaturaSelId(g.faturas[0]?.id ?? null)}
              className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${ativo ? 'border-blue-500 bg-blue-500/10' : 'border-[hsl(var(--border))] hover:bg-muted/40'}`}>
              <div className="font-medium flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />{cartaoNome(g.cartao)}</div>
              <div className="text-muted-foreground">{g.faturas.length} fatura{g.faturas.length > 1 ? 's' : ''}{novos ? ` · ${novos} a lançar` : ''}</div>
            </button>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => setCartoesOpen(true)}><CreditCard className="w-4 h-4 mr-1" />Cartões</Button>
        <Button size="sm" variant={verEncerradas ? 'default' : 'ghost'} onClick={() => setVerEncerradas(v => !v)}><Archive className="w-4 h-4 mr-1" />Encerradas</Button>
      </div>

      {/* Faturas do cartão selecionado */}
      {faturasDoCartao.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Faturas:</span>
          {faturasDoCartao.map(f => (
            <button key={f.id} onClick={() => setFaturaSelId(f.id)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${faturaSelId === f.id ? 'border-blue-500 bg-blue-500/10 font-medium' : 'border-[hsl(var(--border))] hover:bg-muted/40'}`}>
              vence {fmtDataBR(f.vencimento)} · {fmtBRL(f.totais?.total || 0)}{f.totais?.novos ? ` · ${f.totais.novos} a lançar` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Faturas encerradas */}
      {verEncerradas && (
        <Card><CardContent className="py-2">
          <p className="text-xs font-medium mb-1.5">Faturas encerradas</p>
          {encerradas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma.</p> : (
            <div className="space-y-1">
              {encerradas.map(f => (
                <div key={f.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate">{cartaoNome(f.cartao)} · vence {fmtDataBR(f.vencimento)} · {fmtBRL(f.totais?.total || 0)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="text-blue-600 hover:underline" onClick={() => { setFaturaSelId(f.id); }}>ver</button>
                    <button className="text-muted-foreground hover:underline" onClick={() => reabrir(f)}>reabrir</button>
                    <button className="text-muted-foreground hover:text-red-500 hover:underline" onClick={() => excluirFatura(f)} disabled={excluindoFatura}>excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      )}

      {!faturaSel ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          {faturas.length === 0 ? 'Nenhuma fatura aberta. Selecione um cartão e importe o Excel/OFX dentro da fatura.' : 'Selecione um cartão acima.'}
        </CardContent></Card>
      ) : (
        <>
          {/* Cabeçalho da fatura + total + encerrar + upload */}
          <Card><CardContent className="py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-semibold flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />{cartaoNome(faturaSel.cartao)}
                  {faturaSel.status === 'encerrada' && <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5"><Lock className="w-3 h-3" />encerrada</span>}
                </div>
                <div className="text-xs text-muted-foreground">Vencimento {fmtDataBR(faturaSel.vencimento)}</div>
              </div>
              <div className="text-right text-sm">
                <div>Total: <b className="tabular-nums">{fmtBRL(totalCompras)}</b> · lançado {fmtBRL(totalLancado)}</div>
                {faturaSel.valor_informado != null && (
                  <div className={`text-xs ${Math.abs(totalCompras - faturaSel.valor_informado) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    banco: {fmtBRL(faturaSel.valor_informado)} {Math.abs(totalCompras - faturaSel.valor_informado) < 0.01 ? '✓ bate' : `· dif ${fmtBRL(totalCompras - faturaSel.valor_informado)}`}
                  </div>
                )}
              </div>
            </div>
            {editavelFatura && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-stretch">
                <label className="flex items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-[hsl(var(--border))] py-3 hover:bg-muted/40 text-sm">
                  {lendo ? <><Loader2 className="w-4 h-4 animate-spin text-blue-500" />Lendo…</> : <><Upload className="w-4 h-4 text-muted-foreground" />Importar Excel/OFX/CSV nesta fatura</>}
                  <input type="file" accept=".xls,.xlsx,.csv,.ofx" className="hidden" disabled={lendo}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.currentTarget.value = ''; }} />
                </label>
                <Button variant="outline" onClick={encerrarFatura} disabled={encerrando}>
                  {encerrando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}Encerrar fatura
                </Button>
                <Button variant="outline" onClick={() => excluirFatura(faturaSel)} disabled={excluindoFatura}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800">
                  {excluindoFatura ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}Excluir fatura
                </Button>
              </div>
            )}
          </CardContent></Card>

          {/* (Vínculo Final → Fornecedor foi pro modal "Cartões".) */}

          {/* Filtros dentro da fatura (cartão/titular/categoria agora filtram no cabeçalho da tabela) */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Input value={fBusca} onChange={(e) => setFBusca(e.target.value)} placeholder="Buscar estabelecimento…" className="h-8 w-48 text-xs" />
            <Button size="sm" variant={soCompras ? 'default' : 'ghost'} onClick={() => setSoCompras(s => !s)}>Só compras</Button>
            <Button size="sm" variant={esconderLancados ? 'default' : 'ghost'} onClick={() => setEsconderLancados(s => !s)}>Esconder lançados</Button>
            {anyCol && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={clearAll}>✕ limpar filtros de coluna</Button>}
            {editavelFatura && selecionadas.size > 0 && (
              <Button size="sm" onClick={lancarLote} disabled={lancandoLote}>
                {lancandoLote ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Lançar selecionadas ({selecionadas.size})
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{filtradas.length} linhas · {pendentes} a lançar</span>
          </div>

          {/* Tabela */}
          {carregando ? (
            <div className="py-10 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
          ) : filtradas.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma linha. Importe o Excel/OFX da fatura acima.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
              <table className="w-full text-sm table-fixed min-w-[1180px]">
                <colgroup>
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '9%' }} />
                </colgroup>
                <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                  <tr>
                    <th className="py-2 px-2">
                      {lancaveis.length > 0 && (
                        <input type="checkbox" checked={todasSel} onChange={toggleTodas}
                          title="Selecionar todas as lançáveis" className="w-4 h-4 accent-[hsl(var(--primary))] cursor-pointer" />
                      )}
                    </th>
                    <th className="text-left py-2 px-2 font-medium">Data</th>
                    <th className="text-left py-2 px-2 font-medium">Estabelecimento</th>
                    <ColumnFilterHeader label="Titular" className="py-2" options={optionsByCol.titular_nome || []}
                      selected={colFilter.titular_nome || new Set()} onChange={(n) => setCol('titular_nome', n)} />
                    <ColumnFilterHeader label="Cartão" className="py-2" options={optionsByCol.cartao_final || []}
                      selected={colFilter.cartao_final || new Set()} onChange={(n) => setCol('cartao_final', n)} />
                    <th className="text-left py-2 px-2 font-medium">Fornecedor</th>
                    <th className="text-right py-2 px-2 font-medium">Valor</th>
                    <th className="text-left py-2 px-2 font-medium">Bar</th>
                    <ColumnFilterHeader label="Categoria" className="py-2" options={optionsByCol.categoria_nome || []}
                      selected={colFilter.categoria_nome || new Set()} onChange={(n) => setCol('categoria_nome', n)} />
                    <th className="text-right py-2 px-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(l => {
                    const barEfetivo = l.bar_id ?? faturaSel.bar_id ?? selectedBar?.id ?? null;
                    const ops = barEfetivo ? opcoesBar[barEfetivo] : undefined;
                    // Sugestão automática de categoria (só quando a linha ainda não tem uma escolhida).
                    const sug = sugestoes[l.id] || null;
                    // Fornecedor da linha = titular vinculado ao cartão. Automático: usa o vínculo
                    // do bar da linha; se ainda não carregou nesse bar, cai no vínculo de qualquer
                    // bar (o titular é a mesma pessoa) — assim nunca fica "vincular" à toa.
                    const fornecedorLinha = l.cartao_final
                      ? ((barEfetivo ? mapaCartao[barEfetivo]?.[l.cartao_final]?.nome : null)
                        ?? Object.values(mapaCartao).map(mb => mb?.[l.cartao_final as string]?.nome).find(Boolean)
                        ?? null)
                      : null;
                    // Fornecedor default = titular do cartão (mapa do bar da linha), se estiver na
                    // lista de fornecedores do CA. O override por linha vence o default.
                    const fornPadraoId = (l.cartao_final && barEfetivo)
                      ? (mapaCartao[barEfetivo]?.[l.cartao_final]?.contaazul_pessoa_id ?? null) : null;
                    const fornPadraoNaLista = !!fornPadraoId && (ops?.fornecedores || []).some(f => f.value === fornPadraoId);
                    const fornSelId = fornOverride[l.id] ?? (fornPadraoNaLista ? (fornPadraoId as string) : '');
                    const lancado = l.status === 'lancado';
                    const ignorado = l.status === 'ignorado';
                    return (
                      <tr key={l.id} className={`border-b last:border-0 ${ignorado ? 'opacity-40' : ''} ${lancado ? 'bg-green-500/5' : ''}`}>
                        <td className="px-2">
                          {editavelFatura && l.tipo === 'compra' && l.status === 'novo' && (
                            <input type="checkbox" checked={selecionadas.has(l.id)} onChange={() => toggleSel(l.id)}
                              className="w-4 h-4 accent-[hsl(var(--primary))] cursor-pointer" aria-label="Selecionar linha p/ lançar em lote" />
                          )}
                        </td>
                        <td className="py-1.5 px-2 whitespace-nowrap text-muted-foreground text-xs">{fmtDataBR(l.data_transacao)}</td>
                        <td className="px-2">
                          {editavelFatura && !lancado && !ignorado ? (
                            <div className="flex items-center gap-1">
                              {/* #24 — edita o estabelecimento antes de lançar (salva ao sair do campo) */}
                              <input defaultValue={l.descricao}
                                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== l.descricao) patchLinha(l, { descricao: v }); }}
                                title="Editar o estabelecimento antes de lançar"
                                className="h-8 flex-1 min-w-0 text-xs border rounded px-1.5 bg-background" />
                              {l.parcela ? <span className="text-muted-foreground text-xs shrink-0">· {l.parcela}</span> : null}
                            </div>
                          ) : (
                            <div className="truncate" title={l.descricao}>{l.descricao}{l.parcela ? <span className="text-muted-foreground text-xs"> · {l.parcela}</span> : ''}</div>
                          )}
                        </td>
                        <td className="px-2 text-xs"><div className="truncate" title={l.titular_nome || ''}>{l.titular_nome || '—'}</div></td>
                        <td className="px-2 text-xs text-muted-foreground whitespace-nowrap">{l.cartao_final ? `••${l.cartao_final}` : '—'}</td>
                        <td className="px-2 text-xs" title={fornecedorLinha || ''}>
                          {editavelFatura && !lancado && !ignorado ? (
                            <select value={fornSelId} disabled={!barEfetivo}
                              onChange={(e) => setFornOverride(prev => ({ ...prev, [l.id]: e.target.value }))}
                              className="h-8 w-full text-xs border rounded px-1 bg-background disabled:opacity-60">
                              <option value="">{barEfetivo ? (fornecedorLinha ? `titular: ${fornecedorLinha}` : '— fornecedor —') : 'escolha o bar'}</option>
                              {(ops?.fornecedores || []).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          ) : (
                            <div className="truncate">
                              {fornecedorLinha || <span className="text-amber-600">{l.cartao_final ? 'vincular' : '—'}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-2 text-right whitespace-nowrap font-medium tabular-nums">{fmtBRL(l.valor)}</td>
                        <td className="px-2">
                          <select value={barEfetivo ?? ''} disabled={lancado || !editavelFatura}
                            onChange={(e) => patchLinha(l, { bar_id: e.target.value ? Number(e.target.value) : null, categoria_id: null, categoria_nome: null })}
                            className="h-8 w-full text-xs border rounded px-1 bg-background disabled:opacity-60">
                            <option value="">—</option>
                            {availableBars.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                          </select>
                        </td>
                        <td className="px-2">
                          {editavelFatura && !lancado && barEfetivo ? (
                            <div className="w-full">
                              <SearchableSelect
                                portal
                                triggerClassName="h-8 text-xs"
                                className="w-full"
                                options={ops?.categorias || []}
                                value={l.categoria_id ?? sug?.categoria_id ?? ''}
                                onValueChange={(id) => patchLinha(l, { categoria_id: id || null, categoria_nome: ops?.categorias.find(c => c.value === id)?.label || null })}
                                placeholder={(ops?.categorias?.length ? '— categoria —' : 'sem categorias')}
                                searchPlaceholder="digite pra filtrar…"
                              />
                              {!l.categoria_id && sug && (
                                <span className="mt-0.5 block text-[10px] text-emerald-600 dark:text-emerald-400 truncate" title={`sugerido pelo histórico: ${sug.categoria_nome}`}>
                                  ✨ sugerido — confira e lance
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="truncate text-xs text-muted-foreground" title={l.categoria_nome || ''}>
                              {barEfetivo ? (l.categoria_nome || '—') : 'escolha o bar'}
                            </div>
                          )}
                        </td>
                        <td className="px-2 text-right whitespace-nowrap">
                          {lancado ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Lançado</span>
                          ) : editavelFatura ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button size="sm" className="h-7 px-2" onClick={() => lancar(l)} disabled={lancandoId === l.id}>
                                {lancandoId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" />Lançar</>}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" title={ignorado ? 'Reativar' : 'Ignorar'}
                                onClick={() => patchLinha(l, { status: ignorado ? 'novo' : 'ignorado' })}>
                                {ignorado ? <RotateCcw className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <CartoesDialog open={cartoesOpen} onOpenChange={setCartoesOpen} cartoes={cartoes} onMudou={carregarBase}
        barId={barFatura} fornecedores={barFatura ? (opcoesBar[barFatura]?.fornecedores || []) : []}
        onVincular={(final, pid, nome) => vincularCartao({ cartao_final: final, titular_nome: null, banco: null }, pid, nome)}
        onCadastrarEVincular={cadastrarEVincular} onDesvincular={desvincularCartao} />
    </div>
  );
}

// ---------- Modal: cartões (contas + finais → fornecedor) ----------
function CartoesDialog({ open, onOpenChange, cartoes, onMudou, barId, fornecedores, onVincular, onCadastrarEVincular, onDesvincular }: {
  open: boolean; onOpenChange: (v: boolean) => void; cartoes: Cartao[]; onMudou: () => void;
  barId: number | null; fornecedores: Opcao[];
  onVincular: (final: string, pessoaId: string, nome: string) => Promise<void>;
  onCadastrarEVincular: (final: string, nome: string, tipo: 'Física' | 'Jurídica', doc?: string) => Promise<void>;
  onDesvincular: (final: string) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [banco, setBanco] = useState('itau');
  const [tipo, setTipo] = useState('');
  const [dono, setDono] = useState('');
  const [salvando, setSalvando] = useState(false);

  const add = async () => {
    if (!tipo.trim() || !dono.trim()) return showToast({ type: 'error', title: 'Preencha tipo e dono' });
    setSalvando(true);
    try {
      await api.post('/api/financeiro/cartao-fatura/cartoes', { banco, tipo: tipo.trim(), dono: dono.trim() });
      setTipo(''); setDono('');
      showToast({ type: 'success', title: 'Conta de cartão cadastrada' });
      onMudou();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao cadastrar', message: e?.message });
    } finally { setSalvando(false); }
  };

  const [excluindo, setExcluindo] = useState<string | null>(null);
  const excluir = async (c: Cartao) => {
    if (!window.confirm(`Excluir a conta "${cartaoNome(c)}"? As faturas/lançamentos já feitos não são afetados.`)) return;
    setExcluindo(c.id);
    try {
      await api.delete(`/api/financeiro/cartao-fatura/cartoes?id=${c.id}`);
      showToast({ type: 'success', title: 'Conta excluída' });
      onMudou();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message });
    } finally { setExcluindo(null); }
  };

  // ---- Finais → Fornecedor ----
  const [finais, setFinais] = useState<{ cartao_final: string; titular_nome: string | null }[]>([]);
  const [mapa, setMapa] = useState<Record<string, { contaazul_pessoa_id: string; nome: string | null }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [novoFinal, setNovoFinal] = useState('');
  const [cadOpen, setCadOpen] = useState<string | null>(null);
  const [cadNome, setCadNome] = useState('');
  const [cadDoc, setCadDoc] = useState('');
  const [cadTipo, setCadTipo] = useState<'Física' | 'Jurídica'>('Física');

  const carregar = useCallback(async () => {
    if (!barId) return;
    try {
      const r = await api.get(`/api/financeiro/cartao-fatura/fornecedor-cartao?bar_id=${barId}`);
      const m: Record<string, { contaazul_pessoa_id: string; nome: string | null }> = {};
      (r.mapa || []).forEach((x: any) => { if (x.cartao_final) m[x.cartao_final] = { contaazul_pessoa_id: x.contaazul_pessoa_id, nome: x.nome }; });
      setMapa(m);
      setFinais(r.finais || []);
    } catch { /* ok */ }
  }, [barId]);
  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  // lista de finais = os conhecidos (das faturas) + os que já têm vínculo (mesmo sem linha)
  const listaFinais = useMemo(() => {
    const set = new Map<string, string | null>();
    for (const f of finais) set.set(f.cartao_final, f.titular_nome);
    for (const k of Object.keys(mapa)) if (!set.has(k)) set.set(k, null);
    return Array.from(set.entries()).map(([cartao_final, titular_nome]) => ({ cartao_final, titular_nome })).sort((a, b) => a.cartao_final.localeCompare(b.cartao_final));
  }, [finais, mapa]);

  const vincular = async (final: string, pessoaId: string, nome: string) => {
    setBusy(final);
    try { await onVincular(final, pessoaId, nome); await carregar(); }
    finally { setBusy(null); }
  };
  const cadastrar = async (final: string) => {
    if (!cadNome.trim()) return;
    setBusy(final);
    try { await onCadastrarEVincular(final, cadNome.trim(), cadTipo, cadDoc); setCadOpen(null); setCadNome(''); setCadDoc(''); await carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao cadastrar', message: e?.message }); }
    finally { setBusy(null); }
  };
  const desvincular = async (final: string) => {
    setBusy(final);
    try { await onDesvincular(final); await carregar(); }
    finally { setBusy(null); }
  };
  const addFinal = () => {
    const f = novoFinal.replace(/\D/g, '').slice(-4);
    if (!f) return showToast({ type: 'error', title: 'Digite o final (4 dígitos)' });
    if (!listaFinais.some(x => x.cartao_final === f)) setFinais(prev => [...prev, { cartao_final: f, titular_nome: null }]);
    setNovoFinal(''); setCadOpen(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Cartões</DialogTitle>
          <DialogDescription>Vincule cada <b>final de cartão</b> ao seu <b>fornecedor (titular)</b> — vale nos 2 bares e em todas as faturas.</DialogDescription>
        </DialogHeader>
        <div className="px-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Finais → Fornecedor */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Finais → Fornecedor (titular)</div>
            <div className="flex items-end gap-2">
              <div><Label className="mb-1 block text-xs">Adicionar final</Label><Input value={novoFinal} onChange={e => setNovoFinal(e.target.value)} placeholder="ex.: 8939" inputMode="numeric" className="h-9 w-28" /></div>
              <Button onClick={addFinal} className="h-9"><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
            </div>
            <div className="space-y-1 rounded-lg border border-[hsl(var(--border))] p-2">
              {listaFinais.length === 0 ? <p className="text-xs text-muted-foreground px-1 py-2">Nenhum final ainda. Adicione acima ou importe uma fatura.</p> :
                listaFinais.map(({ cartao_final, titular_nome }) => {
                  const atual = mapa[cartao_final];
                  return (
                    <div key={cartao_final} className="flex items-center gap-2 flex-wrap text-sm border-b last:border-0 border-[hsl(var(--border))]/60 pb-1.5 last:pb-0">
                      <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">••{cartao_final}</span>
                      {titular_nome && <span className="text-[11px] text-muted-foreground w-32 truncate shrink-0" title={`no extrato: ${titular_nome}`}>{titular_nome}</span>}
                      {atual
                        ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs min-w-40"><CheckCircle2 className="w-3.5 h-3.5" />{atual.nome || 'vinculado'}</span>
                        : <span className="text-amber-600 text-xs min-w-40">sem fornecedor</span>}
                      <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                        <SearchableSelect className="w-60" options={fornecedores} value={atual?.contaazul_pessoa_id || ''}
                          placeholder={busy === cartao_final ? 'salvando…' : 'vincular fornecedor…'} searchPlaceholder="buscar…" disabled={busy === cartao_final || !barId}
                          onValueChange={(v) => { const f = fornecedores.find(x => x.value === v); if (f) vincular(cartao_final, v, f.label); }} />
                        <button onClick={() => { setCadOpen(cadOpen === cartao_final ? null : cartao_final); setCadNome(titular_nome || ''); setCadDoc(''); }} className="text-xs text-emerald-600 hover:underline whitespace-nowrap">＋ novo</button>
                        {atual && <button onClick={() => desvincular(cartao_final)} disabled={busy === cartao_final} className="text-xs text-muted-foreground hover:text-red-500">x</button>}
                      </div>
                      {cadOpen === cartao_final && (
                        <div className="w-full flex items-center gap-1.5 flex-wrap pl-14 pt-1">
                          <Input value={cadNome} onChange={e => setCadNome(e.target.value)} placeholder="Nome do fornecedor (titular)" className="h-7 w-56 text-xs" />
                          <select value={cadTipo} onChange={e => setCadTipo(e.target.value as 'Física' | 'Jurídica')} className="h-7 text-xs border rounded px-1 bg-background"><option value="Física">Física</option><option value="Jurídica">Jurídica</option></select>
                          <Input value={cadDoc} onChange={e => setCadDoc(e.target.value)} placeholder="CPF/CNPJ (opcional)" className="h-7 w-40 text-xs" />
                          <Button size="sm" disabled={busy === cartao_final || !cadNome.trim()} onClick={() => cadastrar(cartao_final)}>{busy === cartao_final ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar e vincular'}</Button>
                          <button onClick={() => setCadOpen(null)} className="text-xs text-muted-foreground hover:text-foreground">cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Contas de cartão (p/ agrupar as faturas) */}
          <div className="space-y-2 pt-1 border-t border-[hsl(var(--border))]">
            <div className="text-sm font-semibold">Contas de cartão <span className="text-xs text-muted-foreground font-normal">(agrupam as faturas — ex.: Itaú Azul Gonza)</span></div>
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
              <div>
                <Label className="mb-1 block text-xs">Banco</Label>
                <select value={banco} onChange={(e) => setBanco(e.target.value)} className="h-10 text-sm border rounded px-2 bg-background"><option value="itau">Itaú</option><option value="nubank">Nubank</option></select>
              </div>
              <div><Label className="mb-1 block text-xs">Tipo</Label><Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Azul, Latam…" /></div>
              <div><Label className="mb-1 block text-xs">Dono</Label><Input value={dono} onChange={(e) => setDono(e.target.value)} placeholder="Gonza, Cadu…" /></div>
              <Button onClick={add} disabled={salvando} className="h-10">{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}</Button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {cartoes.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma conta ainda.</p> :
                cartoes.map(c => (
                  <div key={c.id} className="text-sm flex items-center gap-1.5 py-0.5">
                    <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="flex-1">{cartaoNome(c)}</span>
                    <button onClick={() => excluir(c)} disabled={excluindo === c.id} className="text-xs text-muted-foreground hover:text-red-500 disabled:opacity-50" title="Excluir conta">
                      {excluindo === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'excluir'}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
