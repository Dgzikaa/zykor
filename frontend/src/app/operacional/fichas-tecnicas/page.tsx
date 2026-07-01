'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Trash2, Search, Utensils, Star, Loader2, Pencil, Plus, Boxes, Download, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'porção'];
const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPeso = (q: any, u: string | null) => {
  const n = Number(q || 0);
  if (u === 'g' || u === 'kg') { const g = u === 'kg' ? n * 1000 : n; return g >= 1000 ? `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : `${g.toLocaleString('pt-BR')} g`; }
  if (u === 'ml' || u === 'L') { const ml = u === 'L' ? n * 1000 : n; return ml >= 1000 ? `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L` : `${ml.toLocaleString('pt-BR')} ml`; }
  return `${n.toLocaleString('pt-BR')}${u ? ' ' + u : ''}`;
};
// preço por unidade-base normalizado: g→/kg, ml→/L, resto→/unidade
const fmtPrecoUn = (precoUn: any, u: string | null) => {
  if (precoUn == null) return '—';
  const n = Number(precoUn);
  if (u === 'g') return `${fmtBRL(n * 1000)}/kg`;
  if (u === 'ml') return `${fmtBRL(n * 1000)}/L`;
  if (u === 'kg') return `${fmtBRL(n)}/kg`;
  if (u === 'L') return `${fmtBRL(n)}/L`;
  return `${fmtBRL(n)}/${u || 'un'}`;
};

interface FichaTabProps {
  kind: 'producao' | 'produto';
  lista: any[];
  insumos: any[];
  producoes: any[];
  reloadLista: () => void;
  preSel?: number | null;
  cmvMedias?: Record<string, number>;
  vendasSemCadastro?: any[];
}

function FichaTab({ kind, lista, insumos, producoes, reloadLista, preSel, cmvMedias, vendasSemCadastro }: FichaTabProps) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const parentParam = kind === 'producao' ? 'producao_id' : 'produto_id';

  const [sel, setSel] = useState<number | null>(preSel ?? null);
  const [buscaLista, setBuscaLista] = useState('');
  const [filtroLista, setFiltroLista] = useState<'zero' | 'sem_mestre' | 'sem_ch' | 'item_zerado' | 'curva_a' | 'sem_unidade' | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [itens, setItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  // códigos com componente sem preço (R$0 — revisar)
  const [zeradoCods, setZeradoCods] = useState<Set<string>>(new Set());
  // re-busca o contador de "item R$0" — a view é ao vivo, então corrigir o preço de um
  // insumo (aqui ou na tela de Insumos) reflete na hora; só precisamos re-puxar a contagem.
  const reloadZerados = useCallback(() => {
    if (!barId) return;
    api.get(`/api/operacional/producoes/itens-zerados?bar_id=${barId}`)
      .then(r => { if (r.success) setZeradoCods(new Set((kind === 'producao' ? r.producoes : r.produtos) || [])); })
      .catch(() => {});
  }, [barId, kind]);
  useEffect(() => { reloadZerados(); }, [reloadZerados]);

  useEffect(() => { if (preSel) setSel(preSel); }, [preSel]);

  const carregarItens = useCallback(async (id: number) => {
    setLoadingItens(true);
    try {
      const r = await api.get(`/api/operacional/producoes/ficha?${parentParam}=${id}&bar_id=${barId}`);
      if (r.success) setItens(r.itens || []);
    } finally { setLoadingItens(false); }
    reloadZerados(); // mantém o badge "item R$0" fresco ao abrir/editar uma ficha
  }, [parentParam, barId, reloadZerados]);
  useEffect(() => { if (sel) carregarItens(sel); else setItens([]); }, [sel, carregarItens]);

  // categoria pelo prefixo do código: finalização b=Bebida d=Drink c=Comida o=Outros · produção pd=Bar pc=Cozinha
  const cats = kind === 'produto' ? ['Bebida', 'Drink', 'Comida', 'Outros'] : ['Bar', 'Cozinha'];
  const catDe = (p: any) => {
    if (kind === 'produto') { const c = (p.codigo || '')[0]?.toLowerCase(); return c === 'b' ? 'Bebida' : c === 'd' ? 'Drink' : c === 'c' ? 'Comida' : 'Outros'; }
    return (p.codigo || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';
  };
  const [catFiltro, setCatFiltro] = useState<string | null>(null);
  // contadores dos badges respeitam os outros filtros (categoria + ativo/inativo) pra combinarem entre si
  const baseCat = useMemo(() => catFiltro ? lista.filter(p => catDe(p) === catFiltro) : lista, [lista, catFiltro]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseStat = useMemo(() => baseCat.filter(p => kind !== 'produto' || statusFiltro === 'todos' || (statusFiltro === 'ativo' ? !!p.ativo : !p.ativo)), [baseCat, statusFiltro, kind]);
  const nZero = baseStat.filter(p => (p.qtd_componentes ?? 0) === 0).length;
  const nItemZero = baseStat.filter(p => zeradoCods.has(p.codigo)).length;
  const nSemMestre = kind === 'producao' ? baseStat.filter(p => (p.qtd_componentes ?? 0) > 0 && !p.tem_mestre).length : 0;
  const nSemCh = kind === 'produto' ? baseStat.filter(p => (p.cods_ch?.length ?? 0) === 0 && !p.agrupado_em).length : 0;
  const nCurvaA = kind === 'producao' ? baseStat.filter(p => p.curva_a).length : 0;
  const nSemUnid = kind === 'producao' ? baseStat.filter(p => !p.unidade_contagem).length : 0;
  const nAtivos = kind === 'produto' ? baseCat.filter(p => p.ativo).length : 0;
  const nInativos = kind === 'produto' ? baseCat.filter(p => !p.ativo).length : 0;
  const listaView = useMemo(() => {
    const q = buscaLista.trim().toLowerCase();
    return lista.filter(p => {
      if (catFiltro && catDe(p) !== catFiltro) return false;
      if (filtroLista === 'zero' && (p.qtd_componentes ?? 0) !== 0) return false;
      if (filtroLista === 'sem_mestre' && !((p.qtd_componentes ?? 0) > 0 && !p.tem_mestre)) return false;
      if (filtroLista === 'sem_ch' && ((p.cods_ch?.length ?? 0) !== 0 || p.agrupado_em)) return false;
      if (filtroLista === 'item_zerado' && !zeradoCods.has(p.codigo)) return false;
      if (filtroLista === 'curva_a' && !p.curva_a) return false;
      if (filtroLista === 'sem_unidade' && p.unidade_contagem) return false;
      if (kind === 'produto' && statusFiltro !== 'todos' && (statusFiltro === 'ativo' ? !p.ativo : !!p.ativo)) return false;
      return !q || (p.nome || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)
        || (p.cods_ch || []).some((c: any) => String(c).toLowerCase().includes(q));
    });
  }, [lista, buscaLista, filtroLista, catFiltro, statusFiltro, kind, zeradoCods]); // eslint-disable-line react-hooks/exhaustive-deps

  const selObj = lista.find(p => p.id === sel) || null;

  const remover = async (id: number) => {
    try { const r = await api.delete(`/api/operacional/producoes/ficha?id=${id}`); if (!r.success) throw new Error(r.error); if (sel) { await carregarItens(sel); reloadLista(); } }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const marcarMestre = async (it: any) => {
    try { await api.put('/api/operacional/producoes/ficha', { id: it.id, is_mestre: !it.is_mestre }); if (sel) await carregarItens(sel); reloadLista(); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const salvarFcItem = async (it: any, valor: string, el?: HTMLInputElement) => {
    const f = Number(String(valor).replace(',', '.'));
    // FC = aproveitamento (0 a 1). Bloqueia erro comum: digitar 90 em vez de 0,9
    if (!Number.isFinite(f) || f <= 0 || f > 1) {
      toast({ title: 'FC inválido', description: 'O FC é o aproveitamento, de 0 a 1. Ex.: 0,9 = 90% (10% de perda). Não use 90.', variant: 'destructive' });
      if (el) el.value = String(it.fator_correcao ?? 1);
      return;
    }
    if (f === Number(it.fator_correcao || 1)) return;
    try { await api.put('/api/operacional/producoes/ficha', { id: it.id, fator_correcao: f }); if (sel) await carregarItens(sel); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // edição de item (modal) — só a quantidade; a unidade segue o cadastro do insumo/preparo
  const [editItem, setEditItem] = useState<any>(null);
  const [editQtd, setEditQtd] = useState('');
  const abrirEdit = (it: any) => { setEditItem(it); setEditQtd(String(it.quantidade ?? '')); };
  const salvarEdit = async () => {
    if (!editItem) return;
    try {
      await api.put('/api/operacional/producoes/ficha', { id: editItem.id, quantidade: Number(editQtd) || 0 });
      setEditItem(null); if (sel) await carregarItens(sel);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  // custo pelo último preço: usa o calculado; se destoar muito da planilha (unidade a revisar), cai pro planilha
  const flagRevisar = (it: any) => Number(it.custo_planilha || 0) > 0 && it.custo_atual != null && it.custo_atual > Number(it.custo_planilha) * 5;
  const custoItemAtual = (it: any) => (it.custo_atual != null && !flagRevisar(it)) ? it.custo_atual : Number(it.custo_planilha || 0);
  const custoAtualTotal = itens.reduce((s, it) => s + custoItemAtual(it), 0);

  // indicador: CMV do produto vs média da categoria (CMV teórico, 90 dias) — verde se ≤ média (melhor), vermelho se acima
  const cmvVsMedia = (cmv: number) => {
    if (!selObj) return null;
    const media = cmvMedias?.[catDe(selObj)];
    if (!media || !isFinite(cmv) || cmv <= 0) return null;
    const abaixo = cmv <= media;
    const Icon = abaixo ? TrendingDown : TrendingUp;
    return (
      <div className={`flex items-center justify-center gap-0.5 text-[10px] mt-0.5 ${abaixo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        title={`Média ${catDe(selObj)} (CMV teórico, 90 dias): ${media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}>
        <Icon className="w-3 h-3" />méd. {media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </div>
    );
  };

  // editar produção (nome, código, rendimento, unidade) — edição mora AQUI, na ficha técnica
  const [editRend, setEditRend] = useState(false);
  const [rendNome, setRendNome] = useState('');
  const [rendCod, setRendCod] = useState('');
  const [rendVal, setRendVal] = useState('');
  const [rendUni, setRendUni] = useState('un');
  const [rendUniCont, setRendUniCont] = useState('');
  const [rendFator, setRendFator] = useState('');
  const abrirRend = () => { setRendNome(selObj?.nome || ''); setRendCod(selObj?.codigo || ''); setRendVal(String(selObj?.rendimento ?? '')); setRendUni(selObj?.unidade || 'un'); setRendUniCont(selObj?.unidade_contagem || ''); setRendFator(selObj?.fator_contagem != null ? String(selObj.fator_contagem) : ''); setEditRend(true); };
  const salvarRend = async () => {
    if (!sel) return;
    if (!rendNome.trim()) { toast({ title: 'Informe o nome da produção', variant: 'destructive' }); return; }
    try {
      await api.put('/api/operacional/producoes', { id: sel, nome: rendNome.trim(), codigo: rendCod.trim() || null, rendimento: Number(rendVal) || 0, unidade: rendUni, unidade_contagem: rendUniCont.trim() || null, fator_contagem: rendFator.trim() === '' ? null : Number(rendFator.replace(',', '.')) });
      setEditRend(false); reloadLista();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // marca/desmarca a produção pra aparecer no Controle de Produção (curadoria)
  const toggleControle = async (p: any) => {
    try { await api.put('/api/operacional/producoes', { id: p.id, controle_producao: !p.controle_producao }); reloadLista(); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // marca/desmarca a produção como Curva A (contagem diária). Ligar Curva A força entrar na contagem.
  const toggleCurvaA = async (p: any) => {
    const next = !p.curva_a;
    const patch: any = { id: p.id, curva_a: next };
    if (next && !p.entra_contagem) patch.entra_contagem = true; // Curva A exige estar na contagem
    try { await api.put('/api/operacional/producoes', patch); reloadLista(); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // marca/desmarca se a produção entra na contagem de estoque (nem toda produção tem contagem física).
  // Desmarcar tira da contagem e, por consequência, zera o Curva A (não há como contar diário sem contar).
  const toggleEntraContagem = async (p: any) => {
    const next = !p.entra_contagem;
    const patch: any = { id: p.id, entra_contagem: next };
    if (!next && p.curva_a) patch.curva_a = false;
    try { await api.put('/api/operacional/producoes', patch); reloadLista(); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // "vendeu sem cadastro": vendido no ContaHub sem produto no Zykor → cadastra o item + mapeia o prd
  const [semCadOpen, setSemCadOpen] = useState(false);
  const [semCadCat, setSemCadCat] = useState<Record<string, string>>({});
  const [semCadBusy, setSemCadBusy] = useState<string | null>(null);
  const cadastrarDoContahub = async (item: any) => {
    setSemCadBusy(item.prd);
    try {
      const r = await api.post('/api/operacional/produtos', { bar_id: barId, nome: item.desc, prefixo: semCadCat[item.prd] || 'c', cod_ch: item.prd });
      if (!r.success) throw new Error(r.error);
      toast({ title: `Cadastrado: ${r.produto?.codigo || ''}`, description: `${item.desc} — agora monte a ficha.` });
      reloadLista();
    } catch (e: any) { toast({ title: 'Erro ao cadastrar', description: e?.message, variant: 'destructive' }); }
    finally { setSemCadBusy(null); }
  };

  // editar códigos ContaHub / Yuzer do produto (finalização)
  const [editCods, setEditCods] = useState(false);
  const [chVal, setChVal] = useState('');
  const [yzVal, setYzVal] = useState('');
  const abrirCods = () => { setChVal((selObj?.cods_ch || []).join(', ')); setYzVal((selObj?.cods_yuzer || []).join(', ')); setEditCods(true); };
  const salvarCods = async () => {
    if (!selObj) return;
    try {
      const r = await api.post('/api/operacional/produtos', { bar_id: barId, action: 'codigos', codigo: selObj.codigo, nome: selObj.nome, cods_ch: chVal, cods_yuzer: yzVal });
      if (!r.success) throw new Error(r.error);
      setEditCods(false); reloadLista();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // excluir da base do Zykor (manual) — produção ou produto
  const [confirmDel, setConfirmDel] = useState(false);
  const excluirProduto = async () => {
    if (!selObj) return;
    try {
      const ep = kind === 'producao' ? `/api/operacional/producoes?id=${selObj.id}` : `/api/operacional/produtos?id=${selObj.id}`;
      const r = await api.delete(ep);
      if (!r.success) throw new Error(r.error);
      setConfirmDel(false); setSel(null); reloadLista();
      toast({ title: kind === 'producao' ? 'Produção excluída' : 'Produto excluído da base' });
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // editar produto (nome + código) — finalização
  const [editProd, setEditProd] = useState(false);
  const [prodNome, setProdNome] = useState('');
  const [prodCod, setProdCod] = useState('');
  const abrirEditProd = () => { setProdNome(selObj?.nome || ''); setProdCod(selObj?.codigo || ''); setEditProd(true); };
  const salvarEditProd = async () => {
    if (!sel) return;
    if (!prodNome.trim()) { toast({ title: 'Informe o nome do produto', variant: 'destructive' }); return; }
    try {
      await api.put('/api/operacional/produtos', { id: sel, nome: prodNome.trim(), codigo: prodCod.trim() || null });
      setEditProd(false); reloadLista();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // agrupar produto num principal (canônico) — ex.: sabores de Red Bull → Red Bull principal (que leva o cód CH/venda)
  const [editGrupo, setEditGrupo] = useState(false);
  const [grupoBusca, setGrupoBusca] = useState('');
  const salvarGrupo = async (codigoPrincipal: string | null) => {
    if (!selObj) return;
    try {
      await api.put('/api/operacional/produtos', { id: selObj.id, agrupado_em: codigoPrincipal });
      setEditGrupo(false); setGrupoBusca(''); reloadLista();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const grupoOpcoes = useMemo(() => {
    const q = grupoBusca.trim().toLowerCase();
    return lista.filter(p => p.codigo !== selObj?.codigo && !p.agrupado_em && (!q || (p.nome || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q))).slice(0, 30);
  }, [lista, grupoBusca, selObj]);

  // adicionar componente (modal de criação)
  const [addOpen, setAddOpen] = useState(false);
  const [addTipo, setAddTipo] = useState<'insumo' | 'producao'>('insumo');
  const [addBusca, setAddBusca] = useState('');
  const [addEscolhido, setAddEscolhido] = useState<any>(null);
  const [addQtd, setAddQtd] = useState('1');
  const addOpcoes = useMemo(() => {
    const q = addBusca.trim().toLowerCase();
    if (addTipo === 'insumo') return insumos.filter(i => !q || (i.nome || '').toLowerCase().includes(q) || (i.codigo || '').toLowerCase().includes(q)).slice(0, 30);
    return producoes.filter(p => p.id !== sel && (!q || (p.nome || '').toLowerCase().includes(q))).slice(0, 30);
  }, [addTipo, addBusca, insumos, producoes, sel]);
  const adicionar = async () => {
    if (!sel || !addEscolhido) { toast({ title: 'Escolha o componente', variant: 'destructive' }); return; }
    // unidade NÃO é escolhida — segue o cadastro do insumo (base) / preparo (rendimento)
    const payload: any = { [parentParam]: sel, componente_tipo: addTipo, quantidade: Number(addQtd) || 0, unidade: null };
    if (addTipo === 'insumo') { payload.insumo_codigo = addEscolhido.codigo; payload.nome_componente = addEscolhido.nome; }
    else { payload.producao_ref = addEscolhido.id; payload.nome_componente = addEscolhido.nome; }
    try {
      const r = await api.post('/api/operacional/producoes/ficha', payload);
      if (!r.success) throw new Error(r.error);
      setAddEscolhido(null); setAddBusca(''); setAddQtd('1'); setAddOpen(false);
      if (sel) await carregarItens(sel); reloadLista();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Lista de fichas */}
      <Card className="card-dark lg:col-span-1">
        <CardContent className="p-0">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={buscaLista} onChange={e => setBuscaLista(e.target.value)} placeholder={kind === 'producao' ? 'Buscar produção…' : 'Buscar produto…'} className="pl-9 h-9" />
            </div>
            {(nZero > 0 || nSemMestre > 0 || nSemCh > 0 || nItemZero > 0 || (kind === 'produto' && (vendasSemCadastro?.length ?? 0) > 0)) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {kind === 'produto' && (vendasSemCadastro?.length ?? 0) > 0 && <button onClick={() => setSemCadOpen(true)} title="Vendido no ContaHub mas SEM produto cadastrado no Zykor — a venda não entra no CMV. Cadastre o item." className="text-[10px] rounded px-1.5 py-0.5 border font-medium border-red-500 text-white bg-red-600">⚠ {vendasSemCadastro!.length} vendeu sem cadastro</button>}
                {nZero > 0 && <button onClick={() => setFiltroLista(f => f === 'zero' ? null : 'zero')} title="Ficha criada mas sem nenhum componente — falta montar a receita" className={`text-[10px] rounded px-1.5 py-0.5 border ${filtroLista === 'zero' ? 'bg-red-600 text-white border-red-600' : 'border-red-300 text-red-600'}`}>{nZero} ficha vazia</button>}
                {nItemZero > 0 && <button onClick={() => setFiltroLista(f => f === 'item_zerado' ? null : 'item_zerado')} title="Fichas com algum insumo sem preço (R$0) — revisar" className={`text-[10px] rounded px-1.5 py-0.5 border ${filtroLista === 'item_zerado' ? 'bg-purple-600 text-white border-purple-600' : 'border-purple-300 text-purple-600'}`}>{nItemZero} item R$0</button>}
                {nSemMestre > 0 && <button onClick={() => setFiltroLista(f => f === 'sem_mestre' ? null : 'sem_mestre')} className={`text-[10px] rounded px-1.5 py-0.5 border ${filtroLista === 'sem_mestre' ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-300 text-amber-600'}`}>{nSemMestre} sem mestre</button>}
                {nSemCh > 0 && <button onClick={() => setFiltroLista(f => f === 'sem_ch' ? null : 'sem_ch')} className={`text-[10px] rounded px-1.5 py-0.5 border ${filtroLista === 'sem_ch' ? 'bg-orange-500 text-white border-orange-500' : 'border-orange-300 text-orange-600'}`}>{nSemCh} sem cód CH</button>}
                {nCurvaA > 0 && <button onClick={() => setFiltroLista(f => f === 'curva_a' ? null : 'curva_a')} title="Produções marcadas como Curva A (entram na contagem diária do estoque)" className={`text-[10px] rounded px-1.5 py-0.5 border ${filtroLista === 'curva_a' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-300 text-indigo-600'}`}>{nCurvaA} curva A</button>}
                {nSemUnid > 0 && <button onClick={() => setFiltroLista(f => f === 'sem_unidade' ? null : 'sem_unidade')} title="Produções sem unidade de contagem cadastrada — falta o conversor pra contar" className={`text-[10px] rounded px-1.5 py-0.5 border ${filtroLista === 'sem_unidade' ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-300 text-amber-600'}`}>{nSemUnid} sem un. contagem</button>}
                {filtroLista && <button onClick={() => setFiltroLista(null)} className="text-[10px] text-gray-400 underline px-1">limpar</button>}
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {cats.map(c => (
                <button key={c} onClick={() => setCatFiltro(f => f === c ? null : c)} className={`text-[10px] rounded px-2 py-0.5 border ${catFiltro === c ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{c}</button>
              ))}
            </div>
            {kind === 'produto' && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[10px] text-gray-400 self-center mr-1">Status (ContaHub):</span>
                {([['todos', `Todos`], ['ativo', `Ativos ${nAtivos}`], ['inativo', `Inativos ${nInativos}`]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setStatusFiltro(v)} className={`text-[10px] rounded px-2 py-0.5 border ${statusFiltro === v ? (v === 'inativo' ? 'bg-gray-500 text-white border-gray-500' : 'bg-emerald-600 text-white border-emerald-600') : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{label}</button>
                ))}
              </div>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {listaView.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-400">
                {kind === 'producao' ? 'Cadastre/importe produções em Cadastros › Produções.' : 'Importe o cardápio em Cadastros › Produtos.'}
              </div>
            ) : listaView.map(p => (
              <button key={p.id} onClick={() => setSel(p.id)}
                className={`w-full text-left px-3 py-2 text-sm transition ${sel === p.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                <span className="inline-flex items-center gap-1.5">
                  {p.nome}
                  {kind === 'producao' && p.curva_a && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[9px] font-bold shrink-0" title="Curva A — entra na contagem diária do estoque">A</span>}
                </span>
                <span className="block text-xs text-gray-400">{p.codigo ? `${p.codigo} · ` : ''}{p.qtd_componentes ?? 0} itens{kind === 'produto' && (p.cods_ch?.length ?? 0) > 0 ? ` · ch: ${p.cods_ch.join(', ')}` : ''}{kind === 'producao' && p.controle_producao ? ' · no controle' : ''}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ficha selecionada */}
      <Card className="card-dark lg:col-span-2">
        <CardContent className="py-3">
          {!selObj ? (
            <div className="py-16 text-center text-gray-400"><ChefHat className="w-10 h-10 mx-auto mb-2 opacity-40" />Selecione {kind === 'producao' ? 'uma produção' : 'um produto'} para ver/montar a ficha.</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {selObj.nome}
                    {kind === 'producao' && <button onClick={abrirRend} className="text-gray-400 hover:text-indigo-600" title="Editar produção (nome, código, rendimento)"><Pencil className="w-4 h-4" /></button>}
                    {kind === 'produto' && <button onClick={abrirEditProd} className="text-gray-400 hover:text-indigo-600" title="Editar produto (nome, código)"><Pencil className="w-4 h-4" /></button>}
                    <button onClick={() => setConfirmDel(true)} className="text-red-500 hover:text-red-700" title={kind === 'producao' ? 'Excluir esta produção da base do Zykor' : 'Excluir este produto da base do Zykor'}><Trash2 className="w-4 h-4" /></button>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selObj.codigo ? `${selObj.codigo} · ` : ''}{itens.length} componentes</p>
                  {kind === 'producao' && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={!!selObj.controle_producao} onChange={() => toggleControle(selObj)} className="w-4 h-4 accent-indigo-600" />
                        Aparece no Controle de Produção
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer" title="Contada todo dia (Curva A). Exige entrar na contagem de estoque.">
                        <input type="checkbox" checked={!!selObj.curva_a} onChange={() => toggleCurvaA(selObj)} className="w-4 h-4 accent-indigo-600" />
                        Curva A (contagem diária)
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer" title="Se desmarcado, esta produção não aparece em nenhuma contagem de estoque (algumas produções não têm contagem física).">
                        <input type="checkbox" checked={!!selObj.entra_contagem} onChange={() => toggleEntraContagem(selObj)} className="w-4 h-4 accent-indigo-600" />
                        Entra na contagem de estoque
                      </label>
                      <button onClick={abrirRend} className="inline-flex items-center gap-1.5 text-xs text-left hover:text-indigo-600" title="Como esta produção é contada no estoque (clique pra editar)">
                        <span className="text-gray-400">Unidade de contagem:</span>
                        {selObj.unidade_contagem
                          ? <span className="font-medium text-gray-700 dark:text-gray-200"><span className="capitalize">{selObj.unidade_contagem}</span>{selObj.fator_contagem != null ? ` ${Number(selObj.fator_contagem).toLocaleString('pt-BR')} ${selObj.unidade || ''}` : ''}</span>
                          : <span className="text-amber-600 dark:text-amber-400 font-medium">definir</span>}
                        <Pencil className="w-3 h-3 opacity-50" />
                      </button>
                    </div>
                  )}
                  {kind === 'produto' && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {selObj.categoria && <Badge variant="outline">{selObj.categoria}</Badge>}
                      <Badge variant="outline" className={selObj.ativo ? 'text-emerald-600 border-emerald-300' : 'text-gray-400'}>{selObj.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      <span className="text-xs text-gray-500">Cód. CH: <span className="font-mono text-gray-600 dark:text-gray-300">{selObj.cods_ch?.length ? selObj.cods_ch.join(', ') : '—'}</span></span>
                      <span className="text-xs text-gray-500">ID Yuzer: <span className="font-mono text-gray-600 dark:text-gray-300">{selObj.cods_yuzer?.length ? selObj.cods_yuzer.join(', ') : '—'}</span></span>
                      <button onClick={abrirCods} className="text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-1 text-xs" title="Editar códigos ContaHub / Yuzer"><Pencil className="w-3 h-3" />editar códigos</button>
                      {selObj.agrupado_em
                        ? <span className="text-xs text-violet-600 dark:text-violet-300 inline-flex items-center gap-1">agrupado em <b className="font-mono">{selObj.agrupado_em}</b><button onClick={() => salvarGrupo(null)} className="text-gray-400 hover:text-red-500 underline">desagrupar</button></span>
                        : <button onClick={() => { setEditGrupo(true); setGrupoBusca(''); }} className="text-violet-500 hover:text-violet-700 inline-flex items-center gap-1 text-xs" title="Agrupar este produto num principal (ex.: sabor → produto canônico que leva o código ContaHub)"><Boxes className="w-3 h-3" />agrupar</button>}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 items-stretch">
                  {kind === 'producao' && (
                    <div className="relative px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 text-center">
                      <button onClick={abrirRend} className="absolute top-1 right-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200" title="Editar rendimento e unidade"><Pencil className="w-3.5 h-3.5" /></button>
                      <div className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-300/80 uppercase tracking-wide">Rendimento</div>
                      <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 leading-tight">{Number(selObj.rendimento || 0).toLocaleString('pt-BR')} <span className="text-base font-semibold">{selObj.unidade || ''}</span></div>
                    </div>
                  )}
                  <div className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 text-center">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Custo</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">{fmtBRL(custoAtualTotal)}</div>
                  </div>
                  {kind === 'produto' && (selObj.preco_venda != null || selObj.preco_yuzer != null) && (
                    <>
                      {selObj.preco_venda != null && (
                        <div className="px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/15 text-center">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Preço CH</div>
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 leading-tight mt-0.5">{fmtBRL(selObj.preco_venda)}</div>
                        </div>
                      )}
                      {selObj.preco_yuzer != null && (
                        <div className="px-4 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/15 text-center">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Preço Yuzer</div>
                          <div className="text-xl font-bold text-violet-600 dark:text-violet-400 leading-tight mt-0.5">{fmtBRL(selObj.preco_yuzer)}</div>
                        </div>
                      )}
                      {(() => {
                        const pch = Number(selObj.preco_venda) || 0;
                        const pyz = Number(selObj.preco_yuzer) || 0;
                        if (pch > 0 && pyz > 0) return (<>
                          <div className="px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/15 text-center">
                            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">CMV CH</div>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 leading-tight mt-0.5">{(custoAtualTotal / pch * 100).toFixed(1)}%</div>
                            {cmvVsMedia(custoAtualTotal / pch * 100)}
                          </div>
                          <div className="px-4 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/15 text-center">
                            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">CMV Yuzer</div>
                            <div className="text-xl font-bold text-violet-600 dark:text-violet-400 leading-tight mt-0.5">{(custoAtualTotal / pyz * 100).toFixed(1)}%</div>
                            {cmvVsMedia(custoAtualTotal / pyz * 100)}
                          </div>
                        </>);
                        const p = pch > 0 ? pch : pyz;
                        return p > 0 ? (
                          <div className="px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/15 text-center">
                            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">CMV teórico</div>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 leading-tight mt-0.5">{(custoAtualTotal / p * 100).toFixed(1)}%</div>
                            {cmvVsMedia(custoAtualTotal / p * 100)}
                          </div>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end mb-2">
                <Button size="sm" onClick={() => { setAddOpen(true); setAddEscolhido(null); setAddBusca(''); setAddQtd('1'); }}><Plus className="w-4 h-4 mr-1" />Adicionar componente</Button>
              </div>

              {/* Componentes da ficha */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                    {kind === 'producao' && <th className="text-center font-medium px-2 py-1.5 w-10" title="Insumo mestre (principal)">Mestre</th>}
                    <th className="text-left font-medium px-2 py-1.5">Código</th>
                    <th className="text-left font-medium px-2 py-1.5">Componente</th>
                    <th className="text-left font-medium px-2 py-1.5">Tipo</th>
                    <th className="text-right font-medium px-2 py-1.5">Peso/Qtd</th>
                    <th className="text-right font-medium px-2 py-1.5" title="Fator de Correção (perda/limpeza): peso usado = quantidade ÷ FC">FC</th>
                    <th className="text-right font-medium px-2 py-1.5">Preço insumo</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor</th>
                    <th className="w-14"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {loadingItens ? <tr><td colSpan={kind === 'producao' ? 9 : 8} className="px-2 py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                    : itens.length === 0 ? <tr><td colSpan={kind === 'producao' ? 9 : 8} className="px-2 py-6 text-center text-gray-400">Ficha vazia — adicione os insumos/produções acima.</td></tr>
                    : itens.map(it => (
                      <tr key={it.id} className={it.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                        {kind === 'producao' && (
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => marcarMestre(it)} title={it.is_mestre ? 'Insumo mestre' : 'Marcar como mestre'}>
                              <Star className={`w-4 h-4 mx-auto ${it.is_mestre ? 'text-amber-500 fill-amber-500' : 'text-gray-300 hover:text-amber-400'}`} />
                            </button>
                          </td>
                        )}
                        <td className="px-2 py-1.5 font-mono text-xs text-gray-500">{it.componente_codigo || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">
                          {it.nome_componente || it.componente_codigo || `#${it.producao_ref}`}
                        </td>
                        <td className="px-2 py-1.5"><span className={`text-[10px] rounded px-1.5 py-0.5 ${it.componente_tipo === 'producao' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{it.componente_tipo === 'producao' ? 'Produção' : 'Insumo'}</span></td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtPeso(it.quantidade, it.unidade_exib)}</td>
                        <td className="px-2 py-1.5 text-right">
                          {it.insumo_fc ? (
                            <div className="flex flex-col items-end">
                              <input type="number" step="0.0001" min={0.01} max={1} defaultValue={it.fator_correcao ?? 1} key={`fc-${it.id}-${it.fator_correcao}`}
                                onBlur={e => salvarFcItem(it, e.target.value, e.target)} title="Fator de Correção = aproveitamento (0 a 1). Ex.: 0,9 = 90% · filé 100/120 = 0,833"
                                className="h-7 w-16 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 px-1 text-xs text-right" />
                              {Number(it.fator_correcao || 1) !== 1 && <span className="text-[10px] text-amber-600 dark:text-amber-400" title="Peso efetivo usado">→ {fmtPeso(it.qtd_efetiva, it.unidade_exib)}</span>}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtPrecoUn(it.preco_un, it.unidade_exib)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                          {flagRevisar(it) ? <span className="text-amber-500 text-xs" title="Custo destoa muito — revisar a unidade/embalagem do insumo">⚠ revisar</span>
                            : it.custo_atual != null ? fmtBRL(it.custo_atual) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <button onClick={() => abrirEdit(it)} className="text-gray-400 hover:text-gray-600 mr-1" title="Editar"><Pencil className="w-4 h-4 inline" /></button>
                          <button onClick={() => remover(it.id)} className="text-red-500 hover:text-red-600" title="Remover"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Modal de edição do item */}
                {editItem && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Editar componente</h4>
                      <p className="text-sm text-gray-500 mb-3">{editItem.nome_componente}</p>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1"><label className="text-xs text-gray-500">Quantidade ({editItem.unidade_exib || '—'})</label><Input type="number" step="0.001" value={editQtd} onChange={e => setEditQtd(e.target.value)} /></div>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">A unidade segue o cadastro do insumo/preparo.</p>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
                        <Button onClick={salvarEdit}>Salvar</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de editar rendimento + unidade */}
                {editRend && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditRend(false); }}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Editar produção</h4>
                      <div className="space-y-2">
                        <div><label className="text-xs text-gray-500">Nome *</label><Input value={rendNome} onChange={e => setRendNome(e.target.value)} placeholder="Nome da produção" /></div>
                        <div className="flex gap-2">
                          <div className="w-32"><label className="text-xs text-gray-500">Código</label><Input value={rendCod} onChange={e => setRendCod(e.target.value)} placeholder="pc0000" /></div>
                          <div className="flex-1"><label className="text-xs text-gray-500">Rendimento</label><Input type="number" step="0.001" value={rendVal} onChange={e => setRendVal(e.target.value)} /></div>
                          <div className="w-24"><label className="text-xs text-gray-500">Unidade</label>
                            <select value={rendUni} onChange={e => setRendUni(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
                              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                        </div>
                        {/* Conversor de contagem: como você CONTA esta produção no estoque */}
                        <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex-1"><label className="text-xs text-gray-500" title="Como você CONTA no estoque (ex.: porção, caixa, unidade)">Unidade de contagem</label>
                            <Input value={rendUniCont} onChange={e => setRendUniCont(e.target.value)} placeholder={rendUni} />
                          </div>
                          <div className="w-32"><label className="text-xs text-gray-500" title="Quanto da unidade-base cabe em 1 unidade de contagem">Conversor p/ contagem</label>
                            <Input type="number" step="0.001" value={rendFator} onChange={e => setRendFator(e.target.value)} placeholder="1" />
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-400">Ex.: conta em <b>{rendUniCont.trim() || 'porção'}</b> e cada uma tem <b>{rendFator.trim() || '0,4'} {rendUni}</b> → na contagem você digita o nº de {rendUniCont.trim() || 'porções'} e o sistema multiplica pelo conversor pra ter {rendUni}.</p>
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setEditRend(false)}>Cancelar</Button>
                        <Button onClick={salvarRend}>Salvar</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de editar produto (nome + código) */}
                {editProd && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditProd(false); }}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Editar produto</h4>
                      <div className="space-y-2">
                        <div><label className="text-xs text-gray-500">Nome *</label><Input value={prodNome} onChange={e => setProdNome(e.target.value)} placeholder="Nome do produto" /></div>
                        <div><label className="text-xs text-gray-500">Código</label><Input value={prodCod} onChange={e => setProdCod(e.target.value)} placeholder="b0000" /></div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setEditProd(false)}>Cancelar</Button>
                        <Button onClick={salvarEditProd}>Salvar</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de editar códigos ContaHub / Yuzer */}
                {editCods && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditCods(false); }}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Códigos do produto</h4>
                      <p className="text-sm text-gray-500">{selObj?.nome} · {selObj?.codigo}</p>
                      <div><label className="text-xs text-gray-500">Cód. ContaHub (prd) — separe por vírgula se tiver vários (HH/PP)</label><Input value={chVal} onChange={e => setChVal(e.target.value)} placeholder="ex.: 86, 381" /></div>
                      <div><label className="text-xs text-gray-500">ID Yuzer — separe por vírgula se tiver vários</label><Input value={yzVal} onChange={e => setYzVal(e.target.value)} placeholder="ex.: 12345" /></div>
                      <p className="text-[11px] text-gray-400">Deixe vazio pra remover. Liga o produto às vendas do ContaHub/Yuzer (entra no CMV).</p>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => setEditCods(false)}>Cancelar</Button>
                        <Button onClick={salvarCods}>Salvar</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de confirmar exclusão do produto */}
                {confirmDel && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDel(false); }}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{kind === 'producao' ? 'Excluir produção' : 'Excluir produto'}</h4>
                      <p className="text-sm text-gray-500">{kind === 'producao'
                        ? <>Excluir <b>{selObj?.nome}</b> ({selObj?.codigo}) e a ficha dela da base do Zykor? Esta ação não pode ser desfeita.</>
                        : <>Excluir <b>{selObj?.nome}</b> ({selObj?.codigo}) e a ficha dele da base do Zykor? O de-para (ContaHub/Yuzer) é mantido. Não afeta o ContaHub.</>}</p>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => setConfirmDel(false)}>Cancelar</Button>
                        <Button onClick={excluirProduto} className="bg-red-600 hover:bg-red-700 text-white">Excluir</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de agrupar produto */}
                {editGrupo && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditGrupo(false); }}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md space-y-2" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white">Agrupar produto</h4>
                      <p className="text-sm text-gray-500">Escolha o produto <b>principal</b> que leva o código ContaHub e a venda. <b>{selObj?.nome}</b> vira variante dele (não conta como &ldquo;sem cód CH&rdquo; e não duplica venda).</p>
                      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={grupoBusca} onChange={e => setGrupoBusca(e.target.value)} placeholder="Buscar produto principal…" className="pl-9" /></div>
                      <div className="max-h-60 overflow-y-auto rounded border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                        {grupoOpcoes.length === 0 ? <div className="px-3 py-3 text-xs text-gray-400">Nada encontrado.</div>
                        : grupoOpcoes.map((o: any) => (
                          <button key={o.id} onClick={() => salvarGrupo(o.codigo)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">{o.nome}<span className="text-xs text-gray-400 font-mono"> · {o.codigo}</span></button>
                        ))}
                      </div>
                      <div className="flex justify-end pt-1"><Button variant="outline" onClick={() => setEditGrupo(false)}>Cancelar</Button></div>
                    </div>
                  </div>
                )}

                {/* Modal de adicionar componente */}
                {addOpen && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-lg space-y-2" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white">Adicionar componente</h4>
                      <div className="flex gap-1">
                        <button onClick={() => { setAddTipo('insumo'); setAddEscolhido(null); }} className={`text-xs rounded px-2.5 py-1 flex items-center gap-1 ${addTipo === 'insumo' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}><Boxes className="w-3.5 h-3.5" />Insumo</button>
                        <button onClick={() => { setAddTipo('producao'); setAddEscolhido(null); }} className={`text-xs rounded px-2.5 py-1 flex items-center gap-1 ${addTipo === 'producao' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}><ChefHat className="w-3.5 h-3.5" />Produção</button>
                      </div>
                      {addEscolhido ? (
                        <>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex-1 min-w-[160px]"><label className="text-xs text-gray-500">Componente</label>
                            <div className="h-10 flex items-center px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm justify-between"><span className="truncate">{addEscolhido.nome}</span><button onClick={() => setAddEscolhido(null)} className="text-gray-400 text-xs ml-2">trocar</button></div>
                          </div>
                          <div className="w-28"><label className="text-xs text-gray-500">Qtd ({addTipo === 'insumo' ? (addEscolhido.base || '—') : (addEscolhido.unidade || '—')})</label><Input type="number" step="0.001" value={addQtd} onChange={e => setAddQtd(e.target.value)} /></div>
                        </div>
                        <p className="text-[11px] text-gray-400">A unidade segue o cadastro do {addTipo === 'insumo' ? 'insumo' : 'preparo'} ({addTipo === 'insumo' ? (addEscolhido.base || 'sem unidade') : (addEscolhido.unidade || 'sem unidade')}).</p>
                        </>
                      ) : (
                        <>
                          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={addBusca} onChange={e => setAddBusca(e.target.value)} placeholder={addTipo === 'insumo' ? 'Buscar insumo (nome ou i0XXX)…' : 'Buscar produção…'} className="pl-9" /></div>
                          {addBusca && (
                            <div className="max-h-48 overflow-y-auto rounded border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                              {addOpcoes.length === 0 ? <div className="px-3 py-3 text-xs text-gray-400">Nada encontrado.</div>
                              : addOpcoes.map((o: any) => (
                                <button key={o.id} onClick={() => setAddEscolhido(o)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">{o.nome}{addTipo === 'insumo' && o.codigo && <span className="text-xs text-gray-400 font-mono"> · {o.codigo}</span>}</button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-end gap-2 mt-2">
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Fechar</Button>
                        <Button onClick={adicionar} disabled={!addEscolhido}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal: vendeu sem cadastro (ContaHub vendeu mas não tem produto no Zykor) */}
      {semCadOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSemCadOpen(false); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold text-gray-900 dark:text-white">Vendeu sem cadastro · {vendasSemCadastro?.length ?? 0} itens</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Itens vendidos no ContaHub (últimos 30d) sem produto cadastrado no Zykor — a venda não entra no CMV. Escolha a categoria e clique em <b>Cadastrar</b> (depois monte a ficha). Ignore os que não são item de cardápio (ingresso, taxa, vale…).</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 border-b"><tr><th className="text-left py-1">Item (ContaHub)</th><th className="text-right py-1">Qtd</th><th className="text-right py-1">Valor</th><th className="text-center py-1">Categoria</th><th></th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(vendasSemCadastro || []).map((it: any) => (
                  <tr key={it.prd}>
                    <td className="py-1.5 text-gray-900 dark:text-gray-100">{it.desc}<span className="text-xs text-gray-400 font-mono ml-1">#{it.prd}</span></td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500">{Number(it.qtd).toLocaleString('pt-BR')}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{fmtBRL(it.valor)}</td>
                    <td className="py-1.5 text-center">
                      <select value={semCadCat[it.prd] || 'c'} onChange={e => setSemCadCat(m => ({ ...m, [it.prd]: e.target.value }))} className="text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5">
                        <option value="c">Comida</option><option value="b">Bebida</option><option value="d">Drink</option><option value="o">Outros</option>
                      </select>
                    </td>
                    <td className="py-1.5 text-right">
                      <Button size="sm" variant="outline" disabled={semCadBusy === it.prd} onClick={() => cadastrarDoContahub(it)}>{semCadBusy === it.prd ? '…' : 'Cadastrar'}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-4"><Button variant="outline" onClick={() => setSemCadOpen(false)}>Fechar</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function FichasInner() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const sp = useSearchParams();
  const preSel = sp.get('producao') ? Number(sp.get('producao')) : null;

  const { toast } = useToast();
  const [aba, setAba] = useState<'producao' | 'finalizacao'>('producao');
  const [producoes, setProducoes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [vendasSemCadastro, setVendasSemCadastro] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [cmvMedias, setCmvMedias] = useState<Record<string, number>>({});
  const [importando, setImportando] = useState(false);

  const loadProducoes = useCallback(async () => { if (!barId) return; const r = await api.get(`/api/operacional/producoes?bar_id=${barId}`); if (r.success) setProducoes(r.producoes || []); }, [barId]);
  const loadProdutos = useCallback(async () => { if (!barId) return; const r = await api.get(`/api/operacional/produtos?bar_id=${barId}`); if (r.success) { setProdutos(r.produtos || []); setVendasSemCadastro(r.vendas_sem_cadastro || []); } }, [barId]);
  const loadInsumos = useCallback(async () => { if (!barId) return; const r = await api.get(`/api/operacional/insumos?bar_id=${barId}`); if (r.success) setInsumos(r.insumos || []); }, [barId]);
  const loadCmvMedias = useCallback(async () => { if (!barId) return; const r = await api.get(`/api/operacional/producoes/cmv-categoria?bar_id=${barId}`); if (r.success) setCmvMedias(r.medias || {}); }, [barId]);
  useEffect(() => { loadProducoes(); loadProdutos(); loadInsumos(); loadCmvMedias(); }, [loadProducoes, loadProdutos, loadInsumos, loadCmvMedias]);
  // ao voltar o foco pra esta aba, re-sincroniza insumos/produções (cadastrados em outra aba aparecem sem F5)
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') { loadInsumos(); loadProducoes(); } };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [loadInsumos, loadProducoes]);

  const importar = async () => {
    if (!barId) return; setImportando(true);
    try {
      const ep = aba === 'producao' ? '/api/operacional/producoes' : '/api/operacional/produtos';
      const r = await api.post(ep, { bar_id: barId, action: 'importar' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Importado', description: `${r.importados ?? 0} ${aba === 'producao' ? 'produções' : 'produtos'} novos` });
      if (aba === 'producao') await loadProducoes(); else await loadProdutos();
    } catch (e: any) { toast({ title: 'Erro ao importar', description: e?.message, variant: 'destructive' }); }
    finally { setImportando(false); }
  };

  // ===== Buscar por insumo (#1) + substituir em massa (#3) =====
  const [iuOpen, setIuOpen] = useState(false);
  const [iuTermo, setIuTermo] = useState('');
  const [iuInsumos, setIuInsumos] = useState<any[]>([]); // insumos que casaram com o termo
  const [iuDe, setIuDe] = useState<any>(null);           // insumo de origem selecionado {codigo, nome}
  const [iuUsos, setIuUsos] = useState<any[]>([]);
  const [iuLoading, setIuLoading] = useState(false);
  const [iuSub, setIuSub] = useState<any>(null);         // insumo destino {codigo, nome}
  const [iuSubBusca, setIuSubBusca] = useState('');
  const [iuBusy, setIuBusy] = useState(false);

  const buscarUso = useCallback(async (termo: string) => {
    if (!barId || termo.trim().length < 2) { setIuInsumos([]); setIuUsos([]); setIuDe(null); return; }
    setIuLoading(true);
    try {
      const r = await api.get(`/api/operacional/fichas/insumo-uso?bar_id=${barId}&insumo=${encodeURIComponent(termo.trim())}`);
      if (r.success) {
        setIuInsumos(r.insumos || []);
        setIuUsos(r.usos || []);
        setIuDe((r.insumos || []).length === 1 ? r.insumos[0] : null);
      }
    } finally { setIuLoading(false); }
  }, [barId]);
  useEffect(() => { const id = setTimeout(() => buscarUso(iuTermo), 300); return () => clearTimeout(id); }, [iuTermo, buscarUso]);

  const iuUsosView = useMemo(() => iuDe ? iuUsos.filter((u: any) => String(u.insumo_codigo).toUpperCase() === String(iuDe.codigo).toUpperCase()) : iuUsos, [iuUsos, iuDe]);
  const iuSubOpcoes = useMemo(() => {
    const s = iuSubBusca.trim().toLowerCase(); if (!s) return [];
    return (insumos || []).filter((i: any) => (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)).slice(0, 8);
  }, [insumos, iuSubBusca]);

  const substituir = async () => {
    if (!barId || !iuDe || !iuSub) return;
    if (!confirm(`Substituir "${iuDe.nome}" por "${iuSub.nome}" em ${iuUsosView.length} ficha(s)? Esta ação altera todas de uma vez.`)) return;
    setIuBusy(true);
    try {
      const r = await api.post('/api/operacional/fichas/insumo-uso', { bar_id: barId, de_codigo: iuDe.codigo, para_codigo: iuSub.codigo });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Substituído', description: `${r.afetadas} ficha(s): ${iuDe.nome} → ${iuSub.nome}` });
      setIuSub(null); setIuSubBusca(''); setIuTermo(iuSub.nome);
      loadProducoes(); loadProdutos();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setIuBusy(false); }
  };

  // atualizar status (ativo) + preço de venda do ContaHub
  const [atualizandoCh, setAtualizandoCh] = useState(false);
  const atualizarContahub = async () => {
    if (!barId) return; setAtualizandoCh(true);
    try {
      const r = await api.post('/api/operacional/produtos', { bar_id: barId, action: 'sync_contahub' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Atualizado do ContaHub', description: `${r.ativos_atualizados ?? 0} status · ${r.precos_atualizados ?? 0} preços` });
      await loadProdutos();
    } catch (e: any) { toast({ title: 'Erro ao atualizar', description: e?.message, variant: 'destructive' }); }
    finally { setAtualizandoCh(false); }
  };
  // criação de nova ficha (modal): categoria → prefixo do código (gerado no servidor) + CH/Yuzer (finalização)
  const CATS_PROD = [{ label: 'Cozinha', prefixo: 'pc' }, { label: 'Bar', prefixo: 'pd' }];
  const CATS_FIN = [{ label: 'Comida', prefixo: 'c' }, { label: 'Bebida', prefixo: 'b' }, { label: 'Drink', prefixo: 'd' }, { label: 'Outros', prefixo: 'o' }];
  const [createOpen, setCreateOpen] = useState(false);
  const [cNome, setCNome] = useState('');
  const [cPrefixo, setCPrefixo] = useState('');
  const [cCh, setCCh] = useState('');
  const [cYuzer, setCYuzer] = useState('');
  const [creating, setCreating] = useState(false);
  const [cModelo, setCModelo] = useState<{ id: number; nome: string; codigo: string } | null>(null);
  const [cModeloBusca, setCModeloBusca] = useState('');
  const cats = aba === 'producao' ? CATS_PROD : CATS_FIN;
  const modeloLista = aba === 'producao' ? producoes : produtos;
  const modeloOpcoes = useMemo(() => {
    const q = cModeloBusca.trim().toLowerCase();
    return modeloLista.filter((p: any) => (p.qtd_componentes ?? 0) > 0 && (!q || (p.nome || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q))).slice(0, 30);
  }, [modeloLista, cModeloBusca]);
  const nova = () => { setCNome(''); setCCh(''); setCYuzer(''); setCPrefixo(cats[0].prefixo); setCModelo(null); setCModeloBusca(''); setCreateOpen(true); };
  const salvarNova = async () => {
    if (!barId || !cNome.trim() || !cPrefixo) { toast({ title: 'Informe nome e categoria', variant: 'destructive' }); return; }
    setCreating(true);
    try {
      if (aba === 'producao') {
        const r = await api.post('/api/operacional/producoes', { bar_id: barId, nome: cNome.trim(), prefixo: cPrefixo, modelo_id: cModelo?.id });
        if (!r.success) throw new Error(r.error);
        await loadProducoes();
        toast({ title: `Produção criada (${r.producao?.codigo || ''})`, description: cModelo ? `Ficha copiada de ${cModelo.nome}.` : 'Selecione na lista e monte a ficha.' });
      } else {
        const r = await api.post('/api/operacional/produtos', { bar_id: barId, nome: cNome.trim(), prefixo: cPrefixo, cod_ch: cCh.trim(), cod_yuzer: cYuzer.trim(), modelo_id: cModelo?.id });
        if (!r.success) throw new Error(r.error);
        await loadProdutos();
        toast({ title: `Produto criado (${r.produto?.codigo || ''})`, description: cModelo ? `Ficha copiada de ${cModelo.nome}.` : 'Selecione na lista e monte a ficha.' });
      }
      setCreateOpen(false);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setCreating(false); }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 mb-4">
        <button onClick={() => setAba('producao')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'producao' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><ChefHat className="w-4 h-4" />Produção</button>
        <button onClick={() => setAba('finalizacao')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'finalizacao' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><Utensils className="w-4 h-4" />Finalização</button>
        <Button variant="outline" size="sm" onClick={() => setIuOpen(true)} className="ml-auto" title="Achar todas as FTs que usam um insumo e trocá-lo em massa"><Search className="w-4 h-4 mr-1.5" />Buscar por insumo</Button>
        <Button size="sm" onClick={nova}><Plus className="w-4 h-4 mr-1" />{aba === 'producao' ? 'Nova produção' : 'Novo produto'}</Button>
        <Button variant="outline" size="sm" onClick={importar} disabled={importando}>
          <Download className={`w-4 h-4 mr-1.5 ${importando ? 'animate-pulse' : ''}`} />{importando ? 'Importando…' : (aba === 'producao' ? 'Importar preparos' : 'Importar cardápio')}
        </Button>
        {aba === 'finalizacao' && (
          <Button variant="outline" size="sm" onClick={atualizarContahub} disabled={atualizandoCh} title="Consulta o ContaHub e atualiza status ativo/inativo e preço de venda dos produtos">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${atualizandoCh ? 'animate-spin' : ''}`} />{atualizandoCh ? 'Atualizando…' : 'Atualizar (ContaHub)'}
          </Button>
        )}
      </div>
      {aba === 'producao'
        ? <FichaTab kind="producao" lista={producoes} insumos={insumos} producoes={producoes} reloadLista={loadProducoes} preSel={preSel} />
        : <FichaTab kind="produto" lista={produtos} insumos={insumos} producoes={producoes} reloadLista={loadProdutos} cmvMedias={cmvMedias} vendasSemCadastro={vendasSemCadastro} />}

      {iuOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) setIuOpen(false); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"><Search className="w-4 h-4" />Buscar insumo nas Fichas Técnicas</h4>
              <button onClick={() => setIuOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <Input autoFocus value={iuTermo} onChange={e => setIuTermo(e.target.value)} placeholder="Ex.: Pimenta do Reino, Ypioca…" className="pl-9" />
            </div>
            {/* se o termo casar vários insumos, escolher qual */}
            {iuInsumos.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {iuInsumos.map((i: any) => (
                  <button key={i.codigo} onClick={() => setIuDe(i)} className={`text-xs rounded px-2 py-1 border ${iuDe?.codigo === i.codigo ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{i.nome} <span className="opacity-60 font-mono">{i.codigo}</span></button>
                ))}
              </div>
            )}
            {iuLoading ? <div className="py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            : iuTermo.trim().length >= 2 && (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {iuDe ? <><b>{iuDe.nome}</b> aparece em <b>{iuUsosView.length}</b> ficha(s):</> : iuInsumos.length > 1 ? 'Escolha o insumo acima.' : 'Nenhum insumo encontrado.'}
                </div>
                {iuDe && (
                  <div className="max-h-60 overflow-y-auto rounded border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                    {iuUsosView.length === 0 ? <div className="px-3 py-3 text-xs text-gray-400">Não é usado em nenhuma ficha.</div>
                    : iuUsosView.map((u: any) => (
                      <div key={u.ficha_id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                        <span className="text-gray-800 dark:text-gray-100">{u.parent_nome} <span className="text-xs text-gray-400 font-mono">{u.parent_codigo}</span> <Badge variant="outline" className="ml-1 text-[10px]">{u.tipo === 'producao' ? 'produção' : 'produto'}</Badge></span>
                        <span className="text-xs text-gray-400 tabular-nums">{fmtPeso(u.quantidade, u.unidade)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* substituir em massa */}
                {iuDe && iuUsosView.length > 0 && (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/15 p-3 space-y-2">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Substituir em massa</div>
                    <p className="text-[11px] text-gray-500">Troca <b>{iuDe.nome}</b> por outro insumo em <b>todas</b> as {iuUsosView.length} fichas de uma vez (mantém as quantidades).</p>
                    {iuSub ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center justify-between rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/15 px-2.5 py-1.5">
                          <span className="text-sm">→ {iuSub.nome} <span className="text-xs text-gray-400 font-mono">{iuSub.codigo}</span></span>
                          <button onClick={() => { setIuSub(null); setIuSubBusca(''); }} className="text-gray-400 hover:text-red-500 text-xs underline">trocar</button>
                        </div>
                        <Button size="sm" onClick={substituir} disabled={iuBusy} className="bg-amber-600 hover:bg-amber-700">{iuBusy ? 'Trocando…' : `Substituir em ${iuUsosView.length}`}</Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input value={iuSubBusca} onChange={e => setIuSubBusca(e.target.value)} placeholder="Buscar insumo substituto…" className="pl-9" />
                        {iuSubBusca.trim() && (
                          <div className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg divide-y divide-gray-100 dark:divide-gray-800">
                            {iuSubOpcoes.length === 0 ? <div className="px-3 py-2 text-xs text-gray-400">Nenhum insumo.</div>
                            : iuSubOpcoes.filter((o: any) => o.codigo?.toUpperCase() !== iuDe.codigo?.toUpperCase()).map((o: any) => (
                              <button key={o.codigo} onClick={() => { setIuSub({ codigo: o.codigo, nome: o.nome }); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">{o.nome}<span className="text-xs text-gray-400 font-mono"> · {o.codigo}</span></button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold text-gray-900 dark:text-white">{aba === 'producao' ? 'Nova produção' : 'Novo produto'}</h4>
            <div><label className="text-xs text-gray-500">Nome *</label><Input value={cNome} onChange={e => setCNome(e.target.value)} placeholder={aba === 'producao' ? 'Ex.: Molho da casa' : 'Ex.: Caipirinha de Limão'} /></div>
            <div>
              <label className="text-xs text-gray-500">Categoria *</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {cats.map(c => (
                  <button key={c.prefixo} onClick={() => setCPrefixo(c.prefixo)}
                    className={`text-xs rounded px-2.5 py-1 border ${cPrefixo === c.prefixo ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{c.label}</button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">O código ({cPrefixo}0000) é gerado automático.</p>
            </div>
            {aba === 'finalizacao' && (
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-gray-500">Cód. CH (opcional)</label><Input value={cCh} onChange={e => setCCh(e.target.value)} placeholder="prd" /></div>
                <div className="flex-1"><label className="text-xs text-gray-500">ID Yuzer (opcional)</label><Input value={cYuzer} onChange={e => setCYuzer(e.target.value)} placeholder="id" /></div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Copiar ficha de (modelo, opcional)</label>
              {cModelo ? (
                <div className="flex items-center justify-between rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/15 px-2.5 py-1.5 mt-1">
                  <span className="text-sm text-gray-800 dark:text-gray-100">{cModelo.nome} <span className="text-xs text-gray-400 font-mono">· {cModelo.codigo}</span></span>
                  <button onClick={() => { setCModelo(null); setCModeloBusca(''); }} className="text-gray-400 hover:text-red-500 text-xs underline">trocar</button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={cModeloBusca} onChange={e => setCModeloBusca(e.target.value)} placeholder="Buscar ficha existente…" className="pl-9" />
                  {cModeloBusca.trim() && (
                    <div className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg divide-y divide-gray-100 dark:divide-gray-800">
                      {modeloOpcoes.length === 0 ? <div className="px-3 py-2 text-xs text-gray-400">Nenhuma ficha com componentes encontrada.</div>
                      : modeloOpcoes.map((o: any) => (
                        <button key={o.id} onClick={() => { setCModelo({ id: o.id, nome: o.nome, codigo: o.codigo }); setCModeloBusca(''); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">{o.nome}<span className="text-xs text-gray-400 font-mono"> · {o.codigo} · {o.qtd_componentes} itens</span></button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1">Carrega os componentes do modelo na nova ficha; depois você ajusta o que precisar.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={salvarNova} disabled={creating}><Plus className="w-4 h-4 mr-1" />{creating ? 'Criando…' : 'Criar'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function FichasTecnicasPage() {
  return (
    <PageShell width="wide">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl"><ChefHat className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fichas Técnicas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Produção (preparos) e Finalização (cardápio) — insumos, peso, custo e insumo mestre</p>
          </div>
        </div>
        <Suspense fallback={<div className="py-16 text-center text-gray-400">Carregando…</div>}>
          <FichasInner />
        </Suspense>
    </PageShell>
  );
}
