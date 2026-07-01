'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DreRow {
  bar_id: number;
  mes: string;
  categoria_macro: string;
  ordem_macro: number;
  ordem_sub: number;
  categoria: string;
  sinal: number;
  valor_com_sinal: number;
  percentual_receita: number | null;
}

interface Props {
  barId: number;
  anoInicial?: number;
  // Quando fornecido, as células de mês das sub-linhas viram clicáveis (drill-down).
  onDrill?: (p: { categoria_macro: string; canon: string; mes: number; ano: number; label: string }) => void;
}

const MACRO_ORDEM = [
  'Receita',
  'Custos Variáveis',
  'Custo insumos (CMV)',
  'Mão-de-Obra',
  'Despesas Comerciais',
  'Despesas Administrativas',
  'Despesas Operacionais',
  'Despesas de Ocupação (Contas)',
  'Não Operacionais',
];

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtBRL = (n: number) => {
  const v = Math.abs(n);
  const neg = n < 0;
  const str = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? `-R$ ${str}` : `R$ ${str}`;
};

// Subgrupos intermediários dentro de um macro (nível extra entre macro e subcategoria).
// Hoje só a Mão-de-Obra: separa o CMO fixo dos freelas. Quem não cair em nenhum subgrupo
// (ex.: PRO LABORE) vira linha solta direto no macro, na ordem_sub original.
const CMO_FIXO = new Set([
  'SALARIO FUNCIONARIOS', 'PROVISÃO TRABALHISTA', 'VALE TRANSPORTE', 'ADICIONAIS', 'ALIMENTAÇÃO',
]);
const SUBGRUPOS_POR_MACRO: Record<string, { nome: string; inclui: (cat: string) => boolean }[]> = {
  'Mão-de-Obra': [
    { nome: 'CMO Fixo', inclui: (c) => CMO_FIXO.has(c) },
    { nome: 'CMO Freelas', inclui: (c) => c.startsWith('FREELA') },
  ],
};

// Linha pronta pra render (header de macro, subgrupo OU subcategoria).
interface LinhaRender {
  tipo: 'macro' | 'subgrupo' | 'sub';
  grupo: string;            // macro ao qual pertence (react key)
  macro: string;            // categoria_macro p/ drill-down
  colapsoKey?: string;      // chave que esta linha (colapsável) abre/fecha
  ancestrais: string[];     // chaves de colapso que, se fechadas, escondem esta linha
  nivel?: number;           // 0 macro, 1 subgrupo/sub-solta, 2 sub dentro de subgrupo
  colapsavel: boolean;      // header colapsável (macro/subgrupo com filhos)
  label: string;
  label2?: string;
  valores: number[];        // 12 valores
  percentuais: (number | null)[];
  ytd: number;
  ytdPct: number | null;
  cor?: string;
  destaque?: boolean;
  secao?: 'resultado' | 'investimento';
  parcial?: boolean;        // resultado parcial (Margem de Contribuição / Lucro Operacional)
}

export function DreTab({ barId, anoInicial, onDrill }: Props) {
  const { toast } = useToast();
  const anoAtualSistema = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoInicial ?? anoAtualSistema);
  const [linhas, setLinhas] = useState<DreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  // Macros colapsados (mostra só a linha TOTAL). Default: tudo expandido.
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  // Linha destacada ao clicar (facilita acompanhar a linha pelas 12 colunas).
  const [linhaSelecionada, setLinhaSelecionada] = useState<number | null>(null);

  // Só lê a DRE (view financial.dre_excel agrega o bronze direto).
  const lerDre = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}&ano=${ano}`, { cache: 'no-store' });
      const j = await r.json();
      setLinhas((j?.linhas || []).map((l: any) => ({
        ...l,
        valor_com_sinal: Number(l.valor_com_sinal),
        percentual_receita: l.percentual_receita == null ? null : Number(l.percentual_receita),
      })));
    } finally { setLoading(false); }
  };

  // Sincronizar com o Conta Azul + reler a DRE.
  // - 'rapido' (padrão, ~5-15s): incremental por data_alteracao. Pega edições de valor
  //   (ex.: ajustar imposto), que é o dia a dia. O cron diário cobre o resto.
  // - 'completo' (~1-2min): re-puxa o ano inteiro mês a mês. Só necessário quando mexeram
  //   SÓ na categoria no CA (re-categorização não bumpa data_alteracao). A DRE lê o bronze direto.
  const sincronizar = async (modo: 'rapido' | 'completo') => {
    setSincronizando(true);
    try {
      const body = modo === 'completo'
        ? { bar_id: barId, sync_mode: 'alteracao_full_ano', ano }
        : { bar_id: barId, sync_mode: 'alteracao_incremental' };
      const resp = await fetch('/api/contaazul/sync-manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.success) {
        toast({ title: 'Falha ao sincronizar Conta Azul', description: j?.error || 'Erro', variant: 'destructive' });
      } else {
        const n = j?.stats?.lancamentos ?? 0;
        toast({ title: 'Conta Azul sincronizado', description: `${n} lançamento(s) atualizado(s)${j?.duration_seconds ? ` em ${j.duration_seconds}s` : ''}` });
      }
    } catch (e) {
      toast({ title: 'Erro de rede', description: e instanceof Error ? e.message : 'Erro', variant: 'destructive' });
    } finally {
      setSincronizando(false);
      await lerDre();
    }
  };

  useEffect(() => { lerDre(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [barId, ano]);

  const toggleMacro = (nome: string) => {
    setColapsados(prev => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome); else next.add(nome);
      return next;
    });
  };

  const dados = useMemo(() => {
    // YTD soma SÓ meses fechados: um mês i (0=Jan) fecha no dia 15 do mês seguinte.
    // Ex: hoje 15/06 -> fechados Jan..Mai; Jun fecha em 15/07. Atualiza sozinho.
    const hojeDre = new Date();
    const anoDre = ano; // ano selecionado (anos passados: todos os meses fechados)
    const mesFechado = (i: number) => hojeDre >= new Date(anoDre, i + 1, 15);
    const somaFechados = (vals: number[]) => vals.reduce((s, v, i) => s + (mesFechado(i) ? v : 0), 0);

    // Agrupa por macro → sub → mes
    const macroMap = new Map<string, Map<string, Map<number, DreRow>>>();
    for (const l of linhas) {
      const mes = new Date(l.mes + 'T00:00:00').getMonth(); // 0-11
      if (!macroMap.has(l.categoria_macro)) macroMap.set(l.categoria_macro, new Map());
      const subMap = macroMap.get(l.categoria_macro)!;
      if (!subMap.has(l.categoria)) subMap.set(l.categoria, new Map());
      subMap.get(l.categoria)!.set(mes, l);
    }

    // Receita total por mês (pra calcular % das outras macros)
    const receitaTotalMes: number[] = Array(12).fill(0);
    const subRec = macroMap.get('Receita');
    if (subRec) {
      for (const [, mesMap] of subRec) {
        for (const [mes, row] of mesMap) {
          receitaTotalMes[mes] += row.valor_com_sinal;
        }
      }
    }
    const receitaYTD = somaFechados(receitaTotalMes);

    const out: LinhaRender[] = [];

    // Soma os valores (com sinal) de várias macros, por mês.
    const somaMacros = (nomes: string[]): number[] => {
      const acc = Array(12).fill(0);
      for (const nome of nomes) {
        const subMap = macroMap.get(nome);
        if (!subMap) continue;
        for (const [, mesMap] of subMap) {
          for (const [mes, row] of mesMap) acc[mes] += row.valor_com_sinal;
        }
      }
      return acc;
    };

    // Linha de resultado parcial (Margem de Contribuição, Lucro Operacional, Lucro Líquido).
    const pushSubtotal = (label: string, macros: string[], opts: { parcial?: boolean; forte?: boolean }) => {
      const valores = somaMacros(macros);
      const ytd = somaFechados(valores);
      const pct = valores.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);
      out.push({
        tipo: 'macro',
        grupo: '__subtotal__',
        macro: '',
        ancestrais: [],
        nivel: 0,
        colapsavel: false,
        label,
        label2: '',
        valores,
        percentuais: pct,
        ytd,
        ytdPct: receitaYTD > 0 ? (ytd / receitaYTD * 100) : null,
        destaque: true,
        secao: 'resultado',
        parcial: opts.parcial,
        cor: opts.forte
          ? (ytd < 0 ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold')
          : (ytd < 0 ? 'text-red-700' : 'text-slate-800 dark:text-slate-200'),
      });
    };

    const pushMacroComSubs = (macroNome: string, secao: 'resultado' | 'investimento', corMacro?: string) => {
      const subMap = macroMap.get(macroNome);
      if (!subMap) return;

      // Subcategorias na ordem manual da planilha (ordem_sub do de-para).
      const subs = Array.from(subMap.entries()).sort((a, b) => {
        const oa = Array.from(a[1].values())[0]?.ordem_sub ?? 99;
        const ob = Array.from(b[1].values())[0]?.ordem_sub ?? 99;
        return oa - ob;
      });

      // Linha TOTAL do macro
      const valoresMacro: number[] = Array(12).fill(0);
      for (const [, mesMap] of subMap) {
        for (const [mes, row] of mesMap) valoresMacro[mes] += row.valor_com_sinal;
      }
      const ytdMacro = somaFechados(valoresMacro);
      const pctMacroPorMes = valoresMacro.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);

      out.push({
        tipo: 'macro',
        grupo: macroNome,
        macro: macroNome,
        colapsoKey: macroNome,
        ancestrais: [],
        nivel: 0,
        colapsavel: subs.length > 0,
        label: macroNome,
        label2: 'TOTAL',
        valores: valoresMacro,
        percentuais: secao === 'investimento' ? valoresMacro.map(() => null) : pctMacroPorMes,
        ytd: ytdMacro,
        ytdPct: secao === 'investimento' ? null : (receitaYTD > 0 ? (ytdMacro / receitaYTD * 100) : null),
        destaque: true,
        secao,
        cor: corMacro ?? (macroNome === 'Receita' ? 'text-emerald-700' : 'text-gray-900 dark:text-gray-100'),
      });

      type Sub = [string, Map<number, DreRow>];

      // Emite uma linha de subcategoria (folha).
      const pushSub = (subNome: string, mesMap: Map<number, DreRow>, ancestrais: string[], nivel: number) => {
        const valoresSub: number[] = Array(12).fill(0);
        for (const [mes, row] of mesMap) valoresSub[mes] = row.valor_com_sinal;
        const ytdSub = somaFechados(valoresSub);
        const pctSub = valoresSub.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);
        out.push({
          tipo: 'sub',
          grupo: macroNome,
          macro: macroNome,
          ancestrais,
          nivel,
          colapsavel: false,
          label: '',
          label2: subNome,
          valores: valoresSub,
          percentuais: secao === 'investimento' ? valoresSub.map(() => null) : pctSub,
          ytd: ytdSub,
          ytdPct: secao === 'investimento' ? null : (receitaYTD > 0 ? (ytdSub / receitaYTD * 100) : null),
          secao,
        });
      };

      // Emite o header (subtotal) de um subgrupo + suas subcategorias abaixo.
      const pushSubgrupo = (nome: string, membros: Sub[]) => {
        const key = `${macroNome} :: ${nome}`;
        const valores: number[] = Array(12).fill(0);
        for (const [, mesMap] of membros) {
          for (const [mes, row] of mesMap) valores[mes] += row.valor_com_sinal;
        }
        const ytd = somaFechados(valores);
        const pct = valores.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);
        out.push({
          tipo: 'subgrupo',
          grupo: macroNome,
          macro: macroNome,
          colapsoKey: key,
          ancestrais: [macroNome],
          nivel: 1,
          colapsavel: membros.length > 0,
          label: '',
          label2: nome,
          valores,
          percentuais: secao === 'investimento' ? valores.map(() => null) : pct,
          ytd,
          ytdPct: secao === 'investimento' ? null : (receitaYTD > 0 ? (ytd / receitaYTD * 100) : null),
          secao,
        });
        for (const [subNome, mesMap] of membros) pushSub(subNome, mesMap, [macroNome, key], 2);
      };

      const subgruposCfg = SUBGRUPOS_POR_MACRO[macroNome];
      if (subgruposCfg) {
        // Cada subcategoria entra no 1º subgrupo que a inclui; o resto vira linha solta.
        const usados = new Set<string>();
        for (const cfg of subgruposCfg) {
          const membros = subs.filter(([n]) => cfg.inclui(n));
          membros.forEach(([n]) => usados.add(n));
          if (membros.length > 0) pushSubgrupo(cfg.nome, membros);
        }
        for (const [subNome, mesMap] of subs) {
          if (!usados.has(subNome)) pushSub(subNome, mesMap, [macroNome], 1);
        }
      } else {
        for (const [subNome, mesMap] of subs) pushSub(subNome, mesMap, [macroNome], 1);
      }
    };

    // Estrutura em blocos com resultados parciais:
    //   Receita − Variáveis − CMV                              = Margem de Contribuição
    //   Margem − MãoObra − Comercial − Admin − Operac − Ocup   = Lucro Operacional
    //   Lucro Operacional + Não Operacionais                   = Lucro Líquido
    const MACROS_MARGEM = ['Receita', 'Custos Variáveis', 'Custo insumos (CMV)'];
    const MACROS_OPERACIONAL = [
      'Mão-de-Obra',
      'Despesas Comerciais',
      'Despesas Administrativas',
      'Despesas Operacionais',
      'Despesas de Ocupação (Contas)',
    ];

    for (const m of MACROS_MARGEM) pushMacroComSubs(m, 'resultado');
    pushSubtotal('Margem de Contribuição', MACROS_MARGEM, { parcial: true });

    for (const m of MACROS_OPERACIONAL) pushMacroComSubs(m, 'resultado');
    pushSubtotal('Lucro Operacional', [...MACROS_MARGEM, ...MACROS_OPERACIONAL], { parcial: true });

    pushMacroComSubs('Não Operacionais', 'resultado');
    pushSubtotal('Lucro Líquido', [...MACROS_MARGEM, ...MACROS_OPERACIONAL, 'Não Operacionais'], { forte: true });

    // Investimentos: bloco à parte, fora do resultado
    pushMacroComSubs('Investimentos', 'investimento', 'text-blue-700');

    // Dividendos: linha ÚNICA (solitária) após Investimentos.
    const subMapDiv = macroMap.get('Dividendos');
    if (subMapDiv) {
      const valoresDiv: number[] = Array(12).fill(0);
      for (const [, mesMap] of subMapDiv) {
        for (const [mes, row] of mesMap) valoresDiv[mes] += row.valor_com_sinal;
      }
      out.push({
        tipo: 'macro',
        grupo: 'Dividendos',
        macro: 'Dividendos',
        ancestrais: [],
        nivel: 0,
        colapsavel: false,
        label: 'Dividendos',
        label2: '',
        valores: valoresDiv,
        percentuais: valoresDiv.map(() => null),
        ytd: somaFechados(valoresDiv),
        ytdPct: null,
        secao: 'investimento',
        cor: 'text-purple-700',
      });
    }

    return { rows: out, receitaTotalMes, receitaYTD };
  }, [linhas, ano]);

  // Aplica colapso: uma linha some se qualquer um dos seus ancestrais estiver fechado
  // (macro colapsado esconde subgrupos e subs; subgrupo colapsado esconde só suas subs).
  const linhasVisiveis = useMemo(
    () => dados.rows.filter(r => r.ancestrais.every(a => !colapsados.has(a))),
    [dados.rows, colapsados]
  );

  const chavesColapsaveis = useMemo(
    () => dados.rows.filter(r => r.colapsavel && r.colapsoKey).map(r => r.colapsoKey!),
    [dados.rows]
  );

  // Default: entra com TUDO recolhido (só no 1º load — depois respeita o que o
  // usuário abrir/fechar, mesmo após "Atualizar").
  const colapsoInicialRef = useRef(false);
  useEffect(() => {
    if (!colapsoInicialRef.current && chavesColapsaveis.length > 0) {
      setColapsados(new Set(chavesColapsaveis));
      colapsoInicialRef.current = true;
    }
  }, [chavesColapsaveis]);

  const temMacrosColapsaveis = chavesColapsaveis.length > 0;
  const todosColapsados = chavesColapsaveis.every(k => colapsados.has(k));
  const toggleTodos = () => {
    setColapsados(todosColapsados ? new Set() : new Set(chavesColapsaveis));
  };

  if (loading) return <div className="p-4"><Skeleton className="h-96 w-full" /></div>;

  const COLSPAN_TOTAL = 1 + 12 * 2 + 2; // label (1 col) + (valor,%)×12 + YTD(valor,%)

  return (
    <div className="p-4 space-y-4">
      {/* No mobile: empilha (título full-width, descrição some, botões embaixo com wrap p/ nenhum sair da tela) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-base font-bold px-2 shrink-0"
            title="Ano da DRE"
          >
            {Array.from({ length: anoAtualSistema - 2023 }, (_, i) => anoAtualSistema - i).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold leading-tight">DRE {ano} — Demonstrativo de Resultados</h2>
            <p className="hidden lg:block text-xs text-muted-foreground">
              Dados ContaAzul agregados por competência. Estrutura espelha planilha &ldquo;[Ordinário] DRE e DFC&rdquo;.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {temMacrosColapsaveis && (
            <Button onClick={toggleTodos} variant="outline" size="sm" className="gap-1">
              {todosColapsados ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {todosColapsados ? 'Expandir tudo' : 'Recolher tudo'}
            </Button>
          )}
          <Button onClick={() => sincronizar('rapido')} disabled={sincronizando || loading} variant="outline" size="sm" className="gap-1" title="Sincroniza as alterações recentes do Conta Azul (rápido)">
            <RefreshCw className={`w-3 h-3 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando…' : 'Atualizar'}
          </Button>
          <button onClick={() => sincronizar('completo')} disabled={sincronizando || loading}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50 whitespace-nowrap"
            title="Re-puxa o ano inteiro. Use só se mexeram na CATEGORIA de um lançamento no Conta Azul (mais lento ~1-2min).">
            sincronizar ano completo
          </button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] uppercase">
            <tr>
              <th className="text-left py-2 px-2 sticky left-0 top-0 bg-gray-100 dark:bg-gray-800 min-w-[240px] z-30">Categoria</th>
              {MES_LABEL.map((m, i) => (
                // Label do mês fica alinhado à direita sobre a coluna de VALOR (não a de %),
                // ficando exatamente sobre o total da coluna.
                <Fragment key={i}>
                  <th className="text-right py-2 px-2 min-w-[110px] sticky top-0 z-20 bg-gray-100 dark:bg-gray-800">{m}/{String(ano).slice(2)}</th>
                  <th className="py-2 px-1 min-w-[44px] sticky top-0 z-20 bg-gray-100 dark:bg-gray-800" aria-hidden />
                </Fragment>
              ))}
              <th className="text-right py-2 px-2 bg-gray-200 dark:bg-gray-700 min-w-[120px] sticky top-0 z-20" title="Soma só dos meses fechados (cada mês fecha no dia 15 do mês seguinte)">YTD {ano}</th>
              <th className="py-2 px-1 bg-gray-200 dark:bg-gray-700 min-w-[44px] sticky top-0 z-20" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((row, idx) => {
              const colapsado = !!row.colapsoKey && colapsados.has(row.colapsoKey);
              // Espaço antes do primeiro bloco de Investimentos pra separá-lo do resultado.
              const primeiraInvest = row.secao === 'investimento'
                && (idx === 0 || linhasVisiveis[idx - 1].secao !== 'investimento');
              return (
                <Fragment key={`${row.grupo}-${row.label2 ?? ''}-${idx}`}>
                  {primeiraInvest && (
                    <tr aria-hidden>
                      <td colSpan={COLSPAN_TOTAL} className="h-6 bg-white dark:bg-gray-950 border-0" />
                    </tr>
                  )}
                  <tr
                    className={`border-b cursor-pointer ${
                      row.label === 'Lucro Líquido'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-t-4 border-emerald-300 dark:border-emerald-700 text-sm font-bold'
                        : row.parcial
                          ? 'bg-slate-100 dark:bg-slate-800/60 border-t-2 border-slate-300 dark:border-slate-600 font-bold'
                          : row.secao === 'investimento' && row.tipo === 'macro'
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 border-t border-blue-200 dark:border-blue-800 font-semibold'
                            : row.tipo === 'subgrupo'
                              ? 'bg-slate-50 dark:bg-slate-900/40 font-semibold'
                              : row.destaque
                                ? 'bg-gray-50 dark:bg-gray-900/40 font-semibold'
                                : ''
                    } ${row.colapsavel ? 'hover:bg-gray-100 dark:hover:bg-gray-800/60' : ''} ${
                      linhaSelecionada === idx ? '[&>td]:!bg-amber-100 dark:[&>td]:!bg-amber-900/30' : ''
                    }`}
                    onClick={() => {
                      setLinhaSelecionada(prev => (prev === idx ? null : idx));
                      if (row.colapsavel && row.colapsoKey) toggleMacro(row.colapsoKey);
                    }}
                  >
                    <td className={`py-1.5 px-2 sticky left-0 z-10 ${
                      row.label === 'Lucro Líquido'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold'
                        : row.parcial
                          ? 'bg-slate-100 dark:bg-slate-800/60 font-bold'
                          : row.secao === 'investimento' && row.tipo === 'macro'
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 font-bold'
                            : row.tipo === 'subgrupo'
                              ? 'bg-slate-50 dark:bg-slate-900/40 font-bold'
                              : row.destaque ? 'bg-gray-50 dark:bg-gray-900/40 font-bold' : 'bg-white dark:bg-gray-950'
                    } ${row.cor ?? ''}`}>
                      {/* Coluna única de categoria: macro em negrito quando colapsado; ao expandir,
                          subgrupos/subs descem indentados por nível (0 macro · 1 sub/subgrupo · 2 sub). */}
                      <span className="inline-flex items-center gap-1" style={{ paddingLeft: `${(row.nivel ?? 0) * 0.9}rem` }}>
                        {row.colapsavel
                          ? (colapsado ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />)
                          : <span className="w-3 shrink-0" aria-hidden />}
                        {row.label || row.label2}
                      </span>
                    </td>
                    {row.valores.map((v, i) => {
                      const drillable = !!onDrill && row.tipo === 'sub' && !!row.label2 && v !== 0;
                      return (
                      <Fragment key={i}>
                        <td
                          className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${v < 0 ? 'text-red-600' : v > 0 && row.label === 'Receita' ? 'text-emerald-600' : ''} ${drillable ? 'cursor-pointer hover:underline hover:bg-amber-50 dark:hover:bg-amber-900/20' : ''}`}
                          onClick={drillable ? (e) => {
                            e.stopPropagation();
                            onDrill!({ categoria_macro: row.macro, canon: row.label2 as string, mes: i + 1, ano, label: `${row.label2} — ${MES_LABEL[i]}/${ano}` });
                          } : undefined}
                          title={drillable ? 'Ver lançamentos' : undefined}
                        >
                          {v !== 0 ? fmtBRL(v) : '—'}
                        </td>
                        <td className="py-1.5 px-1 text-right tabular-nums text-[10px] text-muted-foreground">
                          {row.percentuais[i] != null && v !== 0 ? `${row.percentuais[i]!.toFixed(1)}%` : ''}
                        </td>
                      </Fragment>
                      );
                    })}
                    <td className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap bg-gray-100 dark:bg-gray-800 ${row.ytd < 0 ? 'text-red-600 font-bold' : 'font-bold'}`}>
                      {fmtBRL(row.ytd)}
                    </td>
                    <td className="py-1.5 px-1 text-right text-[10px] bg-gray-100 dark:bg-gray-800 text-muted-foreground">
                      {row.ytdPct != null ? `${row.ytdPct.toFixed(1)}%` : ''}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
