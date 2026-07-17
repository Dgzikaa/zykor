'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import Analises from './Analises';
import { RefreshCw, Download, Search, X, SlidersHorizontal, Users, ChevronRight, ChevronDown, Layers, Filter, Check, Tag, Pencil, AlertTriangle, EyeOff, RotateCcw } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface Linha {
  categoria: string;
  data: string;
  mesa: string | null;
  motivo: string | null;
  produto: string | null;
  qtd: number;
  valor_bruto: number;
  custo: number;
  tem_ficha: boolean;
  chave_hash: string;
  ignorada: boolean;
  ignorada_motivo: string | null;
  ignorada_em: string | null;
}
interface Resumo {
  categoria: string;
  linhas: number;
  com_ficha: number;
  bruto: number;
  custo: number;
}
// Grupo = uma mesa/pessoa (ex.: artista, sócio), consolidando seus produtos no período.
interface Grupo {
  key: string; // mesa normalizada (colapsa variações de grafia)
  mesaLabel: string; // rótulo exibido (grafia mais recente)
  categoria: string; // '__varios' se a mesa mistura categorias
  motivo: string; // '__varios' se mistura motivos
  dias: number; // nº de datas distintas
  ultimaData: string;
  itens: number;
  bruto: number;
  custo: number;
  todasComFicha: boolean;
  linhas: Linha[];
}
// normaliza a mesa pra agrupar "X Fidelidade" / "X-Fidelidade" / "XFidelidade" juntos
const normMesa = (m: string | null) => (m || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || '—';

interface Cadastro {
  id: number;
  nome: string;
}
interface Vinculo {
  mesa_norm: string;
  mesa_label: string | null;
  tipo: string | null;
  artista_id: number | null;
  socio_id: number | null;
  entidade_nome: string | null;
  categoria_override: string | null;
}
// tipos de vínculo (define a categoria implícita, salvo override explícito)
const TIPOS: { key: string; label: string }[] = [
  { key: 'artista', label: 'Artista' },
  { key: 'socio', label: 'Sócio' },
  { key: 'funcionario', label: 'Funcionário' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'outro', label: 'Outro' },
];

// agrupa linhas por mesa/pessoa (normalizada) — reutilizado no agrupamento simples e no 2 camadas
function agruparMesas(linhas: Linha[]): Grupo[] {
  const m = new Map<string, Grupo & { _datas: Set<string> }>();
  for (const l of linhas) {
    const key = normMesa(l.mesa);
    let g = m.get(key);
    if (!g) {
      g = {
        key,
        mesaLabel: l.mesa || '(sem mesa)',
        categoria: l.categoria,
        motivo: l.motivo || '',
        dias: 0,
        ultimaData: l.data,
        itens: 0,
        bruto: 0,
        custo: 0,
        todasComFicha: true,
        linhas: [],
        _datas: new Set<string>(),
      };
      m.set(key, g);
    }
    g.itens += 1;
    g.bruto += l.valor_bruto;
    g.custo += l.custo;
    g._datas.add(l.data);
    if (l.data > g.ultimaData) {
      g.ultimaData = l.data;
      g.mesaLabel = l.mesa || '(sem mesa)';
    }
    if (!l.tem_ficha) g.todasComFicha = false;
    if (g.categoria !== l.categoria) g.categoria = '__varios';
    if (g.motivo !== (l.motivo || '')) g.motivo = '__varios';
    g.linhas.push(l);
  }
  return Array.from(m.values()).map((g) => {
    g.dias = g._datas.size;
    g.linhas.sort((a, b) => (a.data !== b.data ? (a.data < b.data ? 1 : -1) : b.valor_bruto - a.valor_bruto));
    return g;
  });
}

// 9 categorias padronizadas + Outros (mesma classificação da Gestão CMV)
const CATS: { key: string; label: string; cor: string }[] = [
  { key: 'funcionarios_operacao', label: 'Funcionário Operação', cor: 'bg-blue-500' },
  { key: 'funcionarios_escritorio', label: 'Funcionário Escritório', cor: 'bg-indigo-500' },
  { key: 'aniversario', label: 'Aniversário', cor: 'bg-pink-500' },
  { key: 'programa_pontos', label: 'Programa de Pontos', cor: 'bg-purple-500' },
  { key: 'beneficio_cliente', label: 'Benefício Cliente', cor: 'bg-teal-500' },
  { key: 'influencer', label: 'Influencer', cor: 'bg-fuchsia-500' },
  { key: 'artistas', label: 'Artistas', cor: 'bg-amber-500' },
  { key: 'socios', label: 'Sócios', cor: 'bg-emerald-500' },
  { key: 'relacionamento', label: 'Relacionamento', cor: 'bg-orange-500' },
  { key: 'outros', label: 'Outros', cor: 'bg-gray-500' },
];
const LABEL = Object.fromEntries(CATS.map((c) => [c.key, c.label]));
const COR = Object.fromEntries(CATS.map((c) => [c.key, c.cor]));

const DOW = [
  { i: 0, l: 'Dom', n: 'Domingo' },
  { i: 1, l: 'Seg', n: 'Segunda' },
  { i: 2, l: 'Ter', n: 'Terça' },
  { i: 3, l: 'Qua', n: 'Quarta' },
  { i: 4, l: 'Qui', n: 'Quinta' },
  { i: 5, l: 'Sex', n: 'Sexta' },
  { i: 6, l: 'Sáb', n: 'Sábado' },
];

const moeda = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const brData = (s: string) => (s ? s.split('-').reverse().join('/') : '-');
const dowDe = (s: string) => new Date(s + 'T12:00:00').getDay();

const POR_PAGINA = 100;

const PRESETS: { key: string; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'semana', label: 'Semana atual' },
  { key: 'mes', label: 'Mês atual' },
  { key: 'mesPassado', label: 'Mês passado' },
  { key: 'd30', label: 'Últimos 30 dias' },
];

// Combobox: input com dropdown pra baixo (rolagem), filtra conforme digita. Substitui o
// <datalist> nativo, que abre de forma inconsistente (às vezes na lateral).
function Combobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const base = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return base.slice(0, 300);
  }, [options, value]);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="input-dark pr-7"
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange('');
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o);
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                title={o}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Cabeçalho de coluna com popover de checkboxes (valores distintos + contagem), estilo DataTable
// (mesmo padrão da tela de Insumos). Renderizado em portal pra não ser cortado pelo overflow.
type ColAlign = 'left' | 'center' | 'right';
function ColHeader({
  label,
  align = 'left',
  options,
  selected,
  onChange,
}: {
  label: string;
  align?: ColAlign;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Menu abre pra baixo por padrão, mas se não couber (tabela longa, botão perto do
  // fim da viewport), inverte pra cima. Sem isso, o dropdown ficava cortado e não
  // dava pra clicar nas opções.
  const [pos, setPos] = useState<
    | { left: number; direcao: 'baixo'; top: number; maxHeight: number }
    | { left: number; direcao: 'cima'; bottom: number; maxHeight: number }
    | null
  >(null);
  const active = selected.size > 0;

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 268));
      const alturaEstim = 340; // input + controles + lista(max-h-64) + padding
      const espacoAbaixo = window.innerHeight - r.bottom - 8;
      const espacoAcima = r.top - 8;
      const abrirPraCima = espacoAbaixo < alturaEstim && espacoAcima > espacoAbaixo;
      if (abrirPraCima) {
        setPos({ left, direcao: 'cima', bottom: window.innerHeight - r.top + 4, maxHeight: Math.max(160, espacoAcima) });
      } else {
        setPos({ left, direcao: 'baixo', top: r.bottom + 4, maxHeight: Math.max(160, espacoAbaixo) });
      }
    }
    setQ('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onAway = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onAway);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onAway);
    };
  }, [open]);

  const shown = q ? options.filter((o) => o.value.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = (v: string) => {
    const n = new Set(selected);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    onChange(n);
  };
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th className={`${alignCls} font-medium px-3 py-2`}>
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
      >
        <span>{label}</span>
        <Filter className={`w-3 h-3 ${active ? 'fill-emerald-500 text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`} />
        {active && (
          <span className="text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1 leading-4">
            {selected.size}
          </span>
        )}
      </button>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: pos.left,
              width: 256,
              ...(pos.direcao === 'baixo' ? { top: pos.top } : { bottom: pos.bottom }),
              maxHeight: pos.maxHeight,
            }}
            className="z-[60] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2 normal-case flex flex-col"
          >
            <Input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar valores…" className="h-8 text-xs" />
            <div className="flex items-center justify-between px-1 py-1.5 text-[11px] text-gray-500">
              <button className="hover:text-emerald-600" onClick={() => onChange(new Set(options.map((o) => o.value)))}>
                Todos
              </button>
              <span>{selected.size ? `${selected.size} sel.` : `${options.length} valores`}</span>
              <button className="hover:text-red-600" onClick={() => onChange(new Set())}>
                Limpar
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {shown.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-gray-400">Nada</div>
              ) : (
                shown.map((o) => {
                  const on = selected.has(o.value);
                  return (
                    <button
                      key={o.value}
                      onClick={() => toggle(o.value)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded"
                    >
                      <span
                        className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}
                      >
                        {on && <Check className="w-3 h-3" />}
                      </span>
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{o.value}</span>
                      <span className="text-gray-400 tabular-nums">{o.count}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </th>
  );
}

// Modal pra vincular uma mesa a artista/sócio cadastrado e/ou forçar a categoria.
function VinculoEditor({
  mesaLabel,
  atual,
  artistas,
  socios,
  onClose,
  onSalvar,
  onRemover,
  onCriarSocio,
}: {
  mesaLabel: string;
  atual: Vinculo | undefined;
  artistas: Cadastro[];
  socios: Cadastro[];
  onClose: () => void;
  onSalvar: (payload: Record<string, unknown>) => Promise<any>;
  onRemover: () => Promise<void>;
  onCriarSocio: (nome: string) => Promise<Cadastro | undefined>;
}) {
  const [tipo, setTipo] = useState(atual?.tipo || '');
  const [artistaNome, setArtistaNome] = useState(artistas.find((a) => a.id === atual?.artista_id)?.nome || '');
  const [socioNome, setSocioNome] = useState(socios.find((s) => s.id === atual?.socio_id)?.nome || '');
  const [entidadeNome, setEntidadeNome] = useState(atual?.entidade_nome || '');
  const [catOverride, setCatOverride] = useState(atual?.categoria_override || '');
  const [novoSocio, setNovoSocio] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sociosLocal, setSociosLocal] = useState(socios);

  const salvar = async () => {
    setSalvando(true);
    const artistaSel = artistas.find((a) => a.nome === artistaNome);
    const socioSel = sociosLocal.find((s) => s.nome === socioNome);
    let nome = entidadeNome;
    if (tipo === 'artista') nome = artistaSel?.nome || artistaNome || nome;
    if (tipo === 'socio') nome = socioSel?.nome || socioNome || nome;
    await onSalvar({
      mesa: mesaLabel,
      tipo: tipo || null,
      artista_id: tipo === 'artista' ? artistaSel?.id ?? null : null,
      socio_id: tipo === 'socio' ? socioSel?.id ?? null : null,
      entidade_nome: nome || null,
      categoria_override: catOverride || null,
    });
    setSalvando(false);
    onClose();
  };

  const criarSocio = async () => {
    const n = novoSocio.trim();
    if (!n) return;
    const s = await onCriarSocio(n);
    if (s) {
      setSociosLocal((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s].sort((a, b) => a.nome.localeCompare(b.nome))));
      setSocioNome(s.nome);
      setNovoSocio('');
    }
  };

  const selCls = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Vincular mesa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Mesa: <span className="font-medium text-gray-700 dark:text-gray-200">{mesaLabel}</span>
        </p>

        <div>
          <span className="block text-[11px] font-medium text-gray-500 mb-1">Tipo</span>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTipo(t.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${tipo === t.key ? 'bg-[hsl(var(--primary))] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'artista' && (
          <div>
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Artista cadastrado</span>
            <Combobox value={artistaNome} onChange={setArtistaNome} options={artistas.map((a) => a.nome)} placeholder="Digite pra buscar…" />
          </div>
        )}

        {tipo === 'socio' && (
          <div className="space-y-2">
            <div>
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Sócio cadastrado</span>
              <Combobox value={socioNome} onChange={setSocioNome} options={sociosLocal.map((s) => s.nome)} placeholder="Digite pra buscar…" />
            </div>
            <div className="flex gap-1.5">
              <Input value={novoSocio} onChange={(e) => setNovoSocio(e.target.value)} placeholder="Novo sócio…" className="h-8 text-xs" />
              <Button size="sm" variant="outline" onClick={criarSocio} disabled={!novoSocio.trim()}>
                Criar
              </Button>
            </div>
          </div>
        )}

        {(tipo === 'funcionario' || tipo === 'cliente' || tipo === 'outro') && (
          <div>
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Nome</span>
            <Input value={entidadeNome} onChange={(e) => setEntidadeNome(e.target.value)} placeholder="Nome da pessoa…" className="h-8 text-sm" />
          </div>
        )}

        <div>
          <span className="block text-[11px] font-medium text-gray-500 mb-1">
            Categoria {tipo && tipo !== 'cliente' && tipo !== 'outro' ? '(deixe automática pelo tipo)' : ''}
          </span>
          <select value={catOverride} onChange={(e) => setCatOverride(e.target.value)} className={selCls}>
            <option value="">Automática (pelo tipo / motivo)</option>
            {CATS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-1">
          {atual ? (
            <Button size="sm" variant="outline" onClick={async () => { await onRemover(); onClose(); }} className="text-red-600">
              Remover vínculo
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Modal só de CATEGORIA (reclassificar) — separado do vínculo de mesa. Admin only.
// Grava categoria_override no vínculo da mesa (preservando a tag de pessoa, se houver).
function CategoriaPicker({
  mesaLabel, atual, onClose, onPick,
}: {
  mesaLabel: string;
  atual: string | undefined;
  onClose: () => void;
  onPick: (catKey: string | null) => Promise<void>;
}) {
  const [salvando, setSalvando] = useState(false);
  const pick = async (k: string | null) => { setSalvando(true); await onPick(k); setSalvando(false); onClose(); };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Reclassificar categoria</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-gray-500">Mesa: <span className="font-medium text-gray-700 dark:text-gray-200">{mesaLabel}</span></p>
        <div className="grid grid-cols-2 gap-1.5">
          {CATS.map((c) => (
            <button key={c.key} onClick={() => pick(c.key)} disabled={salvando}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs text-left transition-colors disabled:opacity-50 ${atual === c.key ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${c.cor}`} />
              <span className="truncate">{c.label}</span>
              {atual === c.key && <Check className="w-3 h-3 ml-auto text-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
        <button onClick={() => pick(null)} disabled={salvando} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline disabled:opacity-50">
          Voltar ao automático (pela classificação do motivo)
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default function ControleConsumacaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { isRole } = usePermissions();
  const isAdmin = isRole('admin');

  const hoje = new Date();
  const primeiroDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [di, setDi] = useState(iso(primeiroDoMes));
  const [df, setDf] = useState(iso(hoje));
  const [presetAtivo, setPresetAtivo] = useState<string>('mes');
  const [loading, setLoading] = useState(false);
  const [fator, setFator] = useState(0.35);
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalCusto, setTotalCusto] = useState(0);
  const [totalBrutoIgnorado, setTotalBrutoIgnorado] = useState(0);
  const [qtdIgnoradas, setQtdIgnoradas] = useState(0);
  // Modo de visualização das ignoradas:
  //   'ativas' (padrão) — ocultas do controle (o objetivo do "ignorar")
  //   'todas' — mostra tudo (ignoradas aparecem tachadas)
  //   'so_ignoradas' — vê só o que foi ignorado (pra restaurar/auditar)
  const [modoIgnoradas, setModoIgnoradas] = useState<'ativas' | 'todas' | 'so_ignoradas'>('ativas');
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [cadArtistas, setCadArtistas] = useState<Cadastro[]>([]);
  const [cadSocios, setCadSocios] = useState<Cadastro[]>([]);
  const [editandoMesa, setEditandoMesa] = useState<{ mesaLabel: string; mesaNorm: string } | null>(null);
  const [editandoCategoria, setEditandoCategoria] = useState<{ mesaLabel: string; mesaNorm: string } | null>(null);
  const [tab, setTab] = useState('lancamentos');

  // filtros client-side
  const [catFiltro, setCatFiltro] = useState<Set<string>>(new Set());
  const [diaSemana, setDiaSemana] = useState<Set<number>>(new Set());
  const [motivoSel, setMotivoSel] = useState('');
  const [produtoSel, setProdutoSel] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  // ordenação da tabela (default: data mais recente primeiro)
  const [ordem, setOrdem] = useState<{ campo: 'data' | 'valor_bruto' | 'custo' | 'qtd'; dir: 'asc' | 'desc' }>({
    campo: 'data',
    dir: 'desc',
  });
  // agrupar consumações da mesma mesa (data+mesa); default ligado
  const [agrupar, setAgrupar] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  // 2 camadas: Categoria › Mesa (default ligado). catExpandidos guarda categorias ABERTAS
  // (default: vazio = tudo colapsado; expande clicando)
  const [porCat, setPorCat] = useState(true);
  const [catExpandidos, setCatExpandidos] = useState<Set<string>>(new Set());
  // filtros por coluna (estilo DataTable, igual à tela de insumos)
  const [colFiltros, setColFiltros] = useState<{ categoria: Set<string>; mesa: Set<string>; motivo: Set<string>; produto: Set<string> }>({
    categoria: new Set(),
    mesa: new Set(),
    motivo: new Set(),
    produto: new Set(),
  });
  const setCol = (id: 'categoria' | 'mesa' | 'motivo' | 'produto', next: Set<string>) =>
    setColFiltros((prev) => ({ ...prev, [id]: next }));

  useEffect(() => setPageTitle('Controle de Consumação'), [setPageTitle]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/operacional/consumacao?data_inicio=${di}&data_fim=${df}`, {
        headers: { 'x-selected-bar-id': String(selectedBar.id) },
      });
      const j = await r.json();
      if (!j.success) {
        toast.error(j.error || 'Erro ao carregar');
        return;
      }
      setFator(j.fator ?? 0.35);
      setResumo(j.resumo || []);
      setLinhas(j.linhas || []);
      setTotalBruto(j.total_bruto || 0);
      setTotalCusto(j.total_custo || 0);
      setTotalBrutoIgnorado(j.total_bruto_ignorado || 0);
      setQtdIgnoradas(j.qtd_ignoradas || 0);
      setVinculos(j.vinculos || []);
      setCadArtistas(j.artistas || []);
      setCadSocios(j.socios || []);
    } catch {
      toast.error('Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [selectedBar, di, df]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Ignorar/restaurar — o backend guarda por (bar_id, chave_hash). Depois recarrega
  // pra propagar o efeito nos totais/resumo.
  const ignorarLinhas = useCallback(
    async (chaves: string[], motivoIgn?: string) => {
      if (!chaves.length) return;
      try {
        const r = await fetch('/api/operacional/consumacao/ignorar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
          body: JSON.stringify({ chaves, motivo: motivoIgn || undefined }),
        });
        const j = await r.json();
        if (!j.success) {
          toast.error(j.error || 'Falha ao ignorar');
          return;
        }
        toast.success(chaves.length === 1 ? 'Consumação ignorada' : `${chaves.length} consumações ignoradas`);
        await carregar();
      } catch {
        toast.error('Falha ao ignorar');
      }
    },
    [selectedBar, carregar],
  );

  const restaurarLinhas = useCallback(
    async (chaves: string[]) => {
      if (!chaves.length) return;
      try {
        const r = await fetch(`/api/operacional/consumacao/ignorar?chaves=${encodeURIComponent(chaves.join(','))}`, {
          method: 'DELETE',
          headers: { 'x-selected-bar-id': String(selectedBar?.id || '') },
        });
        const j = await r.json();
        if (!j.success) {
          toast.error(j.error || 'Falha ao restaurar');
          return;
        }
        toast.success(chaves.length === 1 ? 'Restaurada' : `${chaves.length} restauradas`);
        await carregar();
      } catch {
        toast.error('Falha ao restaurar');
      }
    },
    [selectedBar, carregar],
  );

  // qualquer mudança de filtro volta pra página 1
  useEffect(() => {
    setPagina(1);
  }, [catFiltro, diaSemana, motivoSel, produtoSel, busca, di, df, agrupar, colFiltros, porCat, modoIgnoradas]);

  const preset = (tipo: string) => {
    const h = new Date();
    const set = (a: Date, b: Date) => {
      setDi(iso(a));
      setDf(iso(b));
    };
    if (tipo === 'hoje') set(h, h);
    else if (tipo === 'ontem') {
      const o = new Date(h);
      o.setDate(h.getDate() - 1);
      set(o, o);
    } else if (tipo === 'semana') {
      const seg = new Date(h);
      seg.setDate(h.getDate() - ((h.getDay() + 6) % 7));
      set(seg, h);
    } else if (tipo === 'mes') set(new Date(h.getFullYear(), h.getMonth(), 1), h);
    else if (tipo === 'mesPassado') set(new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 0));
    else {
      const d = new Date(h);
      d.setDate(h.getDate() - 29);
      set(d, h);
    }
    setPresetAtivo(tipo);
  };

  const toggleCat = (key: string) => {
    const marcando = !catFiltro.has(key);
    setCatFiltro((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
    // clicou no card -> já expande (ou colapsa ao desmarcar) essa categoria nas 2 camadas
    setCatExpandidos((prev) => {
      const n = new Set(prev);
      if (marcando) n.add(key);
      else n.delete(key);
      return n;
    });
  };
  const toggleDow = (i: number) =>
    setDiaSemana((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  // opções de motivo/produto derivadas das linhas carregadas
  const motivos = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.motivo).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [linhas],
  );
  const produtos = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.produto).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [linhas],
  );

  const colAtivo = colFiltros.categoria.size + colFiltros.mesa.size + colFiltros.motivo.size + colFiltros.produto.size;
  const temFiltro = catFiltro.size > 0 || diaSemana.size > 0 || !!motivoSel || !!produtoSel || !!busca || colAtivo > 0;

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const mv = motivoSel.trim().toLowerCase();
    const pr = produtoSel.trim().toLowerCase();
    return linhas.filter((l) => {
      // "ativas" (padrão) esconde ignoradas; "so_ignoradas" mostra só elas;
      // "todas" mostra tudo (ignoradas ficam com destaque na tabela).
      if (modoIgnoradas === 'ativas' && l.ignorada) return false;
      if (modoIgnoradas === 'so_ignoradas' && !l.ignorada) return false;
      if (catFiltro.size > 0 && !catFiltro.has(l.categoria)) return false;
      if (diaSemana.size > 0 && !diaSemana.has(dowDe(l.data))) return false;
      if (mv && !(l.motivo || '').toLowerCase().includes(mv)) return false;
      if (pr && !(l.produto || '').toLowerCase().includes(pr)) return false;
      // filtros por coluna (checkbox)
      if (colFiltros.categoria.size > 0 && !colFiltros.categoria.has(LABEL[l.categoria] || l.categoria)) return false;
      if (colFiltros.mesa.size > 0 && !colFiltros.mesa.has(l.mesa || '(sem mesa)')) return false;
      if (colFiltros.motivo.size > 0 && !colFiltros.motivo.has(l.motivo || '(sem motivo)')) return false;
      if (colFiltros.produto.size > 0 && !colFiltros.produto.has(l.produto || '(sem produto)')) return false;
      if (q) {
        const alvo = `${l.motivo || ''} ${l.produto || ''} ${l.mesa || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [linhas, catFiltro, diaSemana, motivoSel, produtoSel, busca, colFiltros, modoIgnoradas]);

  // opções (valor distinto + contagem) por coluna, para os popovers de filtro
  const opcoesCol = useMemo(() => {
    const mk = (getter: (l: Linha) => string) => {
      const m = new Map<string, number>();
      for (const l of linhas) {
        const v = getter(l);
        m.set(v, (m.get(v) || 0) + 1);
      }
      return Array.from(m.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    };
    return {
      categoria: mk((l) => LABEL[l.categoria] || l.categoria),
      mesa: mk((l) => l.mesa || '(sem mesa)'),
      motivo: mk((l) => l.motivo || '(sem motivo)'),
      produto: mk((l) => l.produto || '(sem produto)'),
    };
  }, [linhas]);

  const totFiltrado = useMemo(
    () => ({
      bruto: linhasFiltradas.reduce((s, l) => s + l.valor_bruto, 0),
      custo: linhasFiltradas.reduce((s, l) => s + l.custo, 0),
    }),
    [linhasFiltradas],
  );

  const linhasOrdenadas = useMemo(() => {
    const arr = [...linhasFiltradas];
    const mul = ordem.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (ordem.campo === 'data') {
        // desempate por valor desc dentro do mesmo dia
        if (a.data !== b.data) return a.data < b.data ? -1 * mul : 1 * mul;
        return b.valor_bruto - a.valor_bruto;
      }
      return (Number(a[ordem.campo]) - Number(b[ordem.campo])) * mul;
    });
    return arr;
  }, [linhasFiltradas, ordem]);

  // agrupa as linhas filtradas por mesa/pessoa (normalizada) no período
  const grupos = useMemo<Grupo[]>(() => agruparMesas(linhasFiltradas), [linhasFiltradas]);

  // 2 camadas: categoria -> mesas
  const gruposPorCategoria = useMemo(() => {
    const catMap = new Map<string, Linha[]>();
    for (const l of linhasFiltradas) {
      const arr = catMap.get(l.categoria) || [];
      arr.push(l);
      catMap.set(l.categoria, arr);
    }
    return Array.from(catMap.entries())
      .map(([cat, ls]) => ({
        cat,
        mesas: agruparMesas(ls).sort((a, b) => b.custo - a.custo),
        custo: ls.reduce((s, l) => s + l.custo, 0),
        bruto: ls.reduce((s, l) => s + l.valor_bruto, 0),
        itens: ls.length,
      }))
      .sort((a, b) => b.custo - a.custo);
  }, [linhasFiltradas]);

  const gruposOrdenados = useMemo(() => {
    const arr = [...grupos];
    const mul = ordem.dir === 'asc' ? 1 : -1;
    const val = (g: Grupo) => (ordem.campo === 'qtd' ? g.itens : ordem.campo === 'custo' ? g.custo : g.bruto);
    arr.sort((a, b) => {
      if (ordem.campo === 'data') {
        if (a.ultimaData !== b.ultimaData) return a.ultimaData < b.ultimaData ? -1 * mul : 1 * mul;
        return b.bruto - a.bruto;
      }
      return (val(a) - val(b)) * mul;
    });
    return arr;
  }, [grupos, ordem]);

  const sortBy = (campo: 'data' | 'valor_bruto' | 'custo' | 'qtd') =>
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' }));
  const seta = (campo: string) => (ordem.campo === campo ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : '');

  const totalItensLista = agrupar ? gruposOrdenados.length : linhasOrdenadas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItensLista / POR_PAGINA));
  const pagina1 = Math.min(pagina, totalPaginas);
  const sliceIni = (pagina1 - 1) * POR_PAGINA;
  const pageGrupos = agrupar ? gruposOrdenados.slice(sliceIni, sliceIni + POR_PAGINA) : [];
  const pageLinhas = agrupar ? [] : linhasOrdenadas.slice(sliceIni, sliceIni + POR_PAGINA);

  const toggleExpandido = (key: string) =>
    setExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const toggleCatExp = (cat: string) =>
    setCatExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });

  const vincByNorm = useMemo(() => new Map(vinculos.map((v) => [v.mesa_norm, v])), [vinculos]);

  // render de um grupo de mesa (linha do grupo + produtos ao expandir) — usado no modo simples e no 2 camadas
  const renderGrupoMesa = (g: Grupo) => {
    const aberto = expandidos.has(g.key);
    const catMix = g.categoria === '__varios';
    const v = vincByNorm.get(g.key);
    return (
      <Fragment key={g.key}>
        <tr
          onClick={() => toggleExpandido(g.key)}
          className="border-t border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
        >
          <td className="px-3 py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{brData(g.ultimaData)}</td>
          <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{DOW[dowDe(g.ultimaData)].l}</td>
          <td className="px-3 py-1.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${catMix ? 'bg-gray-400' : COR[g.categoria] || 'bg-gray-400'}`} />
              <span className="text-gray-700 dark:text-gray-200">{catMix ? 'Vários' : LABEL[g.categoria] || g.categoria}</span>
              {!catMix && g.categoria === 'outros' && (
                <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">reclassificar</span>
              )}
              {isAdmin && !catMix && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditandoCategoria({ mesaLabel: g.mesaLabel, mesaNorm: g.key }); }}
                  title="Reclassificar categoria (admin)"
                  className="rounded p-0.5 text-gray-300 hover:text-indigo-500"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </span>
          </td>
          <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-800 dark:text-gray-100">
            <span className="inline-flex items-center gap-1">
              {aberto ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              {g.mesaLabel}
              {g.dias > 1 && <span className="ml-1 rounded bg-gray-100 dark:bg-gray-700 px-1 text-[10px] text-gray-500">{g.dias} dias</span>}
              {v?.entidade_nome && (
                <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 text-[10px]">
                  <Tag className="w-2.5 h-2.5" />
                  {v.entidade_nome}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditandoMesa({ mesaLabel: g.mesaLabel, mesaNorm: g.key });
                }}
                title={v ? 'Editar vínculo' : 'Vincular a artista/sócio'}
                className={`ml-1 rounded p-0.5 ${v ? 'text-indigo-500 hover:text-indigo-700' : 'text-gray-300 hover:text-indigo-500'}`}
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            </span>
          </td>
          <td className="px-3 py-1.5 text-gray-500 max-w-[240px] truncate" title={g.motivo === '__varios' ? 'Vários' : g.motivo}>
            {g.motivo === '__varios' ? 'Vários' : g.motivo || '-'}
          </td>
          <td className="px-3 py-1.5 text-gray-400">{g.itens} produto(s)</td>
          <td className="px-3 py-1.5 text-right text-gray-500">{g.itens.toLocaleString('pt-BR')}</td>
          <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">{moeda(g.bruto)}</td>
          <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100">{moeda(g.custo)}</td>
          <td className="px-2 py-1.5 text-center">
            {/* Ignorar/restaurar a mesa inteira — útil pra "mesa toda lançada errada". */}
            {(() => {
              const chaves = g.linhas.map((l) => l.chave_hash);
              const todasIgn = g.linhas.every((l) => l.ignorada);
              return todasIgn ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restaurarLinhas(chaves);
                  }}
                  title="Restaurar todas as linhas da mesa"
                  className="rounded p-1 text-gray-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const m = prompt(`Ignorar as ${chaves.length} linha(s) dessa mesa. Motivo (opcional):`) || undefined;
                    ignorarLinhas(chaves, m);
                  }}
                  title="Ignorar todas as linhas dessa mesa"
                  className="rounded p-1 text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              );
            })()}
          </td>
        </tr>
        {aberto &&
          g.linhas.map((l, i) => (
            <tr
              key={`${g.key}-${i}`}
              className={`bg-gray-50/60 dark:bg-gray-800/30 text-[13px] ${
                l.ignorada ? 'text-gray-400 dark:text-gray-500 line-through decoration-red-300/60' : ''
              }`}
              title={l.ignorada ? `Ignorada${l.ignorada_motivo ? `: ${l.ignorada_motivo}` : ''}` : undefined}
            >
              <td className="px-3 py-1 whitespace-nowrap text-gray-400">{brData(l.data)}</td>
              <td className="px-3 py-1 whitespace-nowrap text-gray-400">{DOW[dowDe(l.data)].l}</td>
              <td className="px-3 py-1"></td>
              <td className="px-3 py-1"></td>
              <td className="px-3 py-1 text-gray-400 max-w-[240px] truncate" title={l.motivo || ''}>
                {l.motivo || ''}
              </td>
              <td className="px-3 py-1 pl-6 text-gray-600 dark:text-gray-300 max-w-[240px] truncate" title={l.produto || ''}>
                {l.produto || '-'}
              </td>
              <td className="px-3 py-1 text-right text-gray-500">{l.qtd.toLocaleString('pt-BR')}</td>
              <td className="px-3 py-1 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">{moeda(l.valor_bruto)}</td>
              <td className="px-3 py-1 text-right whitespace-nowrap">
                <span
                  className={`mr-1 inline-block rounded px-1 text-[9px] font-bold align-middle ${
                    l.tem_ficha
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                  title={l.tem_ficha ? 'Custo da ficha técnica' : `Sem ficha — estimado (×${fator})`}
                >
                  {l.tem_ficha ? 'FT' : `×${fator}`}
                </span>
                <span className="text-gray-600 dark:text-gray-300">{moeda(l.custo)}</span>
              </td>
              <td className="px-2 py-1 text-center">
                {l.ignorada ? (
                  <button
                    onClick={() => restaurarLinhas([l.chave_hash])}
                    title="Restaurar (voltar pro controle)"
                    className="rounded p-1 text-gray-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const m = prompt('Motivo (opcional):') || undefined;
                      ignorarLinhas([l.chave_hash], m);
                    }}
                    title="Ignorar essa consumação"
                    className="rounded p-1 text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
      </Fragment>
    );
  };

  const salvarVinculo = async (payload: Record<string, unknown>) => {
    if (!selectedBar) return;
    try {
      const r = await fetch('/api/operacional/consumacao/vinculo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar.id) },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.success) {
        toast.error(j.error || 'Erro ao salvar vínculo');
        return j;
      }
      await carregar();
      return j;
    } catch {
      toast.error('Erro ao salvar vínculo');
    }
  };

  // Reclassificar SÓ a categoria da mesa — preserva o vínculo de pessoa (tipo/artista/sócio) existente.
  const setCategoriaMesa = async (mesaLabel: string, mesaNorm: string, catKey: string | null) => {
    const atual = vincByNorm.get(mesaNorm);
    await salvarVinculo({
      mesa: mesaLabel,
      tipo: atual?.tipo ?? null,
      artista_id: atual?.artista_id ?? null,
      socio_id: atual?.socio_id ?? null,
      entidade_nome: atual?.entidade_nome ?? null,
      categoria_override: catKey,
    });
  };

  const removerVinculo = async (mesaLabel: string) => {
    if (!selectedBar) return;
    try {
      await fetch('/api/operacional/consumacao/vinculo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar.id) },
        body: JSON.stringify({ mesa: mesaLabel }),
      });
      await carregar();
    } catch {
      toast.error('Erro ao remover vínculo');
    }
  };

  const criarSocio = async (nome: string): Promise<Cadastro | undefined> => {
    if (!selectedBar) return;
    try {
      const r = await fetch('/api/operacional/consumacao/vinculo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar.id) },
        body: JSON.stringify({ acao: 'criar_socio', nome }),
      });
      const j = await r.json();
      if (j.success && j.socio) {
        setCadSocios((prev) => (prev.some((x) => x.id === j.socio.id) ? prev : [...prev, j.socio].sort((a, b) => a.nome.localeCompare(b.nome))));
        return j.socio;
      }
      toast.error(j.error || 'Erro ao criar sócio');
    } catch {
      toast.error('Erro ao criar sócio');
    }
  };

  const limparTudo = () => {
    setCatFiltro(new Set());
    setDiaSemana(new Set());
    setMotivoSel('');
    setProdutoSel('');
    setBusca('');
    setColFiltros({ categoria: new Set(), mesa: new Set(), motivo: new Set(), produto: new Set() });
  };

  const exportarCsv = () => {
    const head = ['Data', 'Dia', 'Categoria', 'Mesa', 'Motivo', 'Produto', 'Qtd', 'Valor Bruto', 'Custo', 'Tem ficha'];
    const linhasCsv = linhasOrdenadas.map((l) =>
      [
        l.data,
        DOW[dowDe(l.data)].n,
        LABEL[l.categoria] || l.categoria,
        l.mesa || '',
        (l.motivo || '').replace(/;/g, ','),
        (l.produto || '').replace(/;/g, ','),
        String(l.qtd).replace('.', ','),
        String(l.valor_bruto).replace('.', ','),
        String(l.custo).replace('.', ','),
        l.tem_ficha ? 'sim' : 'nao',
      ].join(';'),
    );
    const csv = [head.join(';'), ...linhasCsv].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumacao_${di}_a_${df}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resumoMap = new Map(resumo.map((r) => [r.categoria, r]));

  // chips de filtros ativos
  const chips: { label: string; onClear: () => void }[] = [
    ...Array.from(catFiltro).map((k) => ({ label: `Categoria: ${LABEL[k] || k}`, onClear: () => toggleCat(k) })),
    ...Array.from(diaSemana).map((i) => ({ label: DOW[i].n, onClear: () => toggleDow(i) })),
    ...(motivoSel ? [{ label: `Motivo: ${motivoSel}`, onClear: () => setMotivoSel('') }] : []),
    ...(produtoSel ? [{ label: `Produto: ${produtoSel}`, onClear: () => setProdutoSel('') }] : []),
    ...(busca ? [{ label: `Busca: ${busca}`, onClear: () => setBusca('') }] : []),
    ...(colFiltros.categoria.size ? [{ label: `Col. Categoria (${colFiltros.categoria.size})`, onClear: () => setCol('categoria', new Set()) }] : []),
    ...(colFiltros.mesa.size ? [{ label: `Col. Mesa (${colFiltros.mesa.size})`, onClear: () => setCol('mesa', new Set()) }] : []),
    ...(colFiltros.motivo.size ? [{ label: `Col. Motivo (${colFiltros.motivo.size})`, onClear: () => setCol('motivo', new Set()) }] : []),
    ...(colFiltros.produto.size ? [{ label: `Col. Produto (${colFiltros.produto.size})`, onClear: () => setCol('produto', new Set()) }] : []),
  ];

  const campoLabel = 'block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="space-y-4 p-1">
      {/* ===== Painel de filtros ===== */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Período: presets + datas */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className={campoLabel}>Período</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => preset(p.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      presetAtivo === p.key
                        ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <span className={campoLabel}>De</span>
                <Input
                  type="date"
                  value={di}
                  onChange={(e) => {
                    setDi(e.target.value);
                    setPresetAtivo('');
                  }}
                  className="input-dark w-[9.5rem]"
                />
              </div>
              <div>
                <span className={campoLabel}>Até</span>
                <Input
                  type="date"
                  value={df}
                  onChange={(e) => {
                    setDf(e.target.value);
                    setPresetAtivo('');
                  }}
                  className="input-dark w-[9.5rem]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={carregar} disabled={loading} title="Atualizar">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Link href="/operacional/consumacao/artistas">
                <Button variant="outline" size="sm" className="gap-1.5" title="Vincular cada consumação de artista ao artista do cadastro">
                  <Users className="w-4 h-4" /> Por artista
                </Button>
              </Link>
              {/* Modo de visão das ignoradas — "ativas" oculta, "todas" mostra tudo, "so_ignoradas" só as marcadas. */}
              <div className="flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-xs">
                {(
                  [
                    { v: 'ativas', l: 'Ativas', t: 'Só consumações que entram na conta (padrão)' },
                    { v: 'todas', l: qtdIgnoradas > 0 ? `Todas (${qtdIgnoradas} ign.)` : 'Todas', t: 'Mostra tudo — ignoradas ficam tachadas' },
                    { v: 'so_ignoradas', l: 'Só ignoradas', t: 'Ver e restaurar consumações ignoradas' },
                  ] as const
                ).map((op) => (
                  <button
                    key={op.v}
                    onClick={() => setModoIgnoradas(op.v)}
                    title={op.t}
                    className={`px-2.5 py-1 transition-colors ${
                      modoIgnoradas === op.v
                        ? 'bg-[hsl(var(--primary))] text-white'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {op.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aviso de valor "escondido" pelas ignoradas */}
          {modoIgnoradas === 'ativas' && qtdIgnoradas > 0 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/25 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>{qtdIgnoradas}</strong> consumação(ões) ignorada(s) — {moeda(totalBrutoIgnorado)} fora do controle. Troque pra &quot;Só ignoradas&quot; pra revisar ou restaurar.
              </span>
            </div>
          )}

          {/* Dia da semana */}
          <div>
            <span className={campoLabel}>Dia da semana</span>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((d) => (
                <button
                  key={d.i}
                  onClick={() => toggleDow(d.i)}
                  title={d.n}
                  className={`w-11 rounded-md py-1 text-xs font-medium transition-colors ${
                    diaSemana.has(d.i)
                      ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {d.l}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo / Produto / Busca */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <span className={campoLabel}>Motivo (artista / sócio / etc.)</span>
              <Combobox value={motivoSel} onChange={setMotivoSel} options={motivos} placeholder="Selecione ou digite…" />
            </div>
            <div>
              <span className={campoLabel}>Produto</span>
              <Combobox value={produtoSel} onChange={setProdutoSel} options={produtos} placeholder="Selecione ou digite…" />
            </div>
            <div>
              <span className={campoLabel}>Busca livre (motivo, produto, mesa)</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="input-dark pl-8"
                />
              </div>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              {chips.map((c, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs"
                >
                  {c.label}
                  <button onClick={c.onClear} className="hover:text-blue-900 dark:hover:text-blue-100">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button onClick={limparTudo} className="ml-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline">
                Limpar tudo
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="analises">Análises</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-4 mt-4">
      {/* ===== Resumo por categoria (clicável) ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {CATS.map((c) => {
          const r = resumoMap.get(c.key);
          const ativo = catFiltro.has(c.key);
          // % agora é a fatia do CUSTO total (não do bruto), coerente com o valor em destaque
          const pct = totalCusto > 0 ? ((r?.custo || 0) / totalCusto) * 100 : 0;
          return (
            <button
              key={c.key}
              onClick={() => toggleCat(c.key)}
              className={`text-left rounded-lg border p-2.5 transition-colors ${
                ativo
                  ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : c.key === 'outros' && (r?.custo || 0) > 0
                    ? 'border-amber-400 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/15 hover:border-amber-500'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${c.cor}`} />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{c.label}</span>
              </div>
              {/* valor principal = CUSTO (ficha + ×fator); bruto vira referência discreta */}
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{moeda(r?.custo || 0)}</p>
              <p className="text-[11px] text-gray-400">
                {(r?.linhas || 0).toLocaleString('pt-BR')} lanç. · {pct.toFixed(0)}%
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">bruto {moeda(r?.bruto || 0)}</p>
            </button>
          );
        })}
      </div>

      {/* ===== Alerta: Outros não entra no CMV ===== */}
      {(() => {
        const o = resumoMap.get('outros');
        if (!o || (o.custo || 0) <= 0) return null;
        return (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {moeda(o.custo)} em &ldquo;Outros&rdquo; ({(o.linhas || 0).toLocaleString('pt-BR')} lançamento{(o.linhas || 0) === 1 ? '' : 's'}) — <span className="underline">não entra no CMV</span>.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Reclassifique cada mesa na categoria correta (lápis <Pencil className="inline w-3 h-3" /> na coluna Categoria){isAdmin ? '' : ' — só admin'}. Enquanto ficar em Outros, é a diferença que aparece no CMV.
              </p>
            </div>
            <button
              onClick={() => setCatFiltro(new Set(['outros']))}
              className="shrink-0 self-center rounded-md border border-amber-400 dark:border-amber-700 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              Ver só Outros
            </button>
          </div>
        );
      })()}

      {/* ===== Totais ===== */}
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Custo real (ficha + ×{fator}) {temFiltro ? '(filtro)' : ''}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{moeda(temFiltro ? totFiltrado.custo : totalCusto)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">bruto {moeda(temFiltro ? totFiltrado.bruto : totalBruto)}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="p-3">
            <p className="text-xs text-gray-400">Lançamentos</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{linhasFiltradas.length.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Barra da tabela: contagem + agrupar + CSV ===== */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {agrupar
            ? `${grupos.length.toLocaleString('pt-BR')} mesa(s) · ${linhasFiltradas.length.toLocaleString('pt-BR')} lançamento(s)`
            : `${linhasFiltradas.length.toLocaleString('pt-BR')} lançamento(s)`}
          {!porCat && totalPaginas > 1 && <span className="text-gray-400"> · página {pagina1} de {totalPaginas}</span>}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant={agrupar ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAgrupar((v) => !v)}
            className="gap-1.5"
            title="Agrupar as consumações da mesma mesa/pessoa"
          >
            <Layers className="w-4 h-4" />
            {agrupar ? 'Agrupado por mesa' : 'Agrupar por mesa'}
          </Button>
          {agrupar && (
            <Button
              variant={porCat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPorCat((v) => !v)}
              className="gap-1.5"
              title="Agrupar em 2 camadas: Categoria › Mesa"
            >
              <Layers className="w-4 h-4" />
              Categoria › Mesa
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={linhasFiltradas.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* ===== Tabela ===== */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" onClick={() => sortBy('data')}>
                  Data{seta('data')}
                </th>
                <th className="text-left font-medium px-3 py-2">Dia</th>
                <ColHeader label="Categoria" options={opcoesCol.categoria} selected={colFiltros.categoria} onChange={(n) => setCol('categoria', n)} />
                <ColHeader label="Mesa" options={opcoesCol.mesa} selected={colFiltros.mesa} onChange={(n) => setCol('mesa', n)} />
                <ColHeader label="Motivo" options={opcoesCol.motivo} selected={colFiltros.motivo} onChange={(n) => setCol('motivo', n)} />
                <ColHeader label="Produto" options={opcoesCol.produto} selected={colFiltros.produto} onChange={(n) => setCol('produto', n)} />
                <th className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" onClick={() => sortBy('qtd')}>
                  Qtd{seta('qtd')}
                </th>
                <th className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" onClick={() => sortBy('valor_bruto')}>
                  Bruto{seta('valor_bruto')}
                </th>
                <th className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" onClick={() => sortBy('custo')}>
                  Custo{seta('custo')}
                </th>
                <th className="text-center font-medium px-2 py-2 w-16" title="Marcar como ignorada / restaurar"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                    Carregando...
                  </td>
                </tr>
              ) : (agrupar ? (porCat ? gruposPorCategoria.length : pageGrupos.length) : pageLinhas.length) === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                    Nenhum lançamento no período/filtro.
                  </td>
                </tr>
              ) : agrupar ? (
                porCat ? (
                  gruposPorCategoria.map((cg) => {
                    const catAberto = catExpandidos.has(cg.cat);
                    const catMix = cg.cat === '__varios';
                    return (
                      <Fragment key={`cat-${cg.cat}`}>
                        <tr
                          onClick={() => toggleCatExp(cg.cat)}
                          className="cursor-pointer border-t-2 border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/70 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        >
                          <td colSpan={6} className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">
                            <span className="inline-flex items-center gap-1.5">
                              {catAberto ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-indigo-400" />}
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${catMix ? 'bg-gray-400' : COR[cg.cat] || 'bg-gray-400'}`} />
                              {catMix ? 'Vários' : LABEL[cg.cat] || cg.cat}
                              <span className="text-xs font-normal text-gray-400">
                                ({cg.mesas.length} mesas · {cg.itens} itens)
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-400">{cg.mesas.length}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{moeda(cg.bruto)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">{moeda(cg.custo)}</td>
                          <td className="px-2 py-2" />
                        </tr>
                        {catAberto && cg.mesas.map(renderGrupoMesa)}
                      </Fragment>
                    );
                  })
                ) : (
                  pageGrupos.map(renderGrupoMesa)
                )
              ) : (
                pageLinhas.map((l, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                      l.ignorada ? 'bg-red-50/50 dark:bg-red-950/20 text-gray-400 dark:text-gray-500 line-through decoration-red-300/60' : ''
                    }`}
                    title={l.ignorada ? `Ignorada${l.ignorada_motivo ? `: ${l.ignorada_motivo}` : ''}` : undefined}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{brData(l.data)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{DOW[dowDe(l.data)].l}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${COR[l.categoria] || 'bg-gray-400'}`} />
                        <span className="text-gray-700 dark:text-gray-200">{LABEL[l.categoria] || l.categoria}</span>
                        {l.categoria === 'outros' && (
                          <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">reclassificar</span>
                        )}
                        {isAdmin && l.mesa && (
                          <button
                            onClick={() => setEditandoCategoria({ mesaLabel: l.mesa as string, mesaNorm: normMesa(l.mesa) })}
                            title="Reclassificar categoria (admin)"
                            className="rounded p-0.5 text-gray-300 hover:text-indigo-500"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{l.mesa || '-'}</td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[240px] truncate" title={l.motivo || ''}>
                      {l.motivo || '-'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 max-w-[240px] truncate" title={l.produto || ''}>
                      {l.produto || '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{l.qtd.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">{moeda(l.valor_bruto)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <span
                        className={`mr-1 inline-block rounded px-1 text-[9px] font-bold align-middle ${
                          l.tem_ficha
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                        title={l.tem_ficha ? 'Custo da ficha técnica' : `Sem ficha — estimado (×${fator})`}
                      >
                        {l.tem_ficha ? 'FT' : `×${fator}`}
                      </span>
                      <span className="text-gray-700 dark:text-gray-200">{moeda(l.custo)}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {l.ignorada ? (
                        <button
                          onClick={() => restaurarLinhas([l.chave_hash])}
                          title="Restaurar (voltar pro controle)"
                          className="rounded p-1 text-gray-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const m = prompt('Motivo (opcional):') || undefined;
                            ignorarLinhas([l.chave_hash], m);
                          }}
                          title="Ignorar essa consumação (não entra no controle)"
                          className="rounded p-1 text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ===== Paginação ===== */}
      {!porCat && totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina1 <= 1}>
            Anterior
          </Button>
          <span className="text-gray-500">
            Página {pagina1} de {totalPaginas}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina1 >= totalPaginas}>
            Próxima
          </Button>
        </div>
      )}
        </TabsContent>

        <TabsContent value="analises" className="mt-4">
          <Analises linhas={linhasFiltradas} fator={fator} />
        </TabsContent>
      </Tabs>

      {editandoMesa && (
        <VinculoEditor
          mesaLabel={editandoMesa.mesaLabel}
          atual={vincByNorm.get(editandoMesa.mesaNorm)}
          artistas={cadArtistas}
          socios={cadSocios}
          onClose={() => setEditandoMesa(null)}
          onSalvar={salvarVinculo}
          onRemover={() => removerVinculo(editandoMesa.mesaLabel)}
          onCriarSocio={criarSocio}
        />
      )}

      {isAdmin && editandoCategoria && (
        <CategoriaPicker
          mesaLabel={editandoCategoria.mesaLabel}
          atual={vincByNorm.get(editandoCategoria.mesaNorm)?.categoria_override ?? undefined}
          onClose={() => setEditandoCategoria(null)}
          onPick={(k) => setCategoriaMesa(editandoCategoria.mesaLabel, editandoCategoria.mesaNorm, k)}
        />
      )}
    </div>
  );
}
