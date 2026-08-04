'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageShell } from '@/components/layout/PageShell';
import { FiltroBarra, BuscaInput, SelectFiltro, OrdemFiltro, cmpNome } from '@/components/filtros/FiltroBarra';
import { deriveUnid } from '@/lib/insumo-unidade';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api-client';
import { Trash2, Plus, ChevronLeft, ChevronRight, Loader2, Upload, X, Camera, Pencil, ImageIcon, Check, Search, Users } from 'lucide-react';
// Reusa o mesmo módulo e o mesmo modal do Controle de Produção: quem gere a equipe lá gere aqui,
// e a lista de responsáveis é a mesma (auth_custom.pessoas_responsaveis). Duplicar viraria dois
// cadastros pra manter.
import { MOD_GERIR_EQUIPE, type Secao } from '../producoes/_shared';
import { GerirEquipeModal } from '../producoes/GerirEquipeModal';

type Responsavel = { id: number; nome: string; cargo: string | null; secao: string | null };

type Area = 'CozinhaFin' | 'CozinhaProd' | 'BarFin' | 'BarProd' | 'Salao';
const AREAS: { v: Area; l: string; hint: string }[] = [
  { v: 'CozinhaFin', l: 'Cozinha · Finalização', hint: 'Prato pronto que caiu/perdeu na cozinha' },
  { v: 'CozinhaProd', l: 'Cozinha · Produção', hint: 'Errou receita/desperdiçou no preparo (recheio, molho…)' },
  { v: 'BarFin', l: 'Bar · Finalização', hint: 'Drink pronto que caiu/perdeu' },
  { v: 'BarProd', l: 'Bar · Produção', hint: 'Errou drink/perdeu insumo no preparo do bar' },
  { v: 'Salao', l: 'Salão', hint: 'Perda no salão (garrafa quebrada, taça, etc.)' },
];
const areaLabel = (a: Area | null | undefined) => AREAS.find((x) => x.v === a)?.l ?? '—';
const areaBadgeCor = (a: Area | null | undefined): string => {
  switch (a) {
    case 'CozinhaFin': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'CozinhaProd': return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
    case 'BarFin': return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'BarProd': return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300';
    case 'Salao': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    default: return 'bg-gray-500/15 text-gray-600 dark:text-gray-400';
  }
};

// `origem_tipo: 'produto'` = item do CARDÁPIO (hambúrguer montado). Nesses, `codigo` guarda o id
// do produto e o servidor explode a ficha ao gravar. Ausente = insumo/preparo, debitado direto.
type Insumo = {
  codigo: string; nome: string; categoria: string | null; unidade_medida: string | null;
  /** base (g|ml|un) + embalagem = a unidade REAL em que o item é contado e precificado.
   *  Vem resolvido de /api/operacional/insumos (silver.insumo_catalogo, com fallback deriveUnid).
   *  `unidade_medida` sozinho não serve: "Limão taiti (kg)" tem unidade_medida='g' e embalagem=1000. */
  base?: string | null; embalagem?: number | null;
  origem_tipo?: 'produto';
};
type Foto = { storage_path: string; url: string; size_bytes?: number; mime?: string };
/** Âncora do item: quanto costuma ter em estoque e quanto custa (fn_desperdicio_referencias). */
type Referencia = { codigo: string; preco: number | null; ultima_qtd: number | null; ultima_data: string | null };
type Item = {
  insumo_codigo: string; insumo_nome?: string; unidade?: string;
  qtd: number; motivo?: string; observacao?: string;
  area?: Area | null;
  preco?: number | null; valor_rs?: number | null;
  // origem = o que a pessoa escolheu (o produto), quando a linha veio de explosão de ficha
  origem_tipo?: 'insumo' | 'preparo' | 'produto';
  origem_codigo?: string; origem_nome?: string; origem_qtd?: number;
  /** Linha carregada do banco na edição: já é resultado da explosão, o servidor não deve reexplodir. */
  ja_expandido?: boolean;
};
type Registro = {
  id: number; bar_id: number; data: string; observacao: string | null;
  criado_por: string | null; criado_em: string; atualizado_em: string;
  // Registros anteriores a 29/07/2026 não têm seção/responsável — por isso nullable, e por isso
  // o filtro de seção também aceita NULL (senão sumiriam das duas abas).
  secao: string | null; responsavel_id: number | null;
  /** Seção resolvida pelo servidor: a marcada, ou inferida da área dos itens. Pode ter as duas. */
  secao_efetiva?: string[];
  itens: Item[]; fotos: Foto[];
};

const fmtBRL = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Rótulo da unidade em que o item é CONTADO (e precificado) — a partir de base + embalagem,
 * que é a fonte única do sistema (lib/insumo-unidade). Ex.: base 'g' + embalagem 1000 → "kg";
 * base 'ml' + embalagem 30000 → "un (30 L)"; embalagem 1 → a própria base.
 * NÃO usar `unidade_medida` como rótulo: "Limão taiti (kg)" tem unidade_medida='g' mas é contado
 * em kg — foi o que fez o time digitar 670 (g) e virar 670 kg (Isaías, 04/08).
 */
const rotuloUnidade = (ins?: Insumo | null): string => {
  if (!ins) return '';
  const { base, embalagem } = (ins.base && Number(ins.embalagem) > 0)
    ? { base: String(ins.base), embalagem: Number(ins.embalagem) }
    : deriveUnid(ins.nome, ins.unidade_medida);
  if (embalagem === 1) return base === 'un' ? 'un' : base;
  if (base === 'g' && embalagem === 1000) return 'kg';
  if (base === 'ml' && embalagem === 1000) return 'L';
  // embalagem "fechada" (garrafa 330ml, barril 30L): conta em unidades, com o tamanho no rótulo
  const tam = base === 'ml' && embalagem >= 1000 ? `${(embalagem / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L`
    : base === 'g' && embalagem >= 1000 ? `${(embalagem / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
    : `${embalagem.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${base}`;
  return `un (${tam})`;
};

/**
 * Quantidade legível (pedido do Isaías, 04/08): a quantidade é gravada na unidade de CONTAGEM
 * (kg / L / garrafa / barril…), então 0,67 kg aparecia como "0.67 g". Agora: em item de peso ou
 * volume, abaixo de 1 mostra na subunidade (670 g) e de 1 pra cima na unidade cheia (1,2 kg).
 * Item contado em embalagem fechada (garrafa/barril) mantém o número e o rótulo dele.
 */
const fmtQtdItem = (qtd: number | null | undefined, rotulo?: string | null) => {
  if (qtd == null) return '—';
  const v = Number(qtd);
  const u = String(rotulo || '').trim();
  if (u === 'kg' || u === 'g') {
    if (u === 'kg' && Math.abs(v) < 1) return `${(v * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} g`;
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${u}`;
  }
  if (u === 'L' || u === 'ml') {
    if (u === 'L' && Math.abs(v) < 1) return `${(v * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ml`;
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${u}`;
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${u ? ` ${u}` : ''}`;
};

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const fmtDateFull = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
function mondayOf(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }
// Busca sem acento: o cadastro tem "ÁGUA SEM GÁS" e o time digita "agua" no iPad
// (teclado sem acento). Sem o NFD o item simplesmente não aparecia na lista.
const norm = (s?: string | null) =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const parseQtd = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

// Compressão de imagem antes do upload (canvas → jpeg). Caminho preferido: createImageBitmap,
// que decodifica direto do File SEM materializar a imagem como dataURL base64. O base64 do
// caminho antigo dobrava a RAM e estourava a memória do navegador em celular com foto de 12MP
// ("devido a insuficiência de memória, não foi possível concluir a operação"). Libera o bitmap
// e o buffer do canvas na hora. Fallback pro FileReader→Image em navegadores sem createImageBitmap.
async function comprimirImagem(file: File, maxW = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const encode = (canvas: HTMLCanvasElement) =>
    new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality));
  const toFile = (blob: Blob) => new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      const scale = bmp.width > maxW ? maxW / bmp.width : 1;
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); if (!ctx) { bmp.close?.(); return file; }
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close?.();
      const blob = await encode(canvas);
      canvas.width = 0; canvas.height = 0; // libera o buffer do canvas imediatamente
      return blob ? toFile(blob) : file;
    } catch { /* cai no fallback abaixo */ }
  }

  // Fallback (navegadores antigos sem createImageBitmap): FileReader → Image → canvas.
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
    });
    let { width, height } = img;
    if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await encode(canvas);
    return blob ? toFile(blob) : file;
  } catch {
    return file; // último recurso: manda o original
  }
}

export default function DesperdicioPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  const { soLeitura, podeInserir } = useModuloPermissao('/operacional/desperdicio');
  const { hasPermission, can } = useAuth();
  useEffect(() => { setPageTitle('🗑️ Desperdício'); return () => setPageTitle(''); }, [setPageTitle]);

  // Seção (Bar/Cozinha) no mesmo desenho do Controle de Produção, inclusive a trava: quem só tem
  // 'producao_bar' vê só Bar (tablets do bar), quem só tem 'producao_cozinha' vê só Cozinha.
  const podeBar = hasPermission('producao_bar');
  const podeCozinha = hasPermission('producao_cozinha');
  const secaoTravada: Secao | null = podeBar && !podeCozinha ? 'Bar' : podeCozinha && !podeBar ? 'Cozinha' : null;
  const secoesVisiveis: Secao[] = secaoTravada ? [secaoTravada] : ['Cozinha', 'Bar'];
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('Cozinha');
  useEffect(() => { if (secaoTravada) setSecaoAtiva(secaoTravada); }, [secaoTravada]);

  // Gerir equipe: mesmas ações granulares do Controle de Produção (admin sempre pode).
  const podeGerirInserir = can(MOD_GERIR_EQUIPE, 'inserir');
  const podeGerirEditar = can(MOD_GERIR_EQUIPE, 'editar');
  const podeGerirExcluir = can(MOD_GERIR_EQUIPE, 'excluir');
  const podeGerirEquipe = podeGerirInserir || podeGerirEditar || podeGerirExcluir;
  const [gerirEquipe, setGerirEquipe] = useState(false);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);

  // Semana seg→dom padrão. Navega em passos de 7 dias.
  const [monISO, setMonISO] = useState(() => toISO(mondayOf(new Date())));
  const semana = useMemo(() => {
    const mon = parseISO(monISO); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { ini: monISO, fim: toISO(sun) };
  }, [monISO]);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [referencias, setReferencias] = useState<Map<string, Referencia>>(new Map());
  // código → rótulo da unidade contada (kg / L / un (30 L)…), pra lista e cards mostrarem certo
  const rotuloPorCodigo = useMemo(
    () => new Map(insumos.map(i => [String(i.codigo).toUpperCase(), rotuloUnidade(i)])),
    [insumos],
  );
  const [loading, setLoading] = useState(false);
  const [dialogAberto, setDialogAberto] = useState<false | { modo: 'novo' | 'editar'; registro?: Registro }>(false);
  // Filtros da lista da semana (padrão da aba CMV): busca por insumo/responsável/motivo,
  // recorte por área e ordem. Antes só dava pra rolar a semana inteira no olho.
  const [buscaReg, setBuscaReg] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [ordem, setOrdem] = useState<'data' | 'valor' | 'az'>('data');

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      // Produtos do cardápio entram na MESMA lista de busca dos insumos. Jogar fora um
      // hambúrguer é jogar fora tudo que vai nele — o servidor explode a ficha na hora de
      // gravar (ver expandirItens na API). Só entram produtos QUE TÊM ficha; sem ficha não há
      // o que debitar, e apareceriam como opção que falha ao salvar.
      const [reg, ins, prod, resp] = await Promise.all([
        api.get(`/api/operacional/desperdicio?ini=${semana.ini}&fim=${semana.fim}&secao=${secaoAtiva}`),
        api.get(`/api/operacional/insumos?bar_id=${barId}`),
        api.get(`/api/operacional/produtos?bar_id=${barId}`).catch(() => ({ success: false })),
        // Responsáveis JÁ filtrados pela seção no servidor (quem tem secao null vem nas duas).
        api.get(`/api/operacional/pessoas-responsaveis?bar_id=${barId}&secao=${secaoAtiva}`).catch(() => ({ success: false })),
      ]);
      if (reg.success) {
        setRegistros(reg.registros || []);
        // preço + última contagem por insumo: âncora do aviso de ordem de grandeza no lançamento
        const m = new Map<string, Referencia>();
        for (const r of ((reg as any).referencias || []) as Referencia[]) m.set(String(r.codigo).toUpperCase(), r);
        setReferencias(m);
      }
      if ((resp as any)?.success) setResponsaveis((resp as any).data || []);

      const listaInsumos: Insumo[] = ins.success ? (ins.insumos || []) : [];
      const listaProdutos: Insumo[] = ((prod as any)?.success ? ((prod as any).produtos || []) : [])
        .filter((p: any) => p.ativo !== false && Number(p.qtd_componentes || 0) > 0)
        .map((p: any) => ({
          // `codigo` carrega o ID do cardápio: é ele que a API usa pra explodir a ficha.
          codigo: String(p.id),
          nome: p.nome,
          unidade_medida: 'un',
          categoria: p.categoria || 'Cardápio',
          origem_tipo: 'produto' as const,
        }));
      setInsumos([...listaInsumos, ...listaProdutos]);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [barId, semana.ini, semana.fim, secaoAtiva, toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const navSemana = (d: number) => { const x = parseISO(monISO); x.setDate(x.getDate() + d * 7); setMonISO(toISO(x)); };

  // O registro guarda só o id do responsável; o nome vem da lista já carregada. Se a pessoa foi
  // desativada depois, some da lista mas o registro antigo continua — mostra o id pra não sumir
  // a informação de que alguém respondeu por aquilo.
  const nomeResponsavel = (id: number) => responsaveis.find(p => p.id === id)?.nome || `#${id}`;

  const excluir = async (r: Registro) => {
    if (!window.confirm(`Apagar o registro de ${fmtDateFull(r.data)} (${r.itens.length} item(ns), ${r.fotos.length} foto(s))? A soma na coluna Desperdício em /desvios é atualizada.`)) return;
    try {
      await api.delete(`/api/operacional/desperdicio?id=${r.id}`);
      toast({ title: 'Registro apagado' });
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro ao apagar', description: e?.message, variant: 'destructive' });
    }
  };

  // Lista visível = registros da semana passados pelos filtros. A busca casa em QUALQUER item do
  // registro (nome/código/motivo) ou no responsável — é assim que se acha "onde lancei a picanha".
  // O filtro de área também PODA os itens do card, senão o card aparece mas mostra tudo.
  const registrosView = useMemo(() => {
    const s = norm(buscaReg);
    const casaItem = (it: Item) => !s || norm(it.insumo_nome).includes(s) || norm(it.insumo_codigo).includes(s)
      || norm(it.origem_nome).includes(s) || norm(it.motivo).includes(s);
    // lookup próprio (não usa nomeResponsavel) pra não invalidar o memo a cada render
    const nomeDe = (id: number | null) => id == null ? '' : (responsaveis.find(p => p.id === id)?.nome || '');
    const rows = registros
      .map((r) => {
        const casaResp = !!s && norm(nomeDe(r.responsavel_id)).includes(s);
        const itens = r.itens.filter((it) => (!filtroArea || it.area === filtroArea) && (casaItem(it) || casaResp));
        return { ...r, itens };
      })
      .filter((r) => r.itens.length > 0);
    const valorDe = (r: Registro) => r.itens.reduce((a, it) => a + (Number(it.valor_rs) || 0), 0);
    if (ordem === 'valor') return [...rows].sort((a, b) => valorDe(b) - valorDe(a));
    // A–Z pelo item mais "alfabeticamente primeiro" do registro — é o nome que a pessoa lê no card.
    if (ordem === 'az') return [...rows].sort((a, b) => cmpNome(
      [...a.itens].sort((x, y) => cmpNome(x.insumo_nome, y.insumo_nome))[0]?.insumo_nome,
      [...b.itens].sort((x, y) => cmpNome(x.insumo_nome, y.insumo_nome))[0]?.insumo_nome));
    return rows; // 'data': mantém a ordem do servidor (mais recente primeiro)
  }, [registros, buscaReg, filtroArea, ordem, responsaveis]);

  const totalRegistros = registrosView.length;
  const totalItens = registrosView.reduce((s, r) => s + r.itens.length, 0);
  const totalFotos = registrosView.reduce((s, r) => s + r.fotos.length, 0);
  // Total em R$ da semana (soma valor_rs de todos os itens; item sem preço = null → não soma).
  // Acompanha o filtro (mesma regra dos headline cards de /operacional/desvios): filtrou por área
  // ou buscou um insumo, o total é DAQUILO — senão o número da tela não bate com a lista.
  const totalRs = registrosView.reduce(
    (s, r) => s + r.itens.reduce((si, it) => si + (Number(it.valor_rs) || 0), 0),
    0,
  );
  // Rollup por dia × área — pra tabela resumo (o que o Diogo pediu: "valor por dia lançado").
  const rollupPorDia = useMemo(() => {
    const map = new Map<string, { data: string; total: number; porArea: Record<string, number> }>();
    for (const r of registrosView) {
      const dia = r.data;
      let row = map.get(dia);
      if (!row) { row = { data: dia, total: 0, porArea: {} }; map.set(dia, row); }
      for (const it of r.itens) {
        const v = Number(it.valor_rs) || 0;
        row.total += v;
        const k = it.area || 'SemArea';
        row.porArea[k] = (row.porArea[k] || 0) + v;
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [registrosView]);
  // Rollup só por área (total da semana).
  const rollupPorArea = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of registrosView) for (const it of r.itens) {
      const k = it.area || 'SemArea';
      acc[k] = (acc[k] || 0) + (Number(it.valor_rs) || 0);
    }
    return acc;
  }, [registrosView]);

  return (
    <PageShell width="wide">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl"><Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" /></div>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            Desperdício
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40">Beta</span>
            {soLeitura && <BadgeSomenteLeitura />}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Registro visual do que foi jogado fora. Alimenta a coluna Desperdício em /operacional/desvios. · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
        </div>
        {podeGerirEquipe && (
          <Button variant="outline" onClick={() => setGerirEquipe(true)} className="gap-1.5 shrink-0">
            <Users className="w-4 h-4" />Gerir equipe
          </Button>
        )}
        {podeInserir && (
          <Button onClick={() => setDialogAberto({ modo: 'novo' })}>
            <Plus className="w-4 h-4 mr-1.5" />Novo registro
          </Button>
        )}
      </div>

      {/* Seção: mesma convenção do Controle de Produção. Troca refaz a busca (registros e
          responsáveis vêm filtrados do servidor). */}
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-muted/30 w-fit">
        {secoesVisiveis.map(s => (
          <button key={s} onClick={() => setSecaoAtiva(s)}
            className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${secaoAtiva === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>
            {s === 'Cozinha' ? '👨‍🍳' : '🍺'} {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="text-sm px-1">
          <span className="font-medium">Semana {fmtDate(semana.ini)} a {fmtDate(semana.fim)}</span>
          {!loading && registros.length > 0 && <span className="text-muted-foreground"> · {totalRegistros} registro(s) · {totalItens} item(ns) · {totalFotos} foto(s)</span>}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(1)}><ChevronRight className="w-4 h-4" /></Button>
        {!loading && registros.length > 0 && (
          <span className="ml-auto text-sm font-semibold text-red-700 dark:text-red-400">
            Total da semana: {fmtBRL(totalRs)}
          </span>
        )}
      </div>

      {/* Filtros da semana (padrão da aba CMV): busca, área e ordem. */}
      {!loading && registros.length > 0 && (
        <FiltroBarra>
          <BuscaInput value={buscaReg} onChange={setBuscaReg} placeholder="Buscar insumo, motivo ou responsável…" />
          <SelectFiltro value={filtroArea} onChange={setFiltroArea} options={AREAS.map(a => ({ value: a.v, label: a.l }))} todos="Todas as áreas" />
          <OrdemFiltro value={ordem} onChange={setOrdem} cor="rose" options={[['data', 'Mais recente'], ['valor', 'Maior valor'], ['az', 'A–Z']] as const} />
        </FiltroBarra>
      )}

      {/* Resumo dia × área — o que Diogo pediu: valor por dia lançado + separação por área. */}
      {!loading && registros.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Desperdício por dia e por área</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-1.5 pr-3 font-normal">Dia</th>
                    {AREAS.map((a) => (
                      <th key={a.v} className="text-right py-1.5 px-2 font-normal whitespace-nowrap" title={a.hint}>{a.l}</th>
                    ))}
                    <th className="text-right py-1.5 pl-3 font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rollupPorDia.map((row) => (
                    <tr key={row.data}>
                      <td className="py-1.5 pr-3 font-medium tabular-nums">{fmtDateFull(row.data)}</td>
                      {AREAS.map((a) => {
                        const v = row.porArea[a.v] || 0;
                        return (
                          <td key={a.v} className={`py-1.5 px-2 text-right tabular-nums ${v > 0 ? '' : 'text-gray-300'}`}>
                            {v > 0 ? fmtBRL(v) : '—'}
                          </td>
                        );
                      })}
                      <td className="py-1.5 pl-3 text-right tabular-nums font-semibold">{fmtBRL(row.total)}</td>
                    </tr>
                  ))}
                  {(rollupPorArea['SemArea'] || 0) > 0 && (
                    <tr>
                      <td colSpan={AREAS.length + 2} className="pt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        + {fmtBRL(rollupPorArea['SemArea'] || 0)} sem área definida — abra o registro e classifique.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t">
                  <tr>
                    <td className="pt-1.5 pr-3 text-xs text-muted-foreground">Total semana</td>
                    {AREAS.map((a) => (
                      <td key={a.v} className={`pt-1.5 px-2 text-right tabular-nums text-xs font-medium ${(rollupPorArea[a.v] || 0) > 0 ? '' : 'text-gray-300'}`}>
                        {(rollupPorArea[a.v] || 0) > 0 ? fmtBRL(rollupPorArea[a.v]) : '—'}
                      </td>
                    ))}
                    <td className="pt-1.5 pl-3 text-right tabular-nums text-xs font-bold">{fmtBRL(totalRs)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : registrosView.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {registros.length === 0
            ? <>Nenhum registro na semana.{podeInserir && <> Clique em <b>Novo registro</b> pra lançar o desperdício da caixa.</>}</>
            : <>Nenhum registro bate com o filtro. <button onClick={() => { setBuscaReg(''); setFiltroArea(''); }} className="underline">Limpar filtros</button></>}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {registrosView.map(r => (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="py-3 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {fmtDateFull(r.data)} · <span className="text-muted-foreground">{r.itens.length} item(ns)</span>
                      {(r.secao ? [r.secao] : (r.secao_efetiva || [])).map(s => (
                        <span key={s} className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${r.secao ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : 'bg-gray-500/15 text-gray-600 dark:text-gray-400'}`}
                          title={r.secao ? 'Seção informada no registro' : 'Seção deduzida pela área dos itens (registro antigo, sem seção informada)'}>
                          {s === 'Cozinha' ? '👨‍🍳' : '🍺'} {s}
                        </span>
                      ))}
                      {r.responsavel_id != null && (
                        <span className="text-xs text-muted-foreground">
                          Responsável: <b className="font-medium text-foreground">{nomeResponsavel(r.responsavel_id)}</b>
                        </span>
                      )}
                    </div>
                    {r.criado_por && <div className="text-xs text-muted-foreground">Por {r.criado_por} · {new Date(r.criado_em).toLocaleString('pt-BR')}</div>}
                  </div>
                  {podeInserir && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDialogAberto({ modo: 'editar', registro: r })}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(r)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>

                {r.fotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {r.fotos.map(f => (
                      <a key={f.storage_path} href={f.url} target="_blank" rel="noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="foto desperdício" className="h-24 w-24 rounded object-cover border" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="grid gap-1.5">
                  {r.itens.map(it => (
                    <div key={it.insumo_codigo + '-' + it.qtd + '-' + (it.motivo || '')} className="text-sm border rounded-md px-2.5 py-1.5 flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{it.insumo_nome || it.insumo_codigo}</span>
                      <span className="text-muted-foreground text-xs">{it.insumo_codigo}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${areaBadgeCor(it.area)}`}>{areaLabel(it.area)}</span>
                      <span className="ml-auto tabular-nums">{fmtQtdItem(it.qtd, rotuloPorCodigo.get(String(it.insumo_codigo).toUpperCase()) || it.unidade)}</span>
                      <span className="tabular-nums font-semibold text-red-700 dark:text-red-400 min-w-[80px] text-right">{fmtBRL(it.valor_rs)}</span>
                      {it.motivo && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 basis-full">{it.motivo}</span>}
                    </div>
                  ))}
                </div>

                {r.observacao && (
                  <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2">{r.observacao}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogAberto && (
        <RegistroDialog
          modo={dialogAberto.modo}
          registroExistente={dialogAberto.registro}
          insumos={insumos}
          referencias={referencias}
          semana={semana}
          secao={secaoAtiva}
          responsaveis={responsaveis}
          onFechar={() => setDialogAberto(false)}
          onSalvo={async () => { setDialogAberto(false); await carregar(); }}
        />
      )}

      {gerirEquipe && barId && (
        <GerirEquipeModal
          barId={barId}
          responsaveis={responsaveis}
          podeInserir={podeGerirInserir}
          podeEditar={podeGerirEditar}
          podeExcluir={podeGerirExcluir}
          onClose={() => setGerirEquipe(false)}
          onChanged={carregar}
        />
      )}
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog de criação/edição — foto + itens dinâmicos + observação
// ─────────────────────────────────────────────────────────────────────────────

function RegistroDialog({
  modo, registroExistente, insumos, referencias, semana, secao, responsaveis, onFechar, onSalvo,
}: {
  modo: 'novo' | 'editar';
  registroExistente?: Registro;
  insumos: Insumo[];
  referencias: Map<string, Referencia>;
  semana: { ini: string; fim: string };
  /** Seção da aba ativa — grava no registro e define quais responsáveis aparecem. */
  secao: Secao;
  responsaveis: Responsavel[];
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const { toast } = useToast();
  const fotoInputRef = useRef<HTMLInputElement>(null);   // galeria/arquivos
  const cameraInputRef = useRef<HTMLInputElement>(null); // câmera (capture)
  const hoje = toISO(new Date());
  const dataPadrao = hoje >= semana.ini && hoje <= semana.fim ? hoje : semana.ini;

  const [data, setData] = useState(registroExistente?.data || dataPadrao);
  const [responsavelId, setResponsavelId] = useState<string>(
    registroExistente?.responsavel_id != null ? String(registroExistente.responsavel_id) : '',
  );
  const [observacao, setObservacao] = useState(registroExistente?.observacao || '');
  const [fotos, setFotos] = useState<Foto[]>(registroExistente?.fotos || []);
  const [itens, setItens] = useState<Item[]>(
    registroExistente?.itens.length
      // Veio do banco = já explodido. A marca impede que o servidor tente explodir de novo.
      ? registroExistente.itens.map(i => ({ ...i, ja_expandido: true }))
      : [{ insumo_codigo: '', qtd: 0, motivo: '', observacao: '' }],
  );
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const onEscolherFotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubindoFoto(true);
    try {
      for (const f of Array.from(files)) {
        const comprimida = await comprimirImagem(f);
        const fd = new FormData(); fd.append('file', comprimida);
        const r = await fetch('/api/operacional/desperdicio/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (!j.success) { toast({ title: 'Falha no upload', description: j.error, variant: 'destructive' }); continue; }
        setFotos(prev => [...prev, { url: j.url, storage_path: j.storage_path, size_bytes: j.size_bytes, mime: j.mime }]);
      }
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e?.message, variant: 'destructive' });
    } finally {
      setSubindoFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const removerFoto = async (path: string) => {
    setFotos(prev => prev.filter(f => f.storage_path !== path));
    try { await fetch(`/api/operacional/desperdicio/upload?storage_path=${encodeURIComponent(path)}`, { method: 'DELETE' }); }
    catch { /* Se falhar, fica arquivo órfão no bucket — melhor que não permitir remover. */ }
  };

  const addItem = () => setItens(prev => [...prev, { insumo_codigo: '', qtd: 0, motivo: '', observacao: '' }]);
  const removerItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx));
  const setItem = (idx: number, patch: Partial<Item>) => setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const podeSalvar = fotos.length > 0
    && itens.length > 0
    && itens.every(it => it.insumo_codigo && it.qtd > 0 && !!it.area);

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const payload = {
        data,
        secao,
        responsavel_id: responsavelId ? Number(responsavelId) : null,
        observacao: observacao.trim() || undefined,
        // A origem TEM que ir junto: sem `origem_tipo: 'produto'` o servidor não explode a ficha e
        // grava o id do cardápio como se fosse código de insumo — não bate com insumo nenhum, fica
        // sem nome e sem preço, e o desperdício nunca chega no /operacional/desvios.
        itens: itens.map(it => ({
          insumo_codigo: it.insumo_codigo,
          qtd: it.qtd,
          motivo: it.motivo || undefined,
          observacao: it.observacao || undefined,
          area: it.area || undefined,
          origem_tipo: it.origem_tipo,
          origem_codigo: it.origem_codigo,
          origem_nome: it.origem_nome,
          origem_qtd: it.origem_qtd,
          ja_expandido: it.ja_expandido || undefined,
        })),
        fotos,
      };
      if (modo === 'editar' && registroExistente) {
        await api.put('/api/operacional/desperdicio', { id: registroExistente.id, ...payload });
        toast({ title: 'Registro atualizado' });
      } else {
        const r = await api.post('/api/operacional/desperdicio', payload);
        // O servidor devolve `duplicado_evitado` quando o mesmo conteúdo já entrou há pouco
        // (clique repetido). Não é erro: o registro existe, só não criamos um segundo.
        if (r?.duplicado_evitado) {
          toast({ title: 'Este registro já estava salvo', description: 'Nada foi duplicado — o lançamento anterior foi mantido.' });
        } else {
          toast({ title: 'Registro salvo', description: `${itens.length} item(ns) · ${fotos.length} foto(s)` });
        }
      }
      await onSalvo();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !salvando) onFechar(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh]">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle>{modo === 'editar' ? 'Editar registro' : 'Novo registro de desperdício'}</DialogTitle>
          <DialogDescription>Anexe pelo menos 1 foto e adicione os itens da caixa. A soma alimenta o /operacional/desvios.</DialogDescription>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Escolher um <b>prato pronto</b> baixa tudo que vai nele — o quibe, o limão, o molho —
            cada um já na unidade em que é contado.
          </p>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
          {/* Data + responsável. A seção vem da aba ativa (não se escolhe aqui, pra não gravar
              um registro numa seção diferente da que está sendo vista). */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Data:</span>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-8 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {secao === 'Cozinha' ? '👨‍🍳' : '🍺'} Responsável:
              </span>
              <select
                value={responsavelId}
                onChange={e => setResponsavelId(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[11rem]"
              >
                <option value="">— não informado —</option>
                {responsaveis.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nome}{p.cargo ? ` · ${p.cargo}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fotos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Camera className="w-4 h-4" />Fotos {fotos.length > 0 && <span className="text-muted-foreground">({fotos.length})</span>}
                <span className="text-red-500">*</span>
              </div>
              {/* Dois caminhos: câmera direto (capture) e galeria/arquivos (sem capture). */}
              <input ref={cameraInputRef} type="file" accept="image/*" multiple capture="environment"
                className="hidden" onChange={e => onEscolherFotos(e.target.files)} />
              <input ref={fotoInputRef} type="file" accept="image/*" multiple
                className="hidden" onChange={e => onEscolherFotos(e.target.files)} />
              {subindoFoto ? (
                <Button size="sm" variant="outline" disabled>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Subindo...
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-1.5" />Tirar foto
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fotoInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1.5" />Galeria
                  </Button>
                </div>
              )}
            </div>
            {fotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotos.map(f => (
                  <div key={f.storage_path} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="foto" className="w-full h-24 object-cover rounded border" />
                    <button onClick={() => removerFoto(f.storage_path)} className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-md py-6 text-center text-sm text-muted-foreground">
                Nenhuma foto ainda. Clique em <b>Adicionar fotos</b> pra tirar/anexar.
              </div>
            )}
          </div>

          {/* Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Itens desperdiçados <span className="text-red-500">*</span></div>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1.5" />Adicionar item
              </Button>
            </div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <ItemRow key={idx} insumos={insumos} item={it} referencias={referencias}
                  onChange={p => setItem(idx, p)}
                  onRemover={itens.length > 1 ? () => removerItem(idx) : undefined} />
              ))}
            </div>
          </div>

          {/* Observação geral */}
          <div className="space-y-1">
            <div className="text-sm font-medium">Observação geral</div>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
              placeholder="Ex.: freezer descongelou de manhã, perdas por queda etc." rows={2}
              className="w-full text-sm border rounded-md px-3 py-2 bg-transparent" />
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          {!podeSalvar && (
            <span className="mr-auto text-[11px] text-amber-700 dark:text-amber-400 self-center">
              {fotos.length === 0 ? 'Anexe ao menos 1 foto' :
                itens.some(it => !it.insumo_codigo || !it.qtd) ? 'Preencha insumo e qtd de todos os itens' :
                itens.some(it => !it.area) ? 'Escolha a área de cada item' : ''}
            </span>
          )}
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || salvando || subindoFoto}>
            {salvando ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Salvando...</> : <><Check className="w-4 h-4 mr-1.5" />Salvar registro</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Linha de item — autocomplete insumo, qtd, motivo, obs
// ─────────────────────────────────────────────────────────────────────────────

function ItemRow({
  insumos, item, onChange, onRemover, referencias,
}: {
  insumos: Insumo[]; item: Item; onChange: (p: Partial<Item>) => void; onRemover?: () => void;
  referencias: Map<string, Referencia>;
}) {
  const [busca, setBusca] = useState('');
  const [abertoBusca, setAbertoBusca] = useState(false);
  // Texto CRU do campo de quantidade. Antes o input era controlado pelo número já convertido
  // (`value={item.qtd ? ... : ''}`), e isso tornava impossível digitar qualquer valor começando
  // com zero: ao teclar "0", parseQtd devolvia 0, que é falsy, e o campo se limpava sozinho —
  // ninguém conseguia lançar 0,072 kg (72 g) no iPad. Guardando o texto, "0", "0," e "0,0"
  // sobrevivem enquanto a pessoa digita; o número é derivado em paralelo.
  const [qtdTexto, setQtdTexto] = useState(item.qtd ? String(item.qtd).replace('.', ',') : '');
  const buscaRef = useRef<HTMLInputElement>(null);
  const buscaWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (abertoBusca) buscaRef.current?.focus(); }, [abertoBusca]);
  // Fecha o dropdown ao clicar fora do input+lista (bug reportado 2026-07-18: abrir a
  // busca e clicar em outro lugar do modal não fechava).
  useEffect(() => {
    if (!abertoBusca) return;
    const h = (e: MouseEvent) => {
      if (!buscaWrapperRef.current) return;
      if (!buscaWrapperRef.current.contains(e.target as Node)) setAbertoBusca(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [abertoBusca]);
  const selecionado = useMemo(() => insumos.find(i => i.codigo === item.insumo_codigo), [insumos, item.insumo_codigo]);

  // Âncora do item: preço e quanto ele costuma ter em estoque. Não dá pra confiar no rótulo de
  // unidade do cadastro (o "Limão taiti (kg)" está como 'g'), então o que orienta a pessoa é o
  // R$ na hora + a comparação com a última contagem.
  const ref = referencias.get(String(item.insumo_codigo || '').toUpperCase());
  const valorPrevisto = ref?.preco && item.qtd ? Math.round(Number(item.qtd) * Number(ref.preco) * 100) / 100 : null;
  // Suspeito = quantidade muito acima do estoque real do item (típico de digitar g onde é kg,
  // que erra por 1000) ou valor alto demais pra um lançamento de desperdício.
  const excedeEstoque = !!(ref?.ultima_qtd && Number(ref.ultima_qtd) > 0 && Number(item.qtd || 0) > Number(ref.ultima_qtd) * 10);
  const suspeito = !!(valorPrevisto != null && (valorPrevisto > 300 || excedeEstoque));
  // sugestão de correção: quase sempre a pessoa digitou na subunidade (g/ml)
  const sugestao = item.qtd ? Number(item.qtd) / 1000 : null;

  // Lista completa (sem corte em 8): no iPad a barra de rolagem não aparece e o time
  // achava que só existiam os primeiros itens. Ranking: nome que começa com o termo
  // vem primeiro, depois nome que contém, por último código/categoria.
  const { filtrados, total } = useMemo(() => {
    const LIMITE = 200; // teto só de renderização (DOM no iPad); `total` continua real
    const q = norm(busca);
    if (!q) return { filtrados: insumos.slice(0, LIMITE), total: insumos.length };
    const rank = (i: Insumo) => {
      const n = norm(i.nome);
      if (n.startsWith(q)) return 0;
      if (n.includes(q)) return 1;
      if (norm(i.codigo).includes(q)) return 2;
      if (norm(i.categoria).includes(q)) return 3;
      return 9;
    };
    const achados = insumos
      .map(i => ({ i, r: rank(i) }))
      .filter(x => x.r < 9)
      .sort((a, b) => a.r - b.r || norm(a.i.nome).localeCompare(norm(b.i.nome)))
      .map(x => x.i);
    return { filtrados: achados.slice(0, LIMITE), total: achados.length };
  }, [insumos, busca]);

  return (
    <div className="rounded-md border p-2.5 space-y-2 bg-muted/20">
      <div className="flex items-start gap-2 flex-wrap">
        {/* Insumo */}
        <div className="flex-1 min-w-[180px] relative">
          {selecionado && !abertoBusca ? (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-9 border rounded-md px-2.5 flex items-center bg-background">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{selecionado.nome}</div>
                  <div className="text-[11px] text-muted-foreground">{selecionado.codigo}{selecionado.unidade_medida ? ` · ${selecionado.unidade_medida}` : ''}</div>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setAbertoBusca(true); setBusca(''); }}><Search className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="relative" ref={buscaWrapperRef}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={buscaRef} placeholder="Buscar insumo por nome ou código..." className="h-9 pl-8"
                value={busca} onChange={e => { setBusca(e.target.value); setAbertoBusca(true); }}
                onFocus={() => setAbertoBusca(true)} />
              {abertoBusca && filtrados.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg max-h-72 overflow-y-auto overscroll-contain scrollbar-thin">
                  {/* Contador fixo no topo: no iPad a barra de rolagem é invisível, então o
                      número é o único aviso de que existe mais item abaixo. */}
                  <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur border-b px-2.5 py-1 text-[11px] text-muted-foreground">
                    {filtrados.length < total
                      ? <>mostrando {filtrados.length} de {total} · refine a busca</>
                      : <>{total} {total === 1 ? 'insumo' : 'insumos'}</>}
                    {filtrados.length > 4 && <span> · role a lista ↓</span>}
                  </div>
                  {filtrados.map(i => (
                    <button key={`${i.origem_tipo || 'insumo'}-${i.codigo}`}
                      onClick={() => {
                        onChange({
                          insumo_codigo: i.codigo, insumo_nome: i.nome,
                          unidade: i.unidade_medida || 'un',
                          origem_tipo: i.origem_tipo, origem_nome: i.origem_tipo === 'produto' ? i.nome : undefined,
                        });
                        setAbertoBusca(false); setBusca('');
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-accent text-sm">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {i.nome}
                        {i.origem_tipo === 'produto' && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            prato pronto
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {i.origem_tipo === 'produto'
                          ? 'desconta tudo que vai nele (pão, blend, queijo, molho...)'
                          : <>{i.codigo}{i.unidade_medida ? ` · ${i.unidade_medida}` : ''}{i.categoria ? ` · ${i.categoria}` : ''}</>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Qtd + o R$ que ela vale AO VIVO. Antes o campo era um número solto: a pessoa só
            descobria o estrago depois de salvar. Foi assim que 1500 (ml de chopp) virou 1.500
            barris = R$ 521.925 no teste do Deboche em 02/08. */}
        <div className="w-28">
          {/* Rótulo da unidade REAL (base+embalagem), não o unidade_medida do cadastro: é o que
              o Isaías pediu — "tá para g mas o preço tá em kg". Limão vira "kg", barril vira
              "un (30 L)". Sem isso ninguém sabe em que unidade digitar. */}
          {selecionado && (
            <div className="text-[10px] text-muted-foreground text-right mb-0.5 truncate" title="Unidade em que este item é contado e precificado">
              em <b>{rotuloUnidade(selecionado)}</b>
            </div>
          )}
          <Input type="text" inputMode="decimal" placeholder="Qtd" className="h-9 text-right"
            value={qtdTexto}
            onChange={e => {
              // Aceita só dígitos e UM separador decimal (vírgula ou ponto). O texto fica como a
              // pessoa digitou; o item recebe o número. "0,072" → 0.072.
              const limpo = e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');
              setQtdTexto(limpo);
              onChange({ qtd: parseQtd(limpo) });
            }} />
          {valorPrevisto != null && (
            <div className={`mt-0.5 text-[11px] text-right tabular-nums ${suspeito ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
              {fmtBRL(valorPrevisto)}
            </div>
          )}
        </div>

        {onRemover && (
          <Button size="sm" variant="ghost" onClick={onRemover} title="Remover item">
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        )}
      </div>

      {/* Aviso de ordem de grandeza — o campo não tem como dizer a unidade certa (o cadastro
          mente), então a checagem é contra a REALIDADE do item: o que ele custa e o que costuma
          ter em estoque. Um clique corrige pra subunidade, que é o erro de 99% dos casos. */}
      {suspeito && (
        <div className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-[11px] text-red-800 dark:text-red-300">
          <div className="font-semibold">Confere essa quantidade?</div>
          <div className="mt-0.5">
            {item.qtd} × {fmtBRL(Number(ref?.preco))} = <b>{fmtBRL(valorPrevisto)}</b>
            {excedeEstoque && ref?.ultima_qtd != null && (
              <> — e é {Math.round(Number(item.qtd) / Number(ref.ultima_qtd))}× o que tinha na última contagem ({fmtQtdItem(Number(ref.ultima_qtd), rotuloUnidade(selecionado))}{ref.ultima_data ? `, ${fmtDate(ref.ultima_data)}` : ''}).</>
            )}
          </div>
          {sugestao != null && (
            <button type="button"
              onClick={() => { const t = String(sugestao).replace('.', ','); setQtdTexto(t); onChange({ qtd: sugestao }); }}
              className="mt-1 underline font-medium">
              Se você digitou em {rotuloUnidade(selecionado) === 'L' ? 'ml' : 'gramas'}, clique aqui pra usar {String(sugestao).replace('.', ',')} {rotuloUnidade(selecionado)}
            </button>
          )}
        </div>
      )}

      {/* Área — onde ocorreu o desperdício (finalização vs produção, por setor). Obrigatório. */}
      <div>
        <div className={`text-[11px] font-medium mb-1 ${item.area ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
          Área do desperdício <span className="text-red-500">*</span>
          {!item.area && <span className="ml-1 text-[10px] font-normal">— escolha uma</span>}
        </div>
        <div className={`flex flex-wrap gap-1.5 ${!item.area ? 'p-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
          {AREAS.map((a) => (
            <button
              key={a.v}
              type="button"
              onClick={() => onChange({ area: item.area === a.v ? null : a.v })}
              title={a.hint}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                item.area === a.v
                  ? `${areaBadgeCor(a.v)} border-current font-semibold`
                  : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {a.l}
            </button>
          ))}
        </div>
      </div>

      {/* Motivo + observação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input value={item.motivo || ''} onChange={e => onChange({ motivo: e.target.value })}
          placeholder="Motivo (ex.: passou da validade, queimou...)" className="h-8 text-sm" />
        <Input value={item.observacao || ''} onChange={e => onChange({ observacao: e.target.value })}
          placeholder="Observação (opcional)" className="h-8 text-sm" />
      </div>
    </div>
  );
}
