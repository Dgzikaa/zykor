'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loader2, Check, X, CalendarClock, Trash2, Sparkles } from 'lucide-react';
import { STATUS_COLOR, statusLabel, formatBRL, type PedidoStatus } from '../types';
import type { Opcao } from './PedidoCard';

// Competência (diária) de um freela agrupado — dia + função (descricao) + valor + categoria própria.
export type FreelaComp = {
  id: string;
  data_competencia: string;
  valor: number;
  descricao?: string | null;            // função do dia (ex.: "Garçom")
  categoria_id?: string | null;
  categoria_nome?: string | null;
  categoria_sugerida_id?: string | null;
  contaazul_lancamento_id?: string | null;
  ordem?: number;
};

// Freela na visão do FINANCEIRO — 1 pedido = 1 pessoa. Fornecedor é 1 (do pedido); a categoria é
// por competência. Freela legado (per-dia, sem competências) vira um pedido de 1 linha só.
export type FreelaFinItem = {
  id: string;
  descricao?: string | null;
  beneficiario_nome?: string | null;
  valor: number;
  status: PedidoStatus;
  data_competencia?: string | null;
  data_vencimento: string;
  categoria_id?: string | null;
  categoria_sugerida_id?: string | null;
  contaazul_pessoa_id?: string | null;
  competencias?: FreelaComp[];
};

// Payload de aprovação já resolvido: fornecedor da pessoa + categoria por competência
// (ou categoria única no legado sem competências).
export type FreelaAprovacao = {
  id: string;
  contaazul_pessoa_id: string;
  categoria_id?: string;
  categoria_nome?: string;
  competencias?: Array<{ id: string; categoria_id: string; categoria_nome?: string }>;
};

const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function rotuloDia(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIA_SEMANA[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
// Função do dia no legado vem só na descrição: "Freela <função> — <nome> (venc)".
function funcaoLegado(desc?: string | null): string | null {
  const m = /^Freela\s+(.+?)\s+—\s+/.exec(desc || '');
  return m ? m[1].trim() : null;
}
const norm = (s?: string | null) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const APROVAVEL: PedidoStatus[] = ['aguardando_aprovacao'];
const AGENDAVEL: PedidoStatus[] = ['aprovado', 'erro_ca', 'erro_inter'];
const EXCLUIVEL: PedidoStatus[] = ['aguardando_aprovacao', 'aprovado', 'aguardando_socio', 'agendado', 'erro_ca', 'erro_inter'];

// Uma linha renderizável (competência agrupada OU o próprio pedido no legado).
type Linha = { key: string; dia: string; funcao: string | null; valor: number; catValue: string; sugerida: boolean };

/**
 * Freela no FINANCEIRO — 1 pedido = 1 PESSOA (semana). O FORNECEDOR é um só (topo do card); a
 * CATEGORIA é por DIÁRIA (cada competência tem seu seletor, pré-preenchido pela sugestão por
 * função). "Aprovar" grava a categoria de cada competência + o fornecedor. "Subir" agenda 1 PIX
 * pro total da pessoa + N lançamentos no Conta Azul (um por competência, com a categoria dela).
 * Freela legado (sem competências) aparece como card de 1 linha, com categoria a nível de pedido.
 */
export function FreelaFinanceiro({
  itens, podeAprovar, categorias, fornecedores, busyId, onAprovar, onReprovar, onAgendar, onExcluir,
}: {
  itens: FreelaFinItem[];
  podeAprovar: boolean;
  categorias: Opcao[];
  fornecedores: Opcao[];
  busyId: string | null;
  onAprovar: (itens: FreelaAprovacao[]) => void;
  onReprovar: (ids: string[]) => void;
  onAgendar: (id: string) => void;
  onExcluir: (id: string) => void;
}) {
  const [fornOverride, setFornOverride] = useState<Record<string, string>>({}); // por pedido.id
  const [catOverride, setCatOverride] = useState<Record<string, string>>({});   // por linha.key
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());     // pedido.id

  const catNome = (id: string) => categorias.find((c) => c.value === id)?.label;

  // Match de fornecedor por nome (fallback quando o cadastro não trouxe pessoa CA).
  const fornPorNome = useMemo(() => {
    const exato = new Map<string, string>();
    for (const f of fornecedores) { const k = norm(f.label); if (k && !exato.has(k)) exato.set(k, f.value); }
    return (nome?: string | null) => {
      const k = norm(nome);
      if (!k) return '';
      if (exato.has(k)) return exato.get(k)!;
      const hit = fornecedores.find((f) => { const l = norm(f.label); return l.startsWith(k) || k.startsWith(l); });
      return hit?.value || '';
    };
  }, [fornecedores]);

  const ordenados = useMemo(
    () => itens.slice().sort((a, b) => (a.beneficiario_nome || '').localeCompare(b.beneficiario_nome || '', 'pt-BR')),
    [itens]
  );

  // Fornecedor efetivo: override > cadastro do pedido > match por nome.
  const fornDoPedido = (p: FreelaFinItem): { value: string; auto: boolean } => {
    if (fornOverride[p.id] !== undefined) return { value: fornOverride[p.id], auto: false };
    if (p.contaazul_pessoa_id) return { value: p.contaazul_pessoa_id, auto: false };
    return { value: fornPorNome(p.beneficiario_nome), auto: true };
  };

  // Linhas do pedido: competências (agrupado) ou o próprio pedido (legado).
  const linhasDoPedido = (p: FreelaFinItem): Linha[] => {
    const comps = p.competencias || [];
    if (comps.length) {
      return comps.map((c) => {
        const has = catOverride[c.id] !== undefined;
        const value = has ? catOverride[c.id] : (c.categoria_id || c.categoria_sugerida_id || '');
        return { key: c.id, dia: c.data_competencia, funcao: c.descricao || null, valor: Number(c.valor || 0),
          catValue: value, sugerida: !has && !c.categoria_id && !!c.categoria_sugerida_id };
      });
    }
    const has = catOverride[p.id] !== undefined;
    const value = has ? catOverride[p.id] : (p.categoria_id || p.categoria_sugerida_id || '');
    return [{ key: p.id, dia: p.data_competencia || p.data_vencimento, funcao: funcaoLegado(p.descricao),
      valor: Number(p.valor || 0), catValue: value, sugerida: !has && !p.categoria_id && !!p.categoria_sugerida_id }];
  };

  // Resolve o pedido → payload de aprovação (se estiver pronto: fornecedor + toda linha com categoria).
  const resolver = (p: FreelaFinItem): FreelaAprovacao | null => {
    if (!APROVAVEL.includes(p.status)) return null;
    const forn = fornDoPedido(p).value;
    const linhas = linhasDoPedido(p);
    if (!forn || linhas.some((l) => !l.catValue)) return null;
    if ((p.competencias || []).length) {
      return { id: p.id, contaazul_pessoa_id: forn,
        competencias: linhas.map((l) => ({ id: l.key, categoria_id: l.catValue, categoria_nome: catNome(l.catValue) })) };
    }
    return { id: p.id, contaazul_pessoa_id: forn, categoria_id: linhas[0].catValue, categoria_nome: catNome(linhas[0].catValue) };
  };

  const toggleSel = (id: string) => setSelecionadas((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const selResolvidas = useMemo(() => {
    const prontas: FreelaAprovacao[] = [];
    let faltando = 0;
    for (const p of ordenados) {
      if (!selecionadas.has(p.id)) continue;
      const r = resolver(p); if (r) prontas.push(r); else faltando++;
    }
    return { prontas, faltando };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadas, ordenados, fornOverride, catOverride, fornecedores]);

  return (
    <div className="space-y-2">
      {podeAprovar && selecionadas.size > 0 && (
        <div className="sticky top-2 z-20 flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-3 py-2 backdrop-blur">
          <span className="text-sm font-medium">{selecionadas.size} pessoa(s) selecionada(s)</span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { if (selResolvidas.prontas.length) { onAprovar(selResolvidas.prontas); setSelecionadas(new Set()); } }}
              disabled={selResolvidas.prontas.length === 0 || !!busyId}
              title={selResolvidas.prontas.length === 0 ? 'Faltam categoria e/ou fornecedor nas selecionadas' : 'Aprovar as pessoas marcadas'}>
              <Check className="w-3.5 h-3.5 mr-1" />Aprovar ({selResolvidas.prontas.length})
              {selResolvidas.faltando > 0 && <span className="ml-1 opacity-70">· {selResolvidas.faltando} incompleta(s)</span>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecionadas(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      {ordenados.map((p) => (
        <CardPessoa
          key={p.id}
          pedido={p}
          linhas={linhasDoPedido(p)}
          podeAprovar={podeAprovar}
          categorias={categorias}
          fornecedores={fornecedores}
          fornSel={fornDoPedido(p)}
          onFornChange={(v) => setFornOverride((s) => ({ ...s, [p.id]: v }))}
          onCatChange={(key, v) => setCatOverride((s) => ({ ...s, [key]: v }))}
          busyId={busyId}
          selecionada={selecionadas.has(p.id)}
          onToggleSel={() => toggleSel(p.id)}
          onAprovar={() => { const r = resolver(p); if (r) onAprovar([r]); }}
          pronta={!!resolver(p)}
          onReprovar={() => onReprovar([p.id])}
          onAgendar={() => onAgendar(p.id)}
          onExcluir={() => onExcluir(p.id)}
        />
      ))}
    </div>
  );
}

function CardPessoa({
  pedido: p, linhas, podeAprovar, categorias, fornecedores, fornSel, onFornChange, onCatChange,
  busyId, selecionada, onToggleSel, onAprovar, pronta, onReprovar, onAgendar, onExcluir,
}: {
  pedido: FreelaFinItem;
  linhas: Linha[];
  podeAprovar: boolean;
  categorias: Opcao[];
  fornecedores: Opcao[];
  fornSel: { value: string; auto: boolean };
  onFornChange: (v: string) => void;
  onCatChange: (key: string, v: string) => void;
  busyId: string | null;
  selecionada: boolean;
  onToggleSel: () => void;
  onAprovar: () => void;
  pronta: boolean;
  onReprovar: () => void;
  onAgendar: () => void;
  onExcluir: () => void;
}) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const busy = busyId === p.id;
  const pendente = APROVAVEL.includes(p.status);
  const fornAutoLabel = fornSel.auto && fornSel.value ? fornecedores.find((f) => f.value === fornSel.value)?.label : null;

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      {/* Cabeçalho: checkbox · pessoa · status · total · Fornecedor CA (1 por pessoa) */}
      <div className="flex flex-col gap-2 px-3 py-2 bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {podeAprovar && pendente && (
            <input type="checkbox" checked={selecionada} onChange={onToggleSel}
              className="w-4 h-4 shrink-0 accent-[hsl(var(--primary))] cursor-pointer" aria-label="Selecionar pessoa" />
          )}
          <span className="text-sm font-semibold truncate">
            {p.beneficiario_nome || '—'}
            <span className="text-muted-foreground font-normal"> · {linhas.length} diária(s)</span>
          </span>
          <Badge className={`${STATUS_COLOR[p.status]} text-[10px] shrink-0`}>{statusLabel(p)}</Badge>
          <span className="text-sm font-semibold shrink-0 ml-auto sm:ml-0">{formatBRL(total)}</span>
        </div>
        {podeAprovar && pendente && (
          <div className="flex items-center gap-1.5 sm:w-72 sm:shrink-0 min-w-0">
            <span className="text-[11px] text-muted-foreground shrink-0">Fornecedor CA</span>
            <div className="flex-1 min-w-0">
              <SearchableSelect value={fornSel.value} onValueChange={onFornChange}
                placeholder="Selecione" searchPlaceholder="Buscar..." emptyMessage="Nenhum" options={fornecedores} />
            </div>
          </div>
        )}
      </div>
      {podeAprovar && pendente && fornAutoLabel && (
        <div className="px-3 py-1 text-[11px] text-blue-600 bg-blue-50/40 dark:bg-blue-950/20 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Fornecedor sugerido por nome: <b>{fornAutoLabel}</b> — confira.
        </div>
      )}

      {/* Diárias: dia · função · valor · categoria por linha */}
      <div className="divide-y divide-[hsl(var(--border))]/50">
        {linhas.map((l) => (
          <div key={l.key} className="flex flex-col gap-1.5 px-3 py-2 md:flex-row md:items-center md:gap-2">
            <div className="flex items-center gap-2 min-w-0 md:flex-1">
              <span className="text-sm truncate">
                {rotuloDia(l.dia)}
                {l.funcao && <span className="text-muted-foreground"> · {l.funcao}</span>}
              </span>
              <span className="tabular-nums font-medium text-sm ml-auto md:w-24 md:text-right shrink-0">{formatBRL(l.valor)}</span>
            </div>
            {podeAprovar && pendente && (
              <div className="min-w-0 md:w-72 md:shrink-0">
                <SearchableSelect value={l.catValue} onValueChange={(v) => onCatChange(l.key, v || '')}
                  placeholder={l.sugerida ? '✨ confira a sugestão' : 'Categoria'} searchPlaceholder="Filtrar..."
                  emptyMessage="Nenhuma" options={categorias} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ações do pedido (pessoa): Aprovar/Recusar (pendente) · Subir/Excluir (demais) */}
      {podeAprovar && (
        <div className="border-t border-[hsl(var(--border))] px-3 py-2 flex items-center justify-end gap-1.5">
          {pendente ? (
            <>
              <Button size="sm" className="h-8 px-2.5" disabled={busy || !pronta} onClick={onAprovar}
                title={!pronta ? 'Escolha o fornecedor e a categoria de cada diária' : 'Aprovar esta pessoa'}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" />Aprovar</>}
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-2 text-red-600 hover:text-red-700" disabled={busy} onClick={onReprovar} title="Recusar esta pessoa">
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              {AGENDAVEL.includes(p.status) && (
                <Button size="sm" variant="outline" className="h-8 px-2.5" disabled={busy} onClick={onAgendar} title="Agendar: 1 PIX no Inter + 1 lançamento por diária no Conta Azul">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CalendarClock className="w-3.5 h-3.5 mr-1" />Subir (1 PIX)</>}
                </Button>
              )}
              {EXCLUIVEL.includes(p.status) && (
                <button onClick={onExcluir} disabled={busy} title="Excluir/cancelar este pagamento" className="text-muted-foreground hover:text-red-600 disabled:opacity-40 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
