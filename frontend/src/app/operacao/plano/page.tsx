'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
import { origemCelula } from '@/lib/operacao/calculo';
import { DetalheDiaDialog } from './DetalheDiaDialog';
import { ParametrosDialog } from './ParametrosDialog';
import { ChevronLeft, ChevronRight, Loader2, CalendarRange, Copy, Plus, Settings, DownloadCloud, CalendarCheck } from 'lucide-react';

// ---------------------------------------------------------------------------
// Cores das células, herdadas da planilha que esta tela substitui:
//   branco  = manual puro     verde = calculado     amarelo = calculado + override
// ---------------------------------------------------------------------------
const COR: Record<string, string> = {
  verde: 'bg-emerald-50 dark:bg-emerald-900/20',
  amarelo: 'bg-amber-50 dark:bg-amber-900/20',
  branco: '',
};

/**
 * Linhas de texto da planilha, na ordem exata da coluna A. Elas ficam NA GRADE (e não só
 * num painel) porque é assim que a operação lê o dia: programação, entrada e plano de chão
 * são o briefing que o time confere lado a lado com o quadro de gente.
 */
const LINHAS_TEXTO: Array<{ campo: keyof Dia; label: string; multilinha?: boolean }> = [
  { campo: 'programacao_musical', label: 'Programação Musical', multilinha: true },
  { campo: 'entrada', label: 'Entrada' },
  { campo: 'promocao', label: 'Promoção do Dia' },
  { campo: 'programacao_esportiva', label: 'Programação Esportiva', multilinha: true },
];
const LINHAS_TEXTO_PLANO: Array<{ campo: keyof Dia; label: string; multilinha?: boolean }> = [
  { campo: 'plano_chao', label: 'Plano de Chão', multilinha: true },
];
/** A planilha separa o bloco de operação do de segurança, cada um com o seu Headcount. */
const COD_SEGURANCA = ['seguranca', 'brigadista'];

// Pílula de Treinamento e Observações saíram da grade em 13/08/2026: estavam vazias em
// TODAS as semanas (na planilha existiam e quase nunca eram preenchidas) e custavam duas
// linhas de altura da grade. Continuam existindo no painel do dia, que é onde se escreve.

type Funcao = { id: string; codigo: string; nome: string; entra_no_custo: boolean; ordem: number };
type LinhaFuncao = {
  funcao_id: string; funcao_codigo: string; funcao_nome: string; entra_no_custo: boolean;
  total: number; total_calculado: number | null; total_manual: number | null;
  fixos: number; fixos_escala: number; fixos_manual: number | null;
  freelas: number; custo: number; total_origem: 'branco' | 'verde' | 'amarelo';
};
type Dia = {
  id: string; data: string; turno: 'unico' | 'dia' | 'noite';
  // faturamento_previsto = coalesce(manual, m1). O M1 vem do planejamento comercial.
  faturamento_previsto: number | null; faturamento_manual: number | null; faturamento_m1: number | null;
  publico: number | null; pico: number | null;
  publico_manual: number | null; pico_manual: number | null;
  reservas: number | null; reservas_pessoas: number | null;
  programacao_musical: string | null; programacao_esportiva: string | null;
  entrada: string | null; promocao: string | null; plano_chao: string | null;
  pilula_treinamento: string | null; observacoes: string | null; data_especial: string | null;
  funcoes: LinhaFuncao[]; custo_dia: number;
};
/** Mesmos campos do bloco RESUMO da planilha. */
type Resumo = {
  escopo: 'semana' | 'mes';
  custo_freelas: number; cmo_fixo: number; publico_proj: number; fat_proj: number;
  cmo_pct: number | null;
  /** de onde saiu a folha: já paga, projetada pela média, ou digitada no parâmetro */
  cmo_fixo_origem: 'realizado' | 'projecao' | 'manual' | 'sem_dado';
  cmo_fixo_projecao_mensal: number | null;
  por_funcao: Array<{ label: string; qtde: number; custo: number }>;
  semanas: Array<{ inicio: string; fim: string; dias_no_periodo: number; faturamento: number; custo: number; cmo_pct: number | null; parcial: boolean }>;
  limite_cmo_pct: number;
};

const fmtBRL = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number | null, casas = 0) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas });

/**
 * De onde saiu a folha do mês. Antes era uma constante digitada (R$ 172.000, a folha de
 * janeiro) e o mês "sempre ficava errado" — hoje vem do financeiro, e o rótulo diz se o
 * número já foi pago ou é projeção.
 */
const ORIGEM_FOLHA: Record<string, { rotulo: string; cor: string; ajuda: string }> = {
  realizado: {
    rotulo: 'realizado', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    ajuda: 'Folha que já foi lançada no financeiro neste mês (sem pró-labore), rateada pelos dias do período.',
  },
  projecao: {
    rotulo: 'projeção', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    ajuda: 'O mês ainda não fechou: usa a média da folha dos 3 últimos meses fechados, rateada pelos dias do período.',
  },
  manual: {
    rotulo: 'digitado', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    ajuda: 'Alguém digitou a folha nos Parâmetros — o financeiro está sendo ignorado. Limpe o campo para voltar ao automático.',
  },
  sem_dado: {
    rotulo: 'sem folha', cor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    ajuda: 'Não há folha lançada no financeiro para calcular. O CMO abaixo está incompleto.',
  },
};

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
function CelulaNum({ valor, origem, sufixo, onSalvar, disabled, titulo, moeda }: {
  valor: number | null; origem?: 'branco' | 'verde' | 'amarelo'; sufixo?: string;
  onSalvar: (v: number | null) => void; disabled?: boolean; titulo?: string; moeda?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState('');
  const mostrar = (v: number | null) => (moeda ? fmtBRL(v) : fmtNum(v));
  if (disabled) {
    return <span className={`block px-1.5 py-1 tabular-nums text-center ${COR[origem || 'branco']}`}>{mostrar(valor)}{sufixo}</span>;
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
      {mostrar(valor)}{sufixo}
    </button>
  );
}

/**
 * Célula de texto da grade. Mostra o conteúdo (com quebra de linha preservada, que o plano
 * de chão usa) e vira textarea no clique. Não trunca com "…": o time precisa ler o dia
 * inteiro sem abrir nada.
 */
/**
 * Quantas linhas o texto mostra antes de cortar. Classe estática porque o Tailwind não
 * gera `line-clamp-${n}` dinâmico. `none` = mostra tudo (é o caso do plano de chão, que o
 * time lê inteiro antes de montar o salão).
 */
const CLAMP: Record<string, string> = {
  '2': 'line-clamp-2', '3': 'line-clamp-3', '4': 'line-clamp-4', none: '',
};

function CelulaTexto({ valor, multilinha, disabled, expandido, clamp = '3', onSalvar }: {
  valor: string; multilinha: boolean; disabled?: boolean; expandido?: boolean;
  clamp?: keyof typeof CLAMP; onSalvar: (v: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState('');

  if (editando) {
    return (
      <textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => { setEditando(false); if (txt !== valor) onSalvar(txt); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setTxt(valor); setEditando(false); }
          // Enter salva em linha única; multilinha exige Ctrl+Enter (Enter quebra linha)
          if (e.key === 'Enter' && (!multilinha || e.ctrlKey)) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
        }}
        ref={(el) => el?.focus()}
        rows={multilinha ? 4 : 1}
        className="w-full px-1.5 py-1 text-[11px] border border-blue-400 rounded bg-white dark:bg-gray-900 resize-y"
      />
    );
  }
  return (
    <button
      onClick={() => { if (!disabled) { setTxt(valor); setEditando(true); } }}
      disabled={disabled}
      title={valor || undefined}
      className={`w-full text-left px-1 py-1 text-[10px] whitespace-pre-wrap break-words leading-tight
        ${expandido ? '' : CLAMP[clamp]}
        ${disabled ? '' : 'hover:ring-1 hover:ring-blue-400 rounded'} ${!valor ? 'text-gray-300' : ''}`}
    >
      {valor || '·'}
    </button>
  );
}

/**
 * As 3 sub-colunas de uma função num dia: Precisa | Escala | Freelas.
 *
 * O custo POR FUNÇÃO saiu em 13/08/2026 (pedido do Rodrigo: "esse custo individual aqui pode
 * ocultar"). Ele era derivável na cabeça (freelas × diária) e ocupava 1/4 da largura de cada
 * dia sem responder nada que o "Custo Proj do Dia" e o resumo já não respondam.
 */
function CelulasFuncao({ dia, funcao, linha, soLeitura, onSalvar }: {
  dia: Dia; funcao: Funcao; linha: LinhaFuncao | undefined; soLeitura: boolean;
  onSalvar: (d: Dia, funcaoId: string, campo: 'total_manual' | 'fixos_manual', v: number | null) => void;
}) {
  return (
    <Fragment>
      <td className="px-0.5 py-0.5 border-l border-[hsl(var(--border))]">
        <CelulaNum valor={linha?.total ?? null} origem={linha?.total_origem} disabled={soLeitura}
          titulo="Total = teto(pico ÷ nível de serviço). Apagar devolve ao automático."
          onSalvar={(v) => onSalvar(dia, funcao.id, 'total_manual', v)} />
      </td>
      <td className="px-0.5 py-0.5">
        {/* FIXOS vem da Escala. Editar aqui é override — o automático continua por trás. */}
        <CelulaNum valor={linha?.fixos ?? null} origem={linha?.fixos_manual != null ? 'amarelo' : 'verde'} disabled={soLeitura}
          titulo={`Da Escala: ${linha?.fixos_escala ?? 0}. Editar aqui sobrepõe só neste dia.`}
          onSalvar={(v) => onSalvar(dia, funcao.id, 'fixos_manual', v)} />
      </td>
      {/* Freelas e o que sai do bolso — ganha destaque. Zero fica apagado pra a vista bater
          direto nos dias que exigem contratacao. O custo em R$ vive no total do dia. */}
      <td className={`px-0.5 py-0.5 text-center tabular-nums ${linha?.freelas ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-300'}`}
        title={linha?.custo ? `Custo projetado: ${fmtBRL(linha.custo)}` : undefined}>
        {linha?.freelas || '—'}
      </td>
    </Fragment>
  );
}

/** Headcount = soma dos TOTAL / FIXOS / FREELAS do bloco (Ops ou Segurança). */
function LinhaHeadcount({ rotulo, dias, funcoes, linhaDe }: {
  rotulo: string; dias: Dia[]; funcoes: Funcao[];
  linhaDe: (d: Dia, fid: string) => LinhaFuncao | undefined;
}) {
  return (
    <tr className="border-b-2 border-[hsl(var(--border))] font-medium bg-muted/20">
      <td className="px-2 py-1 sticky left-0 bg-muted/20 z-10 text-[11px]">{rotulo}</td>
      {dias.map(d => {
        const ls = funcoes.map(f => linhaDe(d, f.id)).filter(Boolean) as LinhaFuncao[];
        const soma = (k: 'total' | 'fixos' | 'freelas') => ls.reduce((s, l) => s + (Number(l[k]) || 0), 0);
        return (
          <Fragment key={d.id}>
            <td className="px-0.5 py-1 text-center tabular-nums border-l border-[hsl(var(--border))]">{soma('total')}</td>
            <td className="px-0.5 py-1 text-center tabular-nums">{soma('fixos')}</td>
            <td className="px-0.5 py-1 text-center tabular-nums">{soma('freelas')}</td>
          </Fragment>
        );
      })}
    </tr>
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
  const { data: resumo } = useApiSWR<Resumo>(`/api/operacao/resumo?de=${de}&ate=${ate}&escopo=${visao}`);

  const dias = useMemo(() => data?.dias || [], [data]);
  const funcoes = useMemo(() => (data?.funcoes || []).filter(f => f.entra_no_custo), [data]);
  const funcoesOps = useMemo(() => funcoes.filter(f => !COD_SEGURANCA.includes(f.codigo)), [funcoes]);
  const funcoesSeg = useMemo(() => funcoes.filter(f => COD_SEGURANCA.includes(f.codigo)), [funcoes]);

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

  /**
   * Puxa o faturamento do M1 do planejamento comercial para o período aberto.
   * É botão e não automático porque GET não escreve — e porque o M1 muda no comercial e a
   * operação precisa ver QUANDO mudou, em vez do número virar sozinho debaixo do plano.
   */
  const [puxandoM1, setPuxandoM1] = useState(false);
  const puxarM1 = useCallback(async () => {
    setPuxandoM1(true);
    try {
      const r = await api.post('/api/operacao/plano/m1', { de, ate });
      const semM1 = (r.sem_m1 || []).length;
      showToast({
        type: 'success',
        title: r.dias_com_m1 ? `${r.dias_com_m1} dias atualizados` : 'Nada mudou',
        message: semM1
          ? `${semM1} dia(s) sem M1 no planejamento continuam como estavam.`
          : 'Faturamento e cadeia de cálculo em dia com o planejamento comercial.',
      });
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não puxou o M1', message: e?.message });
    } finally {
      setPuxandoM1(false);
    }
  }, [de, ate, mutate, showToast]);

  const [diaAberto, setDiaAberto] = useState<Dia | null>(null);
  const [parametrosAberto, setParametrosAberto] = useState(false);
  // As linhas de texto ficam em 3 linhas por padrão pra a semana inteira caber na tela sem
  // rolagem. O plano de chão tem 4-5 itens e sozinho empurrava o quadro de gente pra baixo.
  const [briefingAberto, setBriefingAberto] = useState(false);

  const custoSemana = dias.reduce((s, d) => s + Number(d.custo_dia || 0), 0);
  const fatSemana = dias.reduce((s, d) => s + Number(d.faturamento_previsto || 0), 0);
  // O CMO do cabeçalho é o MESMO do resumo — (freela + folha) / faturamento. Antes daqui
  // saía só o freela sobre o faturamento (~4%) comparado com um teto de 21%: dois números
  // diferentes com o mesmo nome na mesma tela.
  const pctCmo = resumo?.cmo_pct ?? null;
  const limiteCmo = resumo?.limite_cmo_pct ?? 20;

  const linhaDe = (d: Dia, fid: string) => d.funcoes.find(f => f.funcao_id === fid);

  /** Público somado dos turnos da mesma data — o sábado partido tem dois. */
  const publicoPorData = useMemo(() => {
    const m = new Map<string, number>();
    dias.forEach(d => m.set(d.data, (m.get(d.data) || 0) + Number(d.publico || 0)));
    return m;
  }, [dias]);

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
          <Button variant="ghost" size="sm" onClick={() => setBriefingAberto(v => !v)}
            title="Mostrar o texto completo da programação, plano de chão e observações">
            {briefingAberto ? 'Compactar briefing' : 'Expandir briefing'}
          </Button>
          {!soLeitura && (
            <Button variant="outline" size="sm" onClick={puxarM1} disabled={puxandoM1}
              title="Traz o faturamento planejado pelo comercial (M1) para os dias deste período">
              {puxandoM1 ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <DownloadCloud className="w-4 h-4 mr-1.5" />}
              Puxar M1
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setParametrosAberto(true)}
            title="Giro, ticket médio por dia da semana, nível de serviço, diária e folha">
            <Settings className="w-4 h-4 mr-1.5" />Parâmetros
          </Button>
          <span>Faturamento previsto <b className="tabular-nums">{fmtBRL(fatSemana)}</b></span>
          <span>Freela projetado <b className="tabular-nums">{fmtBRL(custoSemana)}</b></span>
          {pctCmo != null && (
            <span className={pctCmo > limiteCmo ? 'text-red-600 font-semibold' : 'text-muted-foreground'}
              title="CMO = (freela projetado + folha rateada no período) ÷ faturamento previsto">
              CMO {pctCmo.toFixed(1)}% {pctCmo > limiteCmo && `⚠ acima de ${limiteCmo}%`}
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
      ) : visao === 'mes' ? (
        // No mês a grade diária não entra: 31 dias × 4 colunas ficam ilegíveis, e o que se
        // olha no mês é o consolidado. O detalhe do dia vive na visão Semana.
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
          {dias.filter(d => d.turno !== 'noite').length} dias planejados no mês.
          Troque para <b>Semana</b> para ver e editar o dia a dia.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto">
          {/* Layout espelhando a planilha: cada linha da coluna A vira uma linha, e cada dia
              ocupa 4 sub-colunas (Precisa | Escala | Freelas | Custo) nas linhas de função.
              As linhas de texto ocupam as 4 colunas do dia.

              table-fixed + colgroup: a semana INTEIRA cabe na tela sem rolagem lateral. Sem
              isso o conteúdo mandava na largura e um plano de chão comprido empurrava tudo
              pra fora — a leitura da semana virava scroll horizontal. */}
          <table className="w-full text-xs border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '132px' }} />
              {dias.map(d => (
                <Fragment key={d.id}>
                  <col /><col /><col />
                </Fragment>
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="text-left px-2 py-2 font-medium sticky left-0 bg-[hsl(var(--card))] z-20">&nbsp;</th>
                {dias.map(d => (
                  <th key={d.id} colSpan={3}
                    className="px-1 py-1.5 font-medium text-center whitespace-nowrap border-l border-[hsl(var(--border))] text-[11px]">
                    {/* Clicar abre o painel do dia — é lá que fica o "dia atípico"
                        (festival/feriado com ticket e giro próprios), que não cabe na grade. */}
                    <button onClick={() => setDiaAberto(d)} title="Dia atípico: ticket e giro próprios deste dia"
                      className="hover:underline decoration-dotted">
                      {rotuloDia(d.data, d.turno)}
                    </button>
                    {d.data_especial && (
                      <div className="text-[10px] font-normal text-amber-600 truncate" title={d.data_especial}>
                        {d.data_especial}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ---- contexto do dia (texto), igual às primeiras linhas da planilha ---- */}
              {LINHAS_TEXTO.map(lt => (
                <tr key={lt.campo} className="border-b border-[hsl(var(--border))] align-top">
                  <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-muted-foreground text-[10px]">{lt.label}</td>
                  {dias.map(d => (
                    <td key={d.id} colSpan={3} className="p-0 border-l border-[hsl(var(--border))]">
                      <CelulaTexto
                        valor={(d[lt.campo] as string) || ''}
                        multilinha={!!lt.multilinha}
                        disabled={soLeitura}
                        expandido={briefingAberto}
                        onSalvar={(v) => salvarDia(d, d.data, d.turno, lt.campo as string, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}

              {/* ---- cadeia de cálculo ---- */}
              <tr className="border-b border-[hsl(var(--border))]">
                <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-[11px]">Expect Faturamento</td>
                {dias.map(d => (
                  <td key={d.id} colSpan={3} className="px-1 py-1 border-l border-[hsl(var(--border))]">
                    {/* Verde = veio do M1 do comercial; amarelo = digitado por cima dele;
                        branco = digitado sem M1 por trás. Apagar a célula volta pro M1. */}
                    <CelulaNum valor={d.faturamento_previsto} disabled={soLeitura} moeda
                      origem={origemCelula(d.faturamento_m1, d.faturamento_manual)}
                      titulo={d.faturamento_m1 != null
                        ? `M1 do planejamento: ${fmtBRL(d.faturamento_m1)}${d.faturamento_manual != null ? ' (sobrescrito — apague a célula para voltar)' : ''}`
                        : 'Sem M1 para este dia — valor digitado'}
                      onSalvar={(v) => salvarDia(d, d.data, d.turno, 'faturamento_manual', v)} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[hsl(var(--border))]">
                <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-[11px]">Expectativa de Público</td>
                {dias.map(d => (
                  <td key={d.id} colSpan={3} className="px-1 py-1 border-l border-[hsl(var(--border))]">
                    <CelulaNum valor={d.publico} origem={d.publico_manual != null ? 'amarelo' : 'verde'} disabled={soLeitura}
                      titulo="Faturamento ÷ ticket médio do dia da semana"
                      onSalvar={(v) => salvarDia(d, d.data, d.turno, 'publico_manual', v)} />
                  </td>
                ))}
              </tr>
              {/* Reservas do GetIn — quanto do público esperado já tem mesa marcada.
                  Não entra em conta nenhuma: é leitura, pra decidir escala olhando o real.
                  Sobe até o dia, então o rótulo diz "até agora" em vez de deixar parecer
                  que a expectativa está furada quando a semana ainda está começando. */}
              <tr className="border-b border-[hsl(var(--border))]">
                <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck className="w-3 h-3" />Reservas até agora
                  </span>
                </td>
                {dias.map(d => {
                  // O % é sobre o público do DIA INTEIRO, não do turno: a reserva do GetIn é da
                  // data, e no sábado partido comparar as 389 pessoas com o público só do turno
                  // dia dava 549% — lia como erro na tela.
                  const publicoDoDia = publicoPorData.get(d.data) || 0;
                  const pct = d.reservas_pessoas != null && publicoDoDia ? (d.reservas_pessoas / publicoDoDia) * 100 : null;
                  return (
                    <td key={d.id} colSpan={3}
                      className="px-1 py-1 text-center text-[11px] tabular-nums border-l border-[hsl(var(--border))]"
                      title={d.reservas != null
                        ? `${d.reservas} reservas no GetIn${pct != null ? ` — ${pct.toFixed(0)}% do público esperado do dia` : ''}${d.turno !== 'unico' ? '. O GetIn não separa dia e noite: é a reserva do sábado inteiro, comparada com o público dos dois turnos.' : ''}`
                        : 'Nenhuma reserva registrada no GetIn para este dia'}>
                      {d.reservas_pessoas == null ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <>
                          <span>{fmtNum(d.reservas_pessoas)} pes.</span>
                          {pct != null && (
                            <span className="ml-1 text-muted-foreground">({pct.toFixed(0)}%)</span>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b border-[hsl(var(--border))]">
                <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-[11px]">Pico/Lugares</td>
                {dias.map(d => (
                  <td key={d.id} colSpan={3} className="px-1 py-1 border-l border-[hsl(var(--border))]">
                    <CelulaNum valor={d.pico} origem={d.pico_manual != null ? 'amarelo' : 'verde'} disabled={soLeitura}
                      titulo="Público ÷ giro de lotação"
                      onSalvar={(v) => salvarDia(d, d.data, d.turno, 'pico_manual', v)} />
                  </td>
                ))}
              </tr>

              {/* Plano de Chão fecha o bloco de contexto, como na planilha (vem depois do pico). */}
              {LINHAS_TEXTO_PLANO.map(lt => (
                <tr key={lt.campo} className="border-b-2 border-[hsl(var(--border))] align-top">
                  <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-muted-foreground text-[10px]">{lt.label}</td>
                  {dias.map(d => (
                    <td key={d.id} colSpan={3} className="p-0 border-l border-[hsl(var(--border))]">
                      {/* Plano de chão sem corte: é a instrução de montagem do salão, lida
                          inteira antes do serviço. Cortar em 3 linhas escondia justamente
                          o que a operação precisa. */}
                      <CelulaTexto valor={(d[lt.campo] as string) || ''} multilinha disabled={soLeitura}
                        expandido={briefingAberto} clamp="none"
                        onSalvar={(v) => salvarDia(d, d.data, d.turno, lt.campo as string, v)} />
                    </td>
                  ))}
                </tr>
              ))}

              {/* ---- cabeçalho das 4 sub-colunas, como na planilha ---- */}
              {/* Os rotulos da planilha ("TOTAL / FIXOS") liam como erro: "total 2 mas fixos 3?".
                  O sentido real e uma frase — precisa de 2, tem 3 na escala, logo 0 freelas. */}
              <tr className="border-b border-[hsl(var(--border))] bg-muted/40 text-[10px] text-muted-foreground">
                <td className="px-2 py-0.5 sticky left-0 bg-muted/40 z-10">&nbsp;</td>
                {dias.map(d => (
                  <Fragment key={d.id}>
                    <td className="px-1 py-1 text-center border-l border-[hsl(var(--border))]" title="Quantos a operação precisa: pico ÷ nível de serviço">Precisa</td>
                    <td className="px-1 py-1 text-center" title="Quantos já estão escalados (vem da Escala)">Escala</td>
                    <td className="px-1 py-1 text-center font-semibold" title="Quanto falta contratar — é o que custa. O valor em R$ está no Custo Proj do Dia e no resumo.">Freelas</td>
                  </Fragment>
                ))}
              </tr>

              {/* ---- funções de operação + Headcount Ops ---- */}
              {funcoesOps.map(f => (
                <tr key={f.id} className="border-b border-[hsl(var(--border))] hover:bg-muted/30">
                  <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-[11px]">{f.nome}</td>
                  {dias.map(d => <CelulasFuncao key={d.id} dia={d} funcao={f} linha={linhaDe(d, f.id)}
                    soLeitura={soLeitura} onSalvar={salvarFuncao} />)}
                </tr>
              ))}
              <LinhaHeadcount rotulo="Headcount Ops" dias={dias} funcoes={funcoesOps} linhaDe={linhaDe} />

              {/* ---- segurança + Headcount Seg ---- */}
              {funcoesSeg.map(f => (
                <tr key={f.id} className="border-b border-[hsl(var(--border))] hover:bg-muted/30">
                  <td className="px-2 py-1 sticky left-0 bg-[hsl(var(--card))] z-10 text-[11px]">{f.nome}</td>
                  {dias.map(d => <CelulasFuncao key={d.id} dia={d} funcao={f} linha={linhaDe(d, f.id)}
                    soLeitura={soLeitura} onSalvar={salvarFuncao} />)}
                </tr>
              ))}
              <LinhaHeadcount rotulo="Headcount Seg" dias={dias} funcoes={funcoesSeg} linhaDe={linhaDe} />

              {/* ---- custo do dia ---- */}
              <tr className="border-t-2 border-[hsl(var(--border))] font-semibold bg-muted/40">
                <td className="px-2 py-1.5 sticky left-0 bg-muted/40 z-10 text-[11px]">Custo Proj do Dia</td>
                {dias.map(d => (
                  <td key={d.id} colSpan={3} className="px-1 py-1.5 text-center tabular-nums border-l border-[hsl(var(--border))] text-[11px]">
                    {fmtBRL(d.custo_dia)}
                  </td>
                ))}
              </tr>

            </tbody>
          </table>
        </CardContent></Card>
      )}

      {/* RESUMO — mesmos campos do bloco da planilha. O CMO% é (freela + fixo) / faturamento;
          sem a folha CLT o percentual dava ~4% e o teto nunca disparava. Semana e mês usam
          a MESMA régua desde 13/08/2026: a folha do mês rateada pelos dias do período. */}
      {resumo && (
        <Card><CardContent className="py-3">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-6">
            <div>
              <div className="text-xs font-semibold mb-2">
                {visao === 'semana' ? 'RESUMO SEMANAL' : 'RESUMO MENSAL'}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="py-1.5 text-muted-foreground">Custo de Freelas</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{fmtBRL(resumo.custo_freelas)}</td>
                  </tr>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="py-1.5 text-muted-foreground" title={ORIGEM_FOLHA[resumo.cmo_fixo_origem]?.ajuda}>
                      CMO Fixo
                      <span className="ml-1 text-[10px]">rateado</span>
                      {/* Quem olha um CMO precisa saber se a folha já foi paga ou é projeção */}
                      <span className={`ml-1.5 text-[10px] rounded px-1 py-0.5 ${ORIGEM_FOLHA[resumo.cmo_fixo_origem]?.cor}`}>
                        {ORIGEM_FOLHA[resumo.cmo_fixo_origem]?.rotulo}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{fmtBRL(resumo.cmo_fixo)}</td>
                  </tr>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="py-1.5 text-muted-foreground">Público Proj</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{fmtNum(resumo.publico_proj)}</td>
                  </tr>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="py-1.5 text-muted-foreground">Fat Proj</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{fmtBRL(resumo.fat_proj)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-medium">CMO% Proj</td>
                    <td className={`py-1.5 text-right tabular-nums font-bold text-base
                      ${resumo.cmo_pct != null && resumo.cmo_pct > resumo.limite_cmo_pct ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {resumo.cmo_pct == null ? '—' : `${resumo.cmo_pct.toFixed(2)}%`}
                    </td>
                  </tr>
                </tbody>
              </table>
              {resumo.cmo_pct != null && resumo.cmo_pct > resumo.limite_cmo_pct && (
                <p className="mt-1.5 text-[11px] text-rose-600">
                  Acima do teto de {resumo.limite_cmo_pct}%.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground border-b border-[hsl(var(--border))]">
                      <th className="text-left font-normal py-1">FUNÇÃO</th>
                      <th className="text-right font-normal py-1">QTDE</th>
                      <th className="text-right font-normal py-1">CUSTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.por_funcao.map(f => (
                      <tr key={f.label} className="border-b border-[hsl(var(--border))] last:border-0">
                        <td className="py-1">{f.label}</td>
                        <td className="py-1 text-right tabular-nums text-muted-foreground">{fmtNum(f.qtde)}</td>
                        <td className="py-1 text-right tabular-nums">{fmtBRL(f.custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* No mês, a quebra por semana substitui a grade diária — 31 dias x 4 colunas
                  ficavam ilegíveis. `dias_no_periodo` marca a semana que entra parcial. */}
              {visao === 'mes' && resumo.semanas.length > 0 && (
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">POR SEMANA</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {resumo.semanas.map(s => (
                        <tr key={s.inicio} className="border-b border-[hsl(var(--border))] last:border-0">
                          <td className="py-1 whitespace-nowrap">
                            {s.inicio.slice(8)}/{s.inicio.slice(5, 7)}–{s.fim.slice(8)}/{s.fim.slice(5, 7)}
                            {s.parcial && (
                              <span className="ml-1 text-[10px] text-muted-foreground"
                                title={`Só ${s.dias_no_periodo} dia(s) desta semana caem no mês — o CMO Fixo entra rateado`}>
                                ({s.dias_no_periodo}d)
                              </span>
                            )}
                          </td>
                          <td className="py-1 text-right tabular-nums">{fmtBRL(s.custo)}</td>
                          <td className={`py-1 text-right tabular-nums w-16 ${s.cmo_pct != null && s.cmo_pct > resumo.limite_cmo_pct ? 'text-rose-600 font-semibold' : 'text-muted-foreground'}`}>
                            {s.cmo_pct == null ? '—' : `${s.cmo_pct.toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
        <b>Precisa</b> = pico ÷ nível de serviço · <b>Escala</b> = quem já está escalado (vem da tela
        de Escala) · <b>Freelas</b> = o que falta contratar, e é o único que gera custo.
        <br />
        <span className="inline-block w-3 h-3 rounded-sm align-middle bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 mr-1" />
        calculado ·
        <span className="inline-block w-3 h-3 rounded-sm align-middle bg-amber-50 dark:bg-amber-900/20 border border-amber-300 mx-1" />
        calculado com ajuste manual · sem cor = digitado. Sob cada total, <b>fixos/freelas</b> —
        os fixos vêm da Escala. Apagar o valor de uma célula ajustada devolve ela ao automático.
      </p>
    </PageShell>
  );
}
