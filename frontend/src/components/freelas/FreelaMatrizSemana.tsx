'use client';

import { Fragment, useMemo } from 'react';
import { Check } from 'lucide-react';

// Matriz de presença dos freelas na semana (visão "planilha"): linhas = freelas agrupados por
// ÁREA, colunas = dias (seg→dom), célula marcada = a pessoa trabalhou naquele dia. Não faz fetch
// próprio — recebe o roster + pedidos que a página de Operação já carregou.

type Freela = { id: string; nome: string; funcao: string | null; contaazul_pessoa_id: string | null };
type Pedido = {
  id: string; beneficiario_nome: string | null; valor: number;
  data_competencia: string | null; data_vencimento: string;
  contaazul_pessoa_id: string | null; descricao?: string | null;
};

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const DIA_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// A função do dia fica embutida na descrição da diária: "Freela <função> — <nome> (venc)".
function funcaoDaDescricao(desc?: string | null): string {
  const m = /^Freela\s+(.+?)\s+—\s+/.exec(desc || '');
  return m ? m[1].trim() : '';
}

// Chave da pessoa: id do Conta Azul quando houver, senão nome normalizado.
const pessoaKey = (p: { contaazul_pessoa_id: string | null; beneficiario_nome?: string | null; nome?: string | null }) =>
  p.contaazul_pessoa_id || norm(p.beneficiario_nome ?? p.nome);

const SEM_AREA = 'Sem área';

type Linha = {
  key: string; nome: string; area: string;
  dias: Set<string>; totalDias: number; totalValor: number;
};

export function FreelaMatrizSemana({ roster, pedidos, monISO }: { roster: Freela[]; pedidos: Pedido[]; monISO: string }) {
  const dias = useMemo(() => {
    const seg = parseISO(monISO);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(seg); d.setDate(seg.getDate() + i); return toISO(d); });
  }, [monISO]);

  // Área padrão da pessoa vinda do cadastro (roster). Casa por pessoa do CA ou nome.
  const areaRoster = useMemo(() => {
    const byId = new Map<string, string>(), byNome = new Map<string, string>();
    for (const f of roster) if (f.funcao) {
      if (f.contaazul_pessoa_id) byId.set(f.contaazul_pessoa_id, f.funcao);
      byNome.set(norm(f.nome), f.funcao);
    }
    return { byId, byNome };
  }, [roster]);

  const { grupos, totalGeral } = useMemo(() => {
    const linhas = new Map<string, Linha>();
    for (const p of pedidos) {
      const dia = p.data_competencia;
      if (!dia || !dias.includes(dia)) continue;
      const key = pessoaKey(p);
      if (!key) continue;
      let ln = linhas.get(key);
      if (!ln) {
        // Área: cadastro (roster) primeiro; senão a função do dia da descrição; senão "Sem área".
        const areaCad = (p.contaazul_pessoa_id && areaRoster.byId.get(p.contaazul_pessoa_id))
          || areaRoster.byNome.get(norm(p.beneficiario_nome));
        const area = (areaCad || funcaoDaDescricao(p.descricao) || SEM_AREA).trim() || SEM_AREA;
        ln = { key, nome: p.beneficiario_nome || '—', area, dias: new Set(), totalDias: 0, totalValor: 0 };
        linhas.set(key, ln);
      }
      if (!ln.dias.has(dia)) { ln.dias.add(dia); ln.totalDias++; }
      ln.totalValor += Number(p.valor || 0);
    }

    // Agrupa por área e ordena (área alfabética, "Sem área" por último; nomes alfabéticos).
    const porArea = new Map<string, Linha[]>();
    for (const ln of linhas.values()) (porArea.get(ln.area) || porArea.set(ln.area, []).get(ln.area)!).push(ln);
    const grupos = [...porArea.entries()]
      .sort(([a], [b]) => (a === SEM_AREA ? 1 : b === SEM_AREA ? -1 : a.localeCompare(b, 'pt-BR')))
      .map(([area, ls]) => ({ area, linhas: ls.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')) }));
    const totalGeral = [...linhas.values()].reduce((s, l) => s + l.totalValor, 0);
    return { grupos, totalGeral };
  }, [pedidos, dias, areaRoster]);

  const totalPessoas = grupos.reduce((s, g) => s + g.linhas.length, 0);
  // Total de diárias por dia (rodapé).
  const totaisDia = useMemo(() => dias.map(d =>
    grupos.reduce((s, g) => s + g.linhas.filter(l => l.dias.has(d)).length, 0)
  ), [dias, grupos]);

  if (totalPessoas === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Nenhum freela lançado nesta semana.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[hsl(var(--border))]">
            <th className="text-left font-medium py-2 pr-3 sticky left-0 bg-card z-10 min-w-[180px]">Freela</th>
            {dias.map((d, i) => (
              <th key={d} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                <div>{DIA_SEMANA[i]}</div>
                <div className="text-[11px] text-muted-foreground font-normal">{ddmm(d)}</div>
              </th>
            ))}
            <th className="px-2 py-2 text-center font-medium">Dias</th>
            <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Total</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(g => (
            <Fragment key={`area-${g.area}`}>
              <tr className="bg-muted/40">
                <td colSpan={dias.length + 3} className="px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.area} · {g.linhas.length}
                </td>
              </tr>
              {g.linhas.map(l => (
                <tr key={l.key} className="border-b border-[hsl(var(--border))]/60 hover:bg-muted/20">
                  <td className="py-1.5 pr-3 sticky left-0 bg-card z-10 font-medium truncate max-w-[220px]">{l.nome}</td>
                  {dias.map(d => (
                    <td key={d} className="px-2 py-1.5 text-center">
                      {l.dias.has(d)
                        ? <Check className="w-4 h-4 mx-auto text-emerald-600 dark:text-emerald-400" />
                        : <span className="text-muted-foreground/30">·</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center tabular-nums">{l.totalDias}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{fmtBRL(l.totalValor)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[hsl(var(--border))] font-medium">
            <td className="py-2 pr-3 sticky left-0 bg-card z-10">Total · {totalPessoas} freela(s)</td>
            {totaisDia.map((n, i) => (
              <td key={dias[i]} className="px-2 py-2 text-center tabular-nums">{n || <span className="text-muted-foreground/30">·</span>}</td>
            ))}
            <td className="px-2 py-2 text-center tabular-nums">{totaisDia.reduce((s, n) => s + n, 0)}</td>
            <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(totalGeral)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
