'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { getSelectedBarId } from '@/lib/selected-bar';
import { cn } from '@/lib/utils';
import { Loader2, Target, Plus, Trash2, Pencil } from 'lucide-react';

/**
 * Calibração trimestral no formato do card que o RH já usa (docs/avaliação.jpg).
 *
 * Não é um formulário de dois campos: o card tem oito blocos, e a leitura importa tanto quanto o
 * registro — o comitê olha lado a lado a calibração passada, a auto-avaliação e o que a pessoa
 * entregou. Por isso a tela nasce em modo LEITURA, no mesmo desenho do slide, e a edição é um
 * segundo estado.
 */

type Nivel = { id: string; label: string };
type Valor = { id: number; nome: string; ordem: number };
type Atributo = { id: number; nome: string; ordem: number };
type Calibracao = {
  id: string; ano: number; trimestre: number;
  comportamento: string | null; performance: string | null;
  auto_comportamento: string | null; auto_performance: string | null;
  texto_comportamental: string | null; texto_performance: string | null;
  missoes: string[]; nps_entrega: number | null; observacao: string | null;
  registrado_por: string | null;
  fit: { valor_id: number; nota: string }[];
  atributos: { atributo_id: number; nivel: string }[];
};
type Resposta = {
  calibracoes: Calibracao[]; niveis: Nivel[];
  valores_fit: Valor[]; atributos_cargo: Atributo[];
};

const COR_NIVEL: Record<string, string> = {
  insatisfatorio: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  abaixo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  atende: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  acima: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  destaque: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
};
const NOTA_FIT = ['+', '+/-', '-'] as const;
const COR_FIT: Record<string, string> = {
  '+': 'bg-emerald-500 text-white',
  '+/-': 'bg-amber-400 text-amber-950',
  '-': 'bg-rose-500 text-white',
};

const trimestreDe = (d: Date) => Math.floor(d.getMonth() / 3) + 1;

export function CalibracaoTab({ funcionarioId, cargoNome, cartoes }: {
  funcionarioId: number;
  cargoNome: string | null;
  cartoes: { amarelo: number; vermelho: number };
}) {
  const { showToast } = useToast();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const hdr = useCallback(() => {
    const barId = getSelectedBarId();
    return { 'Content-Type': 'application/json', ...(barId ? { 'x-selected-bar-id': barId } : {}) };
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/calibracoes`, { headers: hdr(), credentials: 'include' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao carregar');
      setDados(j);
      setSel((s) => s ?? (j.calibracoes?.[0]?.id || null));
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro', message: e?.message });
    } finally {
      setCarregando(false);
    }
  }, [funcionarioId, hdr, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const calibracoes = dados?.calibracoes || [];
  const atual = calibracoes.find((c) => c.id === sel) || calibracoes[0] || null;
  // a calibração imediatamente anterior à que está na tela — é o "Última Calibração" do card
  const anterior = useMemo(() => {
    if (!atual) return null;
    const i = calibracoes.findIndex((c) => c.id === atual.id);
    return i >= 0 ? calibracoes[i + 1] || null : null;
  }, [calibracoes, atual]);

  const rotulo = (id: string | null | undefined) =>
    (dados?.niveis || []).find((n) => n.id === id)?.label || '—';

  if (carregando) return <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {calibracoes.map((c) => (
          <button key={c.id} onClick={() => { setSel(c.id); setEditando(false); }}
            className={cn('text-xs rounded-full px-2.5 py-1 border',
              c.id === atual?.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-input hover:bg-muted')}>
            {c.trimestre}º/{c.ano}
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={() => { setSel(null); setEditando(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" />Nova calibração
        </Button>
        {atual && !editando && (
          <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />Editar
          </Button>
        )}
      </div>

      {editando ? (
        <Formulario
          dados={dados!} base={sel ? atual : null} funcionarioId={funcionarioId} hdr={hdr}
          salvando={salvando} setSalvando={setSalvando}
          onPronto={async () => { setEditando(false); await carregar(); }}
          onCancelar={() => setEditando(false)}
        />
      ) : !atual ? (
        <div className="text-xs text-muted-foreground text-center py-10 border border-dashed rounded-lg flex flex-col items-center">
          <Target className="w-8 h-8 mb-1.5 opacity-40" />
          Nenhuma calibração registrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3">
          {/* ── coluna da esquerda: os blocos de contexto do card ── */}
          <div className="space-y-2.5">
            <Bloco titulo="Última calibração">
              <Linha k="Comportamento" v={rotulo(anterior?.comportamento)} nivel={anterior?.comportamento} />
              <Linha k="Performance" v={rotulo(anterior?.performance)} nivel={anterior?.performance} />
            </Bloco>

            <Bloco titulo="Auto avaliação">
              <Linha k="Comportamento" v={rotulo(atual.auto_comportamento)} nivel={atual.auto_comportamento} />
              <Linha k="Performance" v={rotulo(atual.auto_performance)} nivel={atual.auto_performance} />
            </Bloco>

            <Bloco titulo="Advertências">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="w-4 h-4 rounded-sm bg-amber-400 inline-block" /> {cartoes.amarelo}
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="w-4 h-4 rounded-sm bg-rose-600 inline-block" /> {cartoes.vermelho}
                </span>
              </div>
            </Bloco>

            <Bloco titulo="Principais indicadores">
              <Linha k="NPS Entrega" v={atual.nps_entrega != null ? String(atual.nps_entrega).replace('.', ',') : '—'} />
            </Bloco>

            <Bloco titulo="Fit cultural">
              {(dados?.valores_fit || []).map((v) => {
                const nota = atual.fit.find((f) => f.valor_id === v.id)?.nota;
                return (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                    <span className="truncate">{v.nome}</span>
                    <span className={cn('shrink-0 rounded px-1 font-bold', nota ? COR_FIT[nota] : 'text-muted-foreground')}>
                      {nota || '—'}
                    </span>
                  </div>
                );
              })}
            </Bloco>

            <Bloco titulo={`Atributos de performance${cargoNome ? ` · ${cargoNome}` : ''}`}>
              {(dados?.atributos_cargo || []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhum atributo cadastrado para este cargo ainda.
                </p>
              ) : (dados?.atributos_cargo || []).map((a) => {
                const n = atual.atributos.find((x) => x.atributo_id === a.id)?.nivel;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                    <span className="truncate">{a.nome}</span>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 uppercase text-[9px] font-bold', n ? COR_NIVEL[n] : 'text-muted-foreground')}>
                      {n ? rotulo(n) : '—'}
                    </span>
                  </div>
                );
              })}
            </Bloco>

            <Bloco titulo="Avaliação final">
              <Linha k="Comportamental" v={rotulo(atual.comportamento)} nivel={atual.comportamento} forte />
              <Linha k="Performance" v={rotulo(atual.performance)} nivel={atual.performance} forte />
            </Bloco>

            {atual.missoes?.length > 0 && (
              <Bloco titulo="Missões do trimestre">
                <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                  {atual.missoes.map((m, i) => <li key={i}>{m}</li>)}
                </ol>
              </Bloco>
            )}
          </div>

          {/* ── coluna da direita: os dois textões ── */}
          <div className="space-y-3">
            <h3 className="text-center text-lg font-bold text-emerald-800 dark:text-emerald-300">
              Calibração {atual.trimestre}º/{atual.ano}
            </h3>

            <Texto titulo="Avaliação COMPORTAMENTAL" nivel={rotulo(atual.comportamento)} corpo={atual.texto_comportamental} />
            <Texto titulo="Avaliação de PERFORMANCE" nivel={rotulo(atual.performance)} corpo={atual.texto_performance} />

            {atual.observacao && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap border-l-2 pl-3">{atual.observacao}</p>
            )}
            {atual.registrado_por && (
              <p className="text-[10px] text-muted-foreground/70">registrado por {atual.registrado_por}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-emerald-900 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-1">{titulo}</div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function Linha({ k, v, nivel, forte }: { k: string; v: string; nivel?: string | null; forte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn('rounded px-1.5 py-0.5 text-[10px] uppercase', nivel ? COR_NIVEL[nivel] : '', forte && 'font-bold')}>{v}</span>
    </div>
  );
}

function Texto({ titulo, nivel, corpo }: { titulo: string; nivel: string; corpo: string | null }) {
  return (
    <div>
      <div className="rounded-full bg-emerald-900 text-white text-center text-sm font-bold py-1.5 mb-2">{titulo}</div>
      <div className="rounded-2xl border px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap">
        <strong className="uppercase">{nivel}</strong>
        {corpo ? <>: {corpo}</> : <span className="text-muted-foreground"> — sem texto registrado.</span>}
      </div>
    </div>
  );
}

/** Edição. `base` preenchido = corrigindo um trimestre que já existe. */
function Formulario({ dados, base, funcionarioId, hdr, salvando, setSalvando, onPronto, onCancelar }: {
  dados: Resposta; base: Calibracao | null; funcionarioId: number;
  hdr: () => Record<string, string>;
  salvando: boolean; setSalvando: (v: boolean) => void;
  onPronto: () => void; onCancelar: () => void;
}) {
  const { showToast } = useToast();
  const hoje = new Date();
  const [f, setF] = useState(() => ({
    ano: base?.ano ?? hoje.getFullYear(),
    trimestre: base?.trimestre ?? trimestreDe(hoje),
    comportamento: base?.comportamento || '',
    performance: base?.performance || '',
    auto_comportamento: base?.auto_comportamento || '',
    auto_performance: base?.auto_performance || '',
    texto_comportamental: base?.texto_comportamental || '',
    texto_performance: base?.texto_performance || '',
    nps_entrega: base?.nps_entrega != null ? String(base.nps_entrega) : '',
    observacao: base?.observacao || '',
    missoes: (base?.missoes?.length ? base.missoes : ['', '', '']).slice(0, 6),
  }));
  const [fit, setFit] = useState<Record<number, string>>(
    () => Object.fromEntries((base?.fit || []).map((x) => [x.valor_id, x.nota])),
  );
  const [atr, setAtr] = useState<Record<number, string>>(
    () => Object.fromEntries((base?.atributos || []).map((x) => [x.atributo_id, x.nivel])),
  );

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const salvar = async () => {
    if (!f.comportamento && !f.performance) {
      return showToast({ type: 'error', title: 'Informe ao menos um eixo', message: 'Comportamento ou Performance.' });
    }
    setSalvando(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/calibracoes`, {
        method: 'POST', headers: hdr(), credentials: 'include',
        body: JSON.stringify({
          ...f,
          missoes: f.missoes.map((m) => m.trim()).filter(Boolean),
          fit: Object.entries(fit).map(([valor_id, nota]) => ({ valor_id: Number(valor_id), nota })),
          atributos: Object.entries(atr).map(([atributo_id, nivel]) => ({ atributo_id: Number(atributo_id), nivel })),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      showToast({ type: 'success', title: 'Calibração salva' });
      onPronto();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  const Niveis = ({ valor, ao }: { valor: string; ao: (v: string) => void }) => (
    <div className="flex flex-wrap gap-1">
      {dados.niveis.map((n) => (
        <button key={n.id} type="button" onClick={() => ao(valor === n.id ? '' : n.id)}
          className={cn('text-[11px] rounded-full px-2 py-0.5 border',
            valor === n.id ? `${COR_NIVEL[n.id]} border-transparent font-semibold` : 'border-input hover:bg-muted')}>
          {n.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-muted-foreground">Trimestre</span>
          <select value={f.trimestre} onChange={(e) => set('trimestre', Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {[1, 2, 3, 4].map((t) => <option key={t} value={t}>{t}º trimestre</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-muted-foreground">Ano</span>
          <Input type="number" value={f.ano} onChange={(e) => set('ano', Number(e.target.value))} className="h-9 w-[100px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-muted-foreground">NPS Entrega</span>
          <Input value={f.nps_entrega} onChange={(e) => set('nps_entrega', e.target.value)} placeholder="70,8" className="h-9 w-[100px]" />
        </label>
        <p className="text-[10px] text-muted-foreground flex-1 min-w-[200px] pb-2">
          Salvar um trimestre que já existe corrige o registro — é assim que o comitê revisa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Campo titulo="Avaliação final — Comportamento"><Niveis valor={f.comportamento} ao={(v) => set('comportamento', v)} /></Campo>
        <Campo titulo="Avaliação final — Performance"><Niveis valor={f.performance} ao={(v) => set('performance', v)} /></Campo>
        <Campo titulo="Auto avaliação — Comportamento"><Niveis valor={f.auto_comportamento} ao={(v) => set('auto_comportamento', v)} /></Campo>
        <Campo titulo="Auto avaliação — Performance"><Niveis valor={f.auto_performance} ao={(v) => set('auto_performance', v)} /></Campo>
      </div>

      <Campo titulo="Fit cultural">
        <div className="space-y-1">
          {dados.valores_fit.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] truncate">{v.nome}</span>
              <div className="flex gap-1 shrink-0">
                {NOTA_FIT.map((n) => (
                  <button key={n} type="button"
                    onClick={() => setFit((p) => ({ ...p, [v.id]: p[v.id] === n ? '' : n }))}
                    className={cn('text-[11px] w-8 rounded border font-bold',
                      fit[v.id] === n ? `${COR_FIT[n]} border-transparent` : 'border-input hover:bg-muted')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Campo>

      {dados.atributos_cargo.length > 0 && (
        <Campo titulo="Atributos de performance do cargo">
          <div className="space-y-1.5">
            {dados.atributos_cargo.map((a) => (
              <div key={a.id}>
                <div className="text-[11px] mb-0.5">{a.nome}</div>
                <Niveis valor={atr[a.id] || ''} ao={(v) => setAtr((p) => ({ ...p, [a.id]: v }))} />
              </div>
            ))}
          </div>
        </Campo>
      )}

      <Campo titulo="Texto — Comportamental">
        <Textarea rows={5} value={f.texto_comportamental} onChange={(e) => set('texto_comportamental', e.target.value)}
          placeholder="O que sustenta o conceito: o que evoluiu, o que é ponto de desenvolvimento…" />
      </Campo>
      <Campo titulo="Texto — Performance">
        <Textarea rows={5} value={f.texto_performance} onChange={(e) => set('texto_performance', e.target.value)} />
      </Campo>

      <Campo titulo="Missões do trimestre">
        <div className="space-y-1">
          {f.missoes.map((m, i) => (
            <Input key={i} value={m} placeholder={`Missão ${i + 1}`} className="h-8 text-sm"
              onChange={(e) => setF((p) => { const ms = [...p.missoes]; ms[i] = e.target.value; return { ...p, missoes: ms }; })} />
          ))}
          {f.missoes.length < 6 && (
            <Button size="sm" variant="ghost" onClick={() => setF((p) => ({ ...p, missoes: [...p.missoes, ''] }))}>
              <Plus className="w-3.5 h-3.5 mr-1" />Missão
            </Button>
          )}
        </div>
      </Campo>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancelar} disabled={salvando}>Cancelar</Button>
        <Button size="sm" onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar calibração'}
        </Button>
      </div>
    </div>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{titulo}</div>
      {children}
    </div>
  );
}
