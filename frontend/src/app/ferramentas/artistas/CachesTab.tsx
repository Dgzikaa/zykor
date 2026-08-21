'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import {
  ROTULO_ACORDO, ROTULO_BASE, calcularCache, resumoNegociacao,
  type BaseCalculo, type TipoAcordo,
} from '@/lib/artistas/cache';
import {
  Loader2, Handshake, Check, AlertTriangle, ExternalLink, Calculator, Pencil, KeyRound,
} from 'lucide-react';

/**
 * Cachês (21/08/2026, Gonza): a negociação de cada artista fica salva, o Zykor calcula o cachê
 * de cada show pelo faturamento da noite, e o Confirmar sobe o pagamento pro financeiro — o
 * mesmo caminho dos freelas (pedido em `aguardando_aprovacao`; quem agenda é o financeiro).
 *
 * Só shows JÁ REALIZADOS aparecem: num acordo por percentual, cachê de show que não aconteceu
 * seria um número inventado.
 */

const money = (v: number | null | undefined) =>
  v == null ? '—' : (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const hojeBRT = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

/** Últimos 6 meses, do atual pra trás — sem `new Date()` na volta, que erraria o dia no UTC-3. */
function ultimosMeses(n = 6): string[] {
  const [a, m] = hojeBRT().split('-').map(Number);
  const out: string[] = [];
  let ano = a; let mes = m;
  for (let i = 0; i < n; i++) {
    out.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes--; if (mes === 0) { mes = 12; ano--; }
  }
  return out;
}
const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

const STATUS_ROTULO: Record<string, string> = {
  aguardando_aprovacao: 'no financeiro',
  aprovado: 'aprovado',
  agendando: 'agendando',
  aguardando_socio: 'aguardando sócio',
  agendado: 'agendado',
  pago: 'pago',
  erro_ca: 'erro Conta Azul',
  erro_inter: 'erro Inter',
  rejeitado: 'rejeitado',
  cancelado: 'cancelado',
};

type Artista = {
  artista_id: number | null; nome: string; negociacao: string;
  tem_negociacao: boolean; tem_pix: boolean; favorecido: string | null;
  valor: number | null; formula: string; motivo: string | null;
  base_valor: number | null; base_calculo: BaseCalculo;
  lancado: boolean; lancado_valor: number | null; lancado_por: string | null;
  pedido_status: string | null; pedido_numero: string | null;
};
type Linha = {
  evento_id: number; data_evento: string; nome: string;
  faturamento_total: number; faturamento_entrada: number; faturamento_bar: number;
  artistas: Artista[];
};

export default function CachesTab({ barId }: { barId?: number }) {
  const { showToast } = useToast();
  const meses = useMemo(() => ultimosMeses(6), []);
  const [mes, setMes] = useState(meses[0]);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [verNegociacoes, setVerNegociacoes] = useState(false);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLinhas(null); setSel({});
    try {
      const r = await api.get(`/api/artistas/caches?mes=${mes}`);
      setLinhas(r.linhas || []);
    } catch (e: any) {
      setLinhas([]);
      showToast({ type: 'error', title: 'Não carregou os cachês', message: e?.message });
    }
  }, [barId, mes, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  /** Só entra no lote o que dá pra pagar: tem valor calculado e ainda não foi lançado. */
  const pagaveis = useMemo(() => {
    const out: Array<{ chave: string; linha: Linha; a: Artista }> = [];
    for (const l of linhas || []) {
      for (const a of l.artistas) {
        if (a.artista_id && !a.lancado && a.valor != null && a.valor > 0) {
          out.push({ chave: `${l.evento_id}:${a.artista_id}`, linha: l, a });
        }
      }
    }
    return out;
  }, [linhas]);

  const selecionados = useMemo(() => pagaveis.filter((p) => sel[p.chave]), [pagaveis, sel]);
  const totalSel = useMemo(() => selecionados.reduce((s, p) => s + (p.a.valor || 0), 0), [selecionados]);
  const semPix = useMemo(() => selecionados.filter((p) => !p.a.tem_pix), [selecionados]);

  const marcarTodos = (on: boolean) => {
    const novo: Record<string, boolean> = {};
    if (on) for (const p of pagaveis) novo[p.chave] = true;
    setSel(novo);
  };

  const confirmar = async () => {
    if (!selecionados.length) return;
    const aviso = semPix.length
      ? `\n\nATENÇÃO: ${semPix.length} sem chave PIX cadastrada — o pedido sobe assim mesmo e o financeiro completa.`
      : '';
    if (!window.confirm(
      `Enviar ${selecionados.length} cachê(s), total ${money(totalSel)}, pro financeiro?` +
      `\nCada um vira um pedido de pagamento aguardando aprovação — quem agenda o PIX é o financeiro.${aviso}`
    )) return;

    setEnviando(true);
    try {
      const itens = selecionados.map((p) => ({
        evento_id: p.linha.evento_id, artista_id: p.a.artista_id,
      }));
      const r = await api.post('/api/artistas/caches', { itens });
      showToast({
        type: 'success',
        title: `${r.criados} cachê(s) no financeiro`,
        message: `Total ${money(r.total)}.${r.erros?.length ? ` ${r.erros.length} não foi(ram).` : ''}`,
      });
      if (r.erros?.length) console.warn('[caches] não lançados:', r.erros);
      await carregar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não lançou', message: e?.message });
    } finally { setEnviando(false); }
  };

  if (!barId) return <div className="py-12 text-center text-gray-500">Selecione um bar.</div>;

  const totalMes = (linhas || []).reduce(
    (s, l) => s + l.artistas.reduce((t, a) => t + (a.lancado ? (a.lancado_valor || 0) : (a.valor || 0)), 0), 0);
  const pendentes = pagaveis.length;

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {meses.map((m) => (
            <button key={m} onClick={() => setMes(m)}
              className={`h-8 px-2.5 rounded-md text-sm border transition ${m === mes
                ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
              {rotuloMes(m)}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setVerNegociacoes((v) => !v)}>
          <Handshake className="h-4 w-4 mr-1.5" />{verNegociacoes ? 'Fechar negociações' : 'Negociações'}
        </Button>
      </div>

      {verNegociacoes && <PainelNegociacoes barId={barId} onSalvo={carregar} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Cachê do mês</div>
          <div className="mt-1 text-lg font-bold">{money(totalMes)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">A confirmar</div>
          <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">{pendentes}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Selecionados</div>
          <div className="mt-1 text-lg font-bold">{selecionados.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Total selecionado</div>
          <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">{money(totalSel)}</div>
        </CardContent></Card>
      </div>

      {pagaveis.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => marcarTodos(true)} className="text-violet-600 hover:underline">marcar todos</button>
          <span className="text-gray-300">·</span>
          <button onClick={() => marcarTodos(false)} className="text-gray-500 hover:underline">limpar</button>
        </div>
      )}

      {linhas === null ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : linhas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">
          Nenhum show realizado neste mês.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {linhas.map((l) => (
            <Card key={l.evento_id}>
              <CardContent className="p-3">
                <div className="flex items-baseline gap-2 flex-wrap mb-2">
                  <span className="font-semibold tabular-nums">{ddmm(l.data_evento)}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{l.nome || 'sem nome'}</span>
                  <span className="text-[11px] text-gray-400">
                    fat {money(l.faturamento_total)} · bilheteria {money(l.faturamento_entrada)} · bar {money(l.faturamento_bar)}
                  </span>
                </div>

                {l.artistas.length === 0 ? (
                  <div className="text-[12px] text-gray-400 italic">
                    Nenhum artista taggeado neste dia — sem tag não há a quem pagar.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {l.artistas.map((a) => {
                      const chave = `${l.evento_id}:${a.artista_id}`;
                      const podePagar = Boolean(a.artista_id) && !a.lancado && a.valor != null && a.valor > 0;
                      return (
                        <div key={chave} className="py-1.5 flex items-center gap-2 flex-wrap">
                          <input type="checkbox" disabled={!podePagar} checked={Boolean(sel[chave])}
                            onChange={(e) => setSel((s) => ({ ...s, [chave]: e.target.checked }))}
                            className="h-4 w-4 shrink-0 disabled:opacity-30" aria-label={`Selecionar ${a.nome}`} />
                          <span className="text-sm font-medium min-w-[140px]">{a.nome}</span>
                          <span className="text-[11px] text-gray-500 flex-1 min-w-[180px]">
                            {a.lancado ? (a.formula || a.negociacao) : (a.formula || a.motivo || a.negociacao)}
                          </span>

                          {a.lancado ? (
                            <span className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              <Check className="h-3 w-3" />{money(a.lancado_valor)}
                              <span className="opacity-70">· {STATUS_ROTULO[a.pedido_status || ''] || a.pedido_status || 'lançado'}</span>
                            </span>
                          ) : a.valor != null ? (
                            <>
                              {!a.tem_pix && (
                                <span title="Sem chave PIX no cadastro — o financeiro vai ter que completar"
                                  className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                  <KeyRound className="h-3 w-3" />sem PIX
                                </span>
                              )}
                              <span className="text-sm font-semibold tabular-nums">{money(a.valor)}</span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                              <AlertTriangle className="h-3 w-3" />{a.motivo || 'sem cálculo'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Barra de ação. Fica acima da BottomNavigation (fixed bottom-0 z-30) — no celular ela
          cobriria o botão, que foi exatamente o que aconteceu no check-in da escala. */}
      {selecionados.length > 0 && (
        <div className="fixed left-0 right-0 bottom-[84px] md:bottom-0 z-40 border-t bg-background/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="container mx-auto max-w-7xl flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <b>{selecionados.length}</b> cachê(s) · total <b>{money(totalSel)}</b>
              {semPix.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400"> · {semPix.length} sem PIX</span>
              )}
            </div>
            <Button onClick={confirmar} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Confirmar e enviar ao financeiro
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        O cachê sai da negociação salva no artista × o faturamento apurado da noite. Confirmar cria um
        <b> pedido de pagamento aguardando aprovação</b> — quem aprova e agenda o PIX continua sendo o
        financeiro. Um show só pode ser lançado <b>uma vez</b>.
        <a href="/financeiro/pedidos-pagamento" className="ml-1 text-violet-600 hover:underline inline-flex items-center gap-0.5">
          ver no financeiro <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Negociações — o cadastro que alimenta o cálculo                      */
/* ------------------------------------------------------------------ */

type Ficha = {
  id: number; nome: string; tipo: string;
  tipo_acordo: TipoAcordo | null; cachet_combinado: number | null;
  percentual_sociedade: number | null; base_calculo: BaseCalculo | null;
  favorecido_nome: string | null; chave_pix: string | null;
  tipo_chave: string | null; cpf_cnpj: string | null;
};

function PainelNegociacoes({ barId, onSalvo }: { barId: number; onSalvo: () => void }) {
  const { showToast } = useToast();
  const [artistas, setArtistas] = useState<Ficha[] | null>(null);
  const [q, setQ] = useState('');
  const [editando, setEditando] = useState<Ficha | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/api/artistas?negociacao=1');
      setArtistas(r.artistas || []);
    } catch (e: any) {
      setArtistas([]);
      showToast({ type: 'error', title: 'Não carregou o cadastro', message: e?.message });
    }
  }, [showToast]);
  useEffect(() => { carregar(); }, [carregar, barId]);

  const lista = useMemo(() => {
    const arr = artistas || [];
    const t = q.trim().toLowerCase();
    const filtrada = t ? arr.filter((a) => a.nome.toLowerCase().includes(t)) : arr;
    // Quem já tem acordo primeiro: a lista tem 200 nomes e o que interessa é ver e conferir
    // os que estão configurados, não rolar até achar.
    return [...filtrada].sort((a, b) =>
      Number(Boolean(b.tipo_acordo)) - Number(Boolean(a.tipo_acordo)) || a.nome.localeCompare(b.nome));
  }, [artistas, q]);

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <Handshake className="h-4 w-4 text-violet-500" />Negociação por artista
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artista…"
            className="h-8 w-[220px]" />
        </div>
        <p className="text-[11px] text-gray-500">
          &quot;Breno — 15% do fat&quot; vira <b>% do faturamento</b> 15. &quot;Doze — 8.000 ou 15% do fat&quot; vira
          <b> fixo ou %, o que for maior</b> com 8.000 e 15.
        </p>

        {artistas === null ? (
          <div className="space-y-1.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {lista.map((a) => (
              <div key={a.id} className="py-1.5 flex items-center gap-2">
                <span className="text-sm min-w-[150px] truncate">{a.nome}</span>
                <span className={`text-[11px] flex-1 ${a.tipo_acordo ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 italic'}`}>
                  {resumoNegociacao(a)}
                </span>
                {a.tipo_acordo && !a.chave_pix && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">sem PIX</span>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditando(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {lista.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">Nenhum artista encontrado.</div>
            )}
          </div>
        )}
      </CardContent>

      {editando && (
        <ModalNegociacao ficha={editando} onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar(); onSalvo(); }} />
      )}
    </Card>
  );
}

function ModalNegociacao({ ficha, onFechar, onSalvo }: {
  ficha: Ficha; onFechar: () => void; onSalvo: () => void;
}) {
  const { showToast } = useToast();
  const [f, setF] = useState({
    tipo_acordo: (ficha.tipo_acordo || '') as TipoAcordo | '',
    cachet_combinado: ficha.cachet_combinado != null ? String(ficha.cachet_combinado) : '',
    percentual_sociedade: ficha.percentual_sociedade != null ? String(ficha.percentual_sociedade) : '',
    base_calculo: (ficha.base_calculo || 'total') as BaseCalculo,
    favorecido_nome: ficha.favorecido_nome || '',
    chave_pix: ficha.chave_pix || '',
    tipo_chave: ficha.tipo_chave || '',
    cpf_cnpj: ficha.cpf_cnpj || '',
  });
  const [salvando, setSalvando] = useState(false);

  const num = (v: string) => { const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  const usaFixo = f.tipo_acordo !== '' && f.tipo_acordo !== 'percentual';
  const usaPct = f.tipo_acordo !== '' && f.tipo_acordo !== 'fixo';

  // Prévia com faturamento redondo de R$ 50.000 — mostra a regra funcionando antes de salvar,
  // que é o jeito de pegar "digitei 0,15 em vez de 15" na hora e não no dia do pagamento.
  const previa = useMemo(() => calcularCache(
    {
      tipo_acordo: (f.tipo_acordo || null) as TipoAcordo | null,
      cachet_combinado: num(f.cachet_combinado),
      percentual_sociedade: num(f.percentual_sociedade),
      base_calculo: f.base_calculo,
    },
    { total: 50000, entrada: 10000, bar: 40000 },
  ), [f]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put('/api/eventos/artistas/ficha', {
        artista_id: ficha.id,
        tipo_acordo: f.tipo_acordo || null,
        cachet_combinado: usaFixo ? num(f.cachet_combinado) : null,
        percentual_sociedade: usaPct ? num(f.percentual_sociedade) : null,
        base_calculo: f.base_calculo,
        favorecido_nome: f.favorecido_nome,
        chave_pix: f.chave_pix,
        tipo_chave: f.tipo_chave,
        cpf_cnpj: f.cpf_cnpj,
      });
      showToast({ type: 'success', title: 'Negociação salva' });
      onSalvo();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    } finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold">{ficha.nome}</div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-gray-500">Tipo de acordo</label>
          <select value={f.tipo_acordo} onChange={(e) => setF({ ...f, tipo_acordo: e.target.value as TipoAcordo | '' })}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">— sem negociação —</option>
            {(Object.keys(ROTULO_ACORDO) as TipoAcordo[]).map((k) => (
              <option key={k} value={k}>{ROTULO_ACORDO[k]}</option>
            ))}
          </select>
        </div>

        {f.tipo_acordo && (
          <div className="grid grid-cols-2 gap-2">
            {usaFixo && (
              <div>
                <label className="text-[11px] uppercase tracking-wide text-gray-500">Valor fixo (R$)</label>
                <Input inputMode="decimal" value={f.cachet_combinado}
                  onChange={(e) => setF({ ...f, cachet_combinado: e.target.value })} placeholder="8000" className="mt-1 h-9" />
              </div>
            )}
            {usaPct && (
              <div>
                <label className="text-[11px] uppercase tracking-wide text-gray-500">Percentual (%)</label>
                <Input inputMode="decimal" value={f.percentual_sociedade}
                  onChange={(e) => setF({ ...f, percentual_sociedade: e.target.value })} placeholder="15" className="mt-1 h-9" />
              </div>
            )}
            {usaPct && (
              <div className="col-span-2">
                <label className="text-[11px] uppercase tracking-wide text-gray-500">O % incide sobre</label>
                <select value={f.base_calculo} onChange={(e) => setF({ ...f, base_calculo: e.target.value as BaseCalculo })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  {(Object.keys(ROTULO_BASE) as BaseCalculo[]).map((k) => (
                    <option key={k} value={k}>{ROTULO_BASE[k]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {f.tipo_acordo && (
          <div className="rounded-lg bg-muted/50 px-2.5 py-2 text-[12px] flex items-start gap-1.5">
            <Calculator className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-500" />
            <span>
              {previa.valor != null
                ? <>Numa noite de <b>R$ 50.000</b> (bilheteria R$ 10.000): <b>{money(previa.valor)}</b>
                  <span className="block text-gray-500">{previa.formula}</span></>
                : <span className="text-amber-600 dark:text-amber-400">{previa.motivo}</span>}
            </span>
          </div>
        )}

        <div className="pt-1 border-t space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Pagamento</div>
          <Input value={f.favorecido_nome} onChange={(e) => setF({ ...f, favorecido_nome: e.target.value })}
            placeholder="Quem recebe, se for diferente do nome artístico (produtora, empresário)" className="h-9" />
          <div className="grid grid-cols-3 gap-2">
            <select value={f.tipo_chave} onChange={(e) => setF({ ...f, tipo_chave: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">tipo</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Aleatória</option>
            </select>
            <Input value={f.chave_pix} onChange={(e) => setF({ ...f, chave_pix: e.target.value })}
              placeholder="chave PIX" className="h-9 col-span-2" />
          </div>
          <Input value={f.cpf_cnpj} onChange={(e) => setF({ ...f, cpf_cnpj: e.target.value })}
            placeholder="CPF/CNPJ de quem recebe" className="h-9" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
