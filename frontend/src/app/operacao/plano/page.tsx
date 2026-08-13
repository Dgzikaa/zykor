'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { DetalheDiaDialog } from './DetalheDiaDialog';
import { ParametrosDialog } from './ParametrosDialog';
import { ChevronLeft, ChevronRight, Loader2, CalendarRange, Copy, Plus, Settings } from 'lucide-react';

// ---------------------------------------------------------------------------
// Cores das células, herdadas da planilha que esta tela substitui:
//   branco  = manual puro     verde = calculado     amarelo = calculado + override
// ---------------------------------------------------------------------------
const COR: Record<string, string> = {
  verde: 'bg-emerald-50 dark:bg-emerald-900/20',
  amarelo: 'bg-amber-50 dark:bg-amber-900/20',
  branco: '',
};

type Funcao = { id: string; codigo: string; nome: string; entra_no_custo: boolean; ordem: number };
type LinhaFuncao = {
  funcao_id: string; funcao_codigo: string; funcao_nome: string; entra_no_custo: boolean;
  total: number; total_calculado: number | null; total_manual: number | null;
  fixos: number; fixos_escala: number; fixos_manual: number | null;
  freelas: number; custo: number; total_origem: 'branco' | 'verde' | 'amarelo';
};
type Dia = {
  id: string; data: string; turno: 'unico' | 'dia' | 'noite';
  faturamento_previsto: number | null; publico: number | null; pico: number | null;
  publico_manual: number | null; pico_manual: number | null;
  programacao_musical: string | null; programacao_esportiva: string | null;
  entrada: string | null; promocao: string | null; plano_chao: string | null;
  pilula_treinamento: string | null; observacoes: string | null; data_especial: string | null;
  funcoes: LinhaFuncao[]; custo_dia: number;
};
type Resumo = {
  mes: string;
  total: { faturamento: number; custo: number; pct_cmo: number | null };
  semanas: Array<{ inicio: string; fim: string; dias_no_mes: number; faturamento: number; custo: number; pct_cmo: number | null }>;
  por_funcao: Array<{ funcao_nome: string; freelas: number; custo: number }>;
  limite_cmo_pct: number;
};

const fmtBRL = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number | null, casas = 0) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas });

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function segundaDa(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - (dow === 0 ? 6 : dow - 1)); // semana começa na segunda
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somaDias = (d: Date, n: number) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
const rotuloDia = (dataISO: string, turno: string) => {
  const [a, m, dd] = dataISO.split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
  const sufixo = turno === 'dia' ? ' (dia)' : turno === 'noite' ? ' (noite)' : '';
  return `${DIA_CURTO[dow]} ${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}${sufixo}`;
};

/** Célula numérica editável. Vazio = limpa o override e volta ao automático. */
function CelulaNum({ valor, origem, sufixo, onSalvar, disabled, titulo }: {
  valor: number | null; origem?: 'branco' | 'verde' | 'amarelo'; sufixo?: string;
  onSalvar: (v: number | null) => void; disabled?: boolean; titulo?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState('');
  if (disabled) {
    return <span className={`block px-1.5 py-1 tabular-nums text-center ${COR[origem || 'branco']}`}>{fmtNum(valor)}{sufixo}</span>;
  }
  if (editando) {
    return (
      <input
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => { setEditando(false); const v = txt.trim() === '' ? null : Number(txt.replace(',', '.')); if (!Number.isNaN(v as number)) onSalvar(v); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setTxt(String(valor ?? '')); setEditando(false); }
        }}
        ref={(el) => el?.focus()}
        className="w-full px-1 py-1 text-center text-xs tabular-nums border border-blue-400 rounded bg-white dark:bg-gray-900"
      />
    );
  }
  return (
    <button
      title={titulo}
      onClick={() => { setTxt(valor == null ? '' : String(valor)); setEditando(true); }}
      className={`w-full px-1.5 py-1 tabular-nums text-center hover:ring-1 hover:ring-blue-400 rounded ${COR[origem || 'branco']}`}
    >
      {fmtNum(valor)}{sufixo}
    </button>
  );
}

export default function PlanoOperacionalPage() {
  const { setPageTitle } = usePageTitle();
  const { soLeitura } = useModuloPermissao('/operacao/plano');
  const { showToast } = useToast();
  useEffect(() => { setPageTitle('🗓️ Plano Operacional'); return () => setPageTitle(''); }, [setPageTitle]);

  const [segunda, setSegunda] = useState(() => segundaDa(new Date()));
  const [visao, setVisao] = useState<'semana' | 'mes'>('semana');

  // No mês, a régua é o mês da segunda-feira em foco. É de propósito que semana e mês
  // sejam recortes independentes sobre a mesma data: é isso que dispensa o recorte manual
  // que a planilha exigia quando o mês começava no meio da semana.
  const mesRef = `${segunda.getUTCFullYear()}-${String(segunda.getUTCMonth() + 1).padStart(2, '0')}`;
  const de = visao === 'semana'
    ? iso(segunda)
    : iso(new Date(Date.UTC(segunda.getUTCFullYear(), segunda.getUTCMonth(), 1)));
  const ate = visao === 'semana'
    ? iso(somaDias(segunda, 6))
    : iso(new Date(Date.UTC(segunda.getUTCFullYear(), segunda.getUTCMonth() + 1, 0)));

  const { data, isLoading, mutate } = useApiSWR<{ dias: Dia[]; funcoes: Funcao[]; totais: { faturamento: number; custo: number } }>(
    `/api/operacao/plano?de=${de}&ate=${ate}`,
  );
  const { data: resumo } = useApiSWR<Resumo>(`/api/operacao/resumo?mes=${mesRef}`);

  const dias = useMemo(() => data?.dias || [], [data]);
  const funcoes = useMemo(() => (data?.funcoes || []).filter(f => f.entra_no_custo), [data]);

  const salvarDia = useCallback(async (dia: Dia | null, dataISO: string, turno: string, campo: string, valor: unknown) => {
    try {
      await api.patch('/api/operacao/plano/dia', { data: dataISO, turno, [campo]: valor });
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    }
  }, [mutate, showToast]);

  const salvarFuncao = useCallback(async (dia: Dia, funcaoId: string, campo: 'total_manual' | 'fixos_manual', valor: number | null) => {
    try {
      await api.patch('/api/operacao/plano/funcao', { data: dia.data, turno: dia.turno, funcao_id: funcaoId, [campo]: valor });
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    }
  }, [mutate, showToast]);

  /**
   * Cria os dias da semana. Sem isso a tela era beco sem saída: a tabela só desenha as
   * colunas que vieram do banco, então semana ainda não planejada não tinha onde digitar.
   * `copiar` traz o contexto da semana anterior — é como a planilha era usada na prática.
   */
  const [criando, setCriando] = useState(false);
  const criarSemana = useCallback(async (copiar: boolean) => {
    setCriando(true);
    try {
      const r = await api.post('/api/operacao/plano/semana', {
        inicio: iso(segunda),
        copiar_de: copiar ? iso(somaDias(segunda, -7)) : undefined,
      });
      showToast({ type: 'success', title: 'Semana criada', message: `${r.criados} dias${copiar ? ', copiando a semana anterior' : ''}.` });
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não criou', message: e?.message });
    } finally {
      setCriando(false);
    }
  }, [segunda, mutate, showToast]);

  const [diaAberto, setDiaAberto] = useState<Dia | null>(null);
  const [parametrosAberto, setParametrosAberto] = useState(false);

  const custoSemana = dias.reduce((s, d) => s + Number(d.custo_dia || 0), 0);
  const fatSemana = dias.reduce((s, d) => s + Number(d.faturamento_previsto || 0), 0);
  const pctCmo = fatSemana > 0 ? (custoSemana / fatSemana) * 100 : null;

  const linhaDe = (d: Dia, fid: string) => d.funcoes.find(f => f.funcao_id === fid);

  return (
    <PageShell width="wide">
      {/* Navegação da semana */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSegunda(s => somaDias(s, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium inline-flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            {rotuloDia(de, 'unico').slice(4)} — {rotuloDia(ate, 'unico').slice(4)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSegunda(s => somaDias(s, 7))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setSegunda(segundaDa(new Date()))}>hoje</Button>
          <div className="ml-2 inline-flex rounded-md border border-[hsl(var(--border))] overflow-hidden">
            <button onClick={() => setVisao('semana')}
              className={`px-2.5 py-1 text-xs ${visao === 'semana' ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-muted'}`}>Semana</button>
            <button onClick={() => setVisao('mes')}
              className={`px-2.5 py-1 text-xs ${visao === 'mes' ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-muted'}`}>Mês</button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {soLeitura && <BadgeSomenteLeitura />}
          <Button variant="outline" size="sm" onClick={() => setParametrosAberto(true)}
            title="Giro, ticket médio por dia da semana, nível de serviço e diária">
            <Settings className="w-4 h-4 mr-1.5" />Parâmetros
          </Button>
          <span>Faturamento previsto <b className="tabular-nums">{fmtBRL(fatSemana)}</b></span>
          <span>Freela projetado <b className="tabular-nums">{fmtBRL(custoSemana)}</b></span>
          {pctCmo != null && (
            <span className={pctCmo > 21 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
              {pctCmo.toFixed(1)}% {pctCmo > 21 && '⚠ acima de 21%'}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…
        </CardContent></Card>
      ) : dias.length === 0 ? (
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Esta semana ainda não foi planejada.</p>
          {!soLeitura && visao === 'semana' && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => criarSemana(true)} disabled={criando}>
                {criando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                Copiar a semana anterior
              </Button>
              <Button size="sm" variant="outline" onClick={() => criarSemana(false)} disabled={criando}>
                <Plus className="w-4 h-4 mr-2" />Criar em branco
              </Button>
            </div>
          )}
          {visao === 'mes' && <p className="text-xs text-muted-foreground">Volte para a visão Semana para criar os dias.</p>}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-[hsl(var(--card))] z-10 min-w-[150px]">&nbsp;</th>
                {dias.map(d => {
                  // 248 dias de briefing vieram da planilha e ficavam invisíveis — o cabeçalho
                  // do dia abre o painel com programação, plano de chão, promoção e observações.
                  const temContexto = !!(d.programacao_musical || d.programacao_esportiva || d.plano_chao
                    || d.promocao || d.entrada || d.observacoes || d.pilula_treinamento);
                  return (
                    <th key={d.id} className="px-2 py-2 font-medium text-center min-w-[92px] whitespace-nowrap">
                      <button onClick={() => setDiaAberto(d)}
                        title="Abrir programação, plano de chão e observações do dia"
                        className="hover:underline decoration-dotted">
                        {rotuloDia(d.data, d.turno)}
                        {temContexto && <span className="ml-1 text-blue-500" aria-hidden>•</span>}
                      </button>
                      {d.data_especial && (
                        <div className="text-[10px] font-normal text-amber-600 truncate max-w-[92px]" title={d.data_especial}>
                          {d.data_especial}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* --- entrada + cadeia de cálculo --- */}
              <tr className="border-b border-[hsl(var(--border))]">
                <td className="px-3 py-1.5 sticky left-0 bg-[hsl(var(--card))]">Faturamento previsto</td>
                {dias.map(d => (
                  <td key={d.id} className="px-1 py-1">
                    <CelulaNum valor={d.faturamento_previsto} origem="branco" disabled={soLeitura}
                      titulo="Entrada manual — é daqui que a cadeia toda sai"
                      onSalvar={(v) => salvarDia(d, d.data, d.turno, 'faturamento_previsto', v)} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[hsl(var(--border))]">
                <td className="px-3 py-1.5 sticky left-0 bg-[hsl(var(--card))]">Público esperado</td>
                {dias.map(d => (
                  <td key={d.id} className="px-1 py-1">
                    <CelulaNum valor={d.publico} origem={d.publico_manual != null ? 'amarelo' : 'verde'} disabled={soLeitura}
                      titulo="Faturamento ÷ ticket médio do dia da semana"
                      onSalvar={(v) => salvarDia(d, d.data, d.turno, 'publico_manual', v)} />
                  </td>
                ))}
              </tr>
              <tr className="border-b-2 border-[hsl(var(--border))]">
                <td className="px-3 py-1.5 sticky left-0 bg-[hsl(var(--card))]">Pico / lugares</td>
                {dias.map(d => (
                  <td key={d.id} className="px-1 py-1">
                    <CelulaNum valor={d.pico} origem={d.pico_manual != null ? 'amarelo' : 'verde'} disabled={soLeitura}
                      titulo="Público ÷ giro de lotação"
                      onSalvar={(v) => salvarDia(d, d.data, d.turno, 'pico_manual', v)} />
                  </td>
                ))}
              </tr>

              {/* --- quadro por função: TOTAL / fixos / freelas --- */}
              {funcoes.map(f => (
                <tr key={f.id} className="border-b border-[hsl(var(--border))] hover:bg-muted/30">
                  <td className="px-3 py-1.5 sticky left-0 bg-[hsl(var(--card))]">{f.nome}</td>
                  {dias.map(d => {
                    const l = linhaDe(d, f.id);
                    return (
                      <td key={d.id} className="px-1 py-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="flex-1">
                            <CelulaNum valor={l?.total ?? null} origem={l?.total_origem} disabled={soLeitura}
                              titulo={`Total = teto(pico ÷ nível de serviço). Fixos da escala: ${l?.fixos_escala ?? 0}`}
                              onSalvar={(v) => salvarFuncao(d, f.id, 'total_manual', v)} />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right"
                            title={`${l?.fixos ?? 0} fixos da escala · ${l?.freelas ?? 0} freelas`}>
                            {l?.fixos ?? 0}/{l?.freelas ?? 0}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="border-t-2 border-[hsl(var(--border))] font-semibold bg-muted/40">
                <td className="px-3 py-2 sticky left-0 bg-muted/40">Custo projetado (freela)</td>
                {dias.map(d => (
                  <td key={d.id} className="px-2 py-2 text-center tabular-nums">{fmtBRL(d.custo_dia)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {/* Resumo do mês — espelha os blocos "RESUMO SEMANAL" e "RESUMO MENSAL" da planilha.
          A semana atravessa a virada de mês sem recorte manual: `dias_no_mes` deixa
          explícito quando ela é parcial, que era o trabalho chato de todo mês. */}
      {resumo && resumo.semanas.length > 0 && (
        <Card><CardContent className="py-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold text-sm">Resumo de {resumo.mes.slice(5)}/{resumo.mes.slice(2, 4)}</span>
            <span className="text-sm">
              {fmtBRL(resumo.total.faturamento)} previstos · <b className="tabular-nums">{fmtBRL(resumo.total.custo)}</b> de freela
              {resumo.total.pct_cmo != null && (
                <span className={resumo.total.pct_cmo > resumo.limite_cmo_pct ? ' text-red-600 font-semibold' : ' text-muted-foreground'}>
                  {' '}({resumo.total.pct_cmo.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Por semana</div>
              <table className="w-full text-xs">
                <tbody>
                  {resumo.semanas.map(s => (
                    <tr key={s.inicio} className="border-b border-[hsl(var(--border))] last:border-0">
                      <td className="py-1">
                        {s.inicio.slice(8)}/{s.inicio.slice(5, 7)} — {s.fim.slice(8)}/{s.fim.slice(5, 7)}
                        {s.dias_no_mes < 7 && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            {s.dias_no_mes} {s.dias_no_mes === 1 ? 'dia' : 'dias'} neste mês
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right tabular-nums">{fmtBRL(s.faturamento)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBRL(s.custo)}</td>
                      <td className={`py-1 text-right tabular-nums w-14 ${s.pct_cmo != null && s.pct_cmo > resumo.limite_cmo_pct ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                        {s.pct_cmo == null ? '—' : `${s.pct_cmo.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Por função (freelas no mês)</div>
              <table className="w-full text-xs">
                <tbody>
                  {resumo.por_funcao.map(f => (
                    <tr key={f.funcao_nome} className="border-b border-[hsl(var(--border))] last:border-0">
                      <td className="py-1">{f.funcao_nome}</td>
                      <td className="py-1 text-right tabular-nums text-muted-foreground">{fmtNum(f.freelas)} diárias</td>
                      <td className="py-1 text-right tabular-nums">{fmtBRL(f.custo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent></Card>
      )}

      {diaAberto && (
        <DetalheDiaDialog
          dia={diaAberto}
          titulo={rotuloDia(diaAberto.data, diaAberto.turno)}
          soLeitura={soLeitura}
          onFechar={() => setDiaAberto(null)}
          onSalvo={async () => { await mutate(); }}
        />
      )}
      <ParametrosDialog open={parametrosAberto} onOpenChange={setParametrosAberto}
        soLeitura={soLeitura} onSalvo={async () => { await mutate(); }} />

      <p className="text-xs text-muted-foreground">
        <span className="inline-block w-3 h-3 rounded-sm align-middle bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 mr-1" />
        calculado ·
        <span className="inline-block w-3 h-3 rounded-sm align-middle bg-amber-50 dark:bg-amber-900/20 border border-amber-300 mx-1" />
        calculado com ajuste manual · sem cor = digitado. Sob cada total, <b>fixos/freelas</b> —
        os fixos vêm da Escala. Apagar o valor de uma célula ajustada devolve ela ao automático.
      </p>
    </PageShell>
  );
}
