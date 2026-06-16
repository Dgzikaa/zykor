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

interface Props { barId: number; }

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

// Linha pronta pra render (header de macro OU subcategoria).
interface LinhaRender {
  tipo: 'macro' | 'sub';
  grupo: string;            // chave de colapso (macro ao qual pertence)
  colapsavel: boolean;      // header de macro com subs
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

export function DreTab({ barId }: Props) {
  const { toast } = useToast();
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
      const r = await fetch(`/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}`);
      const j = await r.json();
      setLinhas((j?.linhas || []).map((l: any) => ({
        ...l,
        valor_com_sinal: Number(l.valor_com_sinal),
        percentual_receita: l.percentual_receita == null ? null : Number(l.percentual_receita),
      })));
    } finally { setLoading(false); }
  };

  // Botão "Atualizar": sincroniza o que mudou no Conta Azul (modo incremental por
  // data_alteracao — rápido, só o delta recente) e relê a DRE. A DRE lê o bronze
  // direto, então assim que o sync grava, o número já reflete.
  const sincronizarELer = async () => {
    setSincronizando(true);
    try {
      const resp = await fetch('/api/contaazul/sync-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, sync_mode: 'alteracao_incremental' }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.success) {
        toast({ title: 'Falha ao sincronizar Conta Azul', description: j?.error || 'Erro', variant: 'destructive' });
      } else {
        const n = j?.stats?.lancamentos ?? 0;
        toast({ title: 'Conta Azul sincronizado', description: `${n} lançamento(s) atualizado(s) em ${j?.duration_seconds ?? '?'}s` });
      }
    } catch (e) {
      toast({ title: 'Erro de rede', description: e instanceof Error ? e.message : 'Erro', variant: 'destructive' });
    } finally {
      setSincronizando(false);
      await lerDre();
    }
  };

  useEffect(() => { lerDre(); }, [barId]);

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
    const anoDre = hojeDre.getFullYear();
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

      for (const [subNome, mesMap] of subs) {
        const valoresSub: number[] = Array(12).fill(0);
        for (const [mes, row] of mesMap) valoresSub[mes] = row.valor_com_sinal;
        const ytdSub = somaFechados(valoresSub);
        const pctSub = valoresSub.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);
        out.push({
          tipo: 'sub',
          grupo: macroNome,
          colapsavel: false,
          label: '',
          label2: subNome,
          valores: valoresSub,
          percentuais: secao === 'investimento' ? valoresSub.map(() => null) : pctSub,
          ytd: ytdSub,
          ytdPct: secao === 'investimento' ? null : (receitaYTD > 0 ? (ytdSub / receitaYTD * 100) : null),
          secao,
        });
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
  }, [linhas]);

  // Aplica colapso: esconde subs de macros colapsados (macros sempre visíveis).
  const linhasVisiveis = useMemo(
    () => dados.rows.filter(r => r.tipo === 'macro' || !colapsados.has(r.grupo)),
    [dados.rows, colapsados]
  );

  // Default: entra com TODOS os macros recolhidos (só no 1º load — depois respeita
  // o que o usuário abrir/fechar, mesmo após "Atualizar").
  const colapsoInicialRef = useRef(false);
  useEffect(() => {
    if (!colapsoInicialRef.current && dados.rows.some(r => r.colapsavel)) {
      setColapsados(new Set(dados.rows.filter(r => r.colapsavel).map(r => r.grupo)));
      colapsoInicialRef.current = true;
    }
  }, [dados.rows]);

  const temMacrosColapsaveis = dados.rows.some(r => r.colapsavel);
  const todosColapsados = dados.rows.filter(r => r.colapsavel).every(r => colapsados.has(r.grupo));
  const toggleTodos = () => {
    if (todosColapsados) {
      setColapsados(new Set());
    } else {
      setColapsados(new Set(dados.rows.filter(r => r.colapsavel).map(r => r.grupo)));
    }
  };

  if (loading) return <div className="p-4"><Skeleton className="h-96 w-full" /></div>;

  const COLSPAN_TOTAL = 2 + 12 * 2 + 2; // labels + (valor,%)×12 + YTD(valor,%)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">DRE — Demonstrativo de Resultados</h2>
          <p className="text-xs text-muted-foreground">
            Dados ContaAzul agregados por competência. Estrutura espelha planilha &ldquo;[Ordinário] DRE e DFC&rdquo;.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {temMacrosColapsaveis && (
            <Button onClick={toggleTodos} variant="outline" size="sm" className="gap-1">
              {todosColapsados ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {todosColapsados ? 'Expandir tudo' : 'Recolher tudo'}
            </Button>
          )}
          <Button onClick={sincronizarELer} disabled={sincronizando || loading} variant="outline" size="sm" className="gap-1">
            <RefreshCw className={`w-3 h-3 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando…' : 'Atualizar'}
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] uppercase">
            <tr>
              <th className="text-left py-2 px-2 sticky left-0 top-0 bg-gray-100 dark:bg-gray-800 min-w-[180px] z-30">Categ MACRO</th>
              <th className="text-left py-2 px-2 sticky left-[180px] top-0 bg-gray-100 dark:bg-gray-800 min-w-[200px] z-30">Categoria</th>
              {MES_LABEL.map((m, i) => (
                // Label do mês fica alinhado à direita sobre a coluna de VALOR (não a de %),
                // ficando exatamente sobre o total da coluna.
                <Fragment key={i}>
                  <th className="text-right py-2 px-2 min-w-[110px] sticky top-0 z-20 bg-gray-100 dark:bg-gray-800">{m}/26</th>
                  <th className="py-2 px-1 min-w-[44px] sticky top-0 z-20 bg-gray-100 dark:bg-gray-800" aria-hidden />
                </Fragment>
              ))}
              <th className="text-right py-2 px-2 bg-gray-200 dark:bg-gray-700 min-w-[120px] sticky top-0 z-20" title="Soma só dos meses fechados (cada mês fecha no dia 15 do mês seguinte)">YTD (fech.)</th>
              <th className="py-2 px-1 bg-gray-200 dark:bg-gray-700 min-w-[44px] sticky top-0 z-20" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((row, idx) => {
              const colapsado = colapsados.has(row.grupo);
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
                            : row.destaque
                              ? 'bg-gray-50 dark:bg-gray-900/40 font-semibold'
                              : ''
                    } ${row.colapsavel ? 'hover:bg-gray-100 dark:hover:bg-gray-800/60' : ''} ${
                      linhaSelecionada === idx ? '[&>td]:!bg-amber-100 dark:[&>td]:!bg-amber-900/30' : ''
                    }`}
                    onClick={() => {
                      setLinhaSelecionada(prev => (prev === idx ? null : idx));
                      if (row.colapsavel) toggleMacro(row.grupo);
                    }}
                  >
                    <td className={`py-1.5 px-2 sticky left-0 z-10 ${
                      row.label === 'Lucro Líquido'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold'
                        : row.parcial
                          ? 'bg-slate-100 dark:bg-slate-800/60 font-bold'
                          : row.secao === 'investimento' && row.tipo === 'macro'
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 font-bold'
                            : row.destaque ? 'bg-gray-50 dark:bg-gray-900/40 font-bold' : 'bg-white dark:bg-gray-950'
                    } ${row.cor ?? ''}`}>
                      <span className="inline-flex items-center gap-1">
                        {row.colapsavel && (
                          colapsado ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />
                        )}
                        {row.label}
                      </span>
                    </td>
                    <td className={`py-1.5 px-2 sticky left-[180px] z-10 ${
                      row.label === 'Lucro Líquido'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40'
                        : row.parcial
                          ? 'bg-slate-100 dark:bg-slate-800/60'
                          : row.secao === 'investimento' && row.tipo === 'macro'
                            ? 'bg-blue-50/60 dark:bg-blue-950/30'
                            : row.destaque ? 'bg-gray-50 dark:bg-gray-900/40' : 'bg-white dark:bg-gray-950'
                    }`}>
                      {row.label2}
                    </td>
                    {row.valores.map((v, i) => (
                      <Fragment key={i}>
                        <td className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${v < 0 ? 'text-red-600' : v > 0 && row.label === 'Receita' ? 'text-emerald-600' : ''}`}>
                          {v !== 0 ? fmtBRL(v) : '—'}
                        </td>
                        <td className="py-1.5 px-1 text-right tabular-nums text-[10px] text-muted-foreground">
                          {row.percentuais[i] != null && v !== 0 ? `${row.percentuais[i]!.toFixed(1)}%` : ''}
                        </td>
                      </Fragment>
                    ))}
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

      <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10">
        <p className="text-xs text-muted-foreground">
          ⚠️ Valores vêm de <code className="bg-white dark:bg-gray-800 px-1 rounded">bronze.bronze_contaazul_lancamentos</code>
          {' '}usando <strong>valor_bruto</strong> agregado por <strong>data_competencia</strong> (regime de competência, igual ao Excel).
          {' '}Mapeamento categoria → MACRO em <code className="bg-white dark:bg-gray-800 px-1 rounded">financial.dre_categoria_macro</code>.
          {' '}Se uma categoria do ContaAzul não estiver mapeada, aparece como &ldquo;Não Mapeado&rdquo;.
        </p>
      </Card>
    </div>
  );
}
