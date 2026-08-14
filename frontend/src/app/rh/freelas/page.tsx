'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { cn } from '@/lib/utils';
import { HandCoins, Loader2, AlertTriangle, Search, Building2, ChevronDown } from 'lucide-react';

/**
 * Freelas — histórico e risco (ata de RH de 13/08/2026).
 *
 * "QUANTAS VEZES NO ANO, QUANTO JÁ PAGAMOS E QUANTAS SEMANAS FOI MAIS DE 2x (O RISCO TRABALHISTA)."
 *
 * A tela antiga era convocação por dia sobre `hr.freela_convocacao` — nunca foi usada (0 linhas) e
 * duplicava /operacional/freelas, que é onde a semana é montada de verdade. O histórico aqui sai
 * do fluxo de pagamento, que é o registro real de quem trabalhou.
 */

type Linha = {
  chave_pix: string; nome: string; funcoes: string | null; eh_empresa: boolean;
  diarias: number; total_pago: number; total_previsto: number;
  semanas: number; semanas_risco: number; max_na_semana: number;
  primeira: string; ultima: string; risco: boolean;
};
type Diaria = { dia: string; valor: number; funcao: string | null; status: string };

const fmtR$ = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');
// ̀-ͯ = marcas de acento soltas depois do NFD (escapado pra não depender do encoding do arquivo)
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function FreelasPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [busca, setBusca] = useState('');
  const [soRisco, setSoRisco] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('🤝 Freelas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { data, isLoading } = useApiSWR<any>(selectedBar ? `/api/rh/freelas/historico?ano=${ano}` : null);
  const linhas: Linha[] = useMemo(() => data?.linhas || [], [data]);
  const r = data?.resumo;

  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    return linhas.filter((l) => (!soRisco || l.risco) && (!q || semAcento(l.nome).includes(q) || semAcento(l.funcoes || '').includes(q)));
  }, [linhas, busca, soRisco]);

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-green-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-3 text-white">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><HandCoins className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Freelas</h1>
              <p className="text-sm text-white/80">Quantas vezes, quanto pagamos e quem está virando vínculo</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 w-[100px]" />
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou função" className="h-9 pl-8" />
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={soRisco} onChange={(e) => setSoRisco(e.target.checked)} className="rounded" />
            Só quem está em risco
          </label>
        </div>

        {isLoading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Pessoas</div><div className="text-xl font-bold">{r?.pessoas ?? 0}</div></CardContent></Card>
              <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Diárias</div><div className="text-xl font-bold">{r?.diarias ?? 0}</div></CardContent></Card>
              <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Pago no ano</div><div className="text-xl font-bold">{fmtR$(r?.total_pago || 0)}</div></CardContent></Card>
              <Card className={cn((r?.em_risco || 0) > 0 && 'ring-1 ring-red-300 dark:ring-red-800')}>
                <CardContent className="py-3">
                  <div className="text-xs text-muted-foreground">Em risco de vínculo</div>
                  <div className={cn('text-xl font-bold', (r?.em_risco || 0) > 0 && 'text-red-600 dark:text-red-400')}>{r?.em_risco ?? 0}</div>
                </CardContent>
              </Card>
            </div>

            <p className="text-[11px] text-muted-foreground mb-2">
              <strong>Risco</strong> = pessoa física que trabalhou <strong>mais de 2 dias na mesma semana</strong> pelo menos uma vez.
              Empresa (PJ) não gera vínculo e aparece marcada, fora da conta.
            </p>

            <Card className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40"><tr>
                  <th className="text-left px-3 py-2 min-w-[190px]">Freela</th>
                  <th className="text-left px-3 py-2">Função</th>
                  <th className="text-right px-3 py-2">Diárias</th>
                  <th className="text-right px-3 py-2">Pago</th>
                  <th className="text-right px-3 py-2" title="Semanas em que trabalhou mais de 2 dias">Semanas &gt;2x</th>
                  <th className="text-right px-3 py-2">Máx/semana</th>
                  <th className="text-left px-3 py-2">Última</th>
                </tr></thead>
                <tbody>
                  {visiveis.map((l) => (
                    <FreelaLinha key={l.chave_pix} l={l} ano={ano}
                      aberto={aberto === l.chave_pix} onToggle={() => setAberto(aberto === l.chave_pix ? null : l.chave_pix)} />
                  ))}
                  {visiveis.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      <HandCoins className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {linhas.length === 0 ? `Nenhum freela pago em ${ano}.` : 'Nenhum freela com esse filtro.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

function FreelaLinha({ l, ano, aberto, onToggle }: { l: Linha; ano: number; aberto: boolean; onToggle: () => void }) {
  // só busca o detalhe quando a linha é aberta — são ~90 freelas por bar
  const { data } = useApiSWR<any>(aberto ? `/api/rh/freelas/historico?ano=${ano}&chave_pix=${encodeURIComponent(l.chave_pix)}` : null);
  const diarias: Diaria[] = data?.diarias || [];

  return (
    <>
      <tr onClick={onToggle} className={cn('border-b last:border-0 cursor-pointer hover:bg-muted/30', l.risco && 'bg-red-50/40 dark:bg-red-900/10')}>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/50 transition-transform shrink-0', !aberto && '-rotate-90')} />
            <span className="font-medium truncate">{l.nome}</span>
            {l.eh_empresa && <span title="PJ — não gera vínculo"><Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" /></span>}
            {l.risco && <span title={`${l.semanas_risco} semana(s) com mais de 2 diárias`}><AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" /></span>}
          </div>
        </td>
        <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[160px]">{l.funcoes || '—'}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{l.diarias}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{fmtR$(l.total_pago)}</td>
        <td className={cn('px-3 py-1.5 text-right tabular-nums font-medium', l.risco && 'text-red-600 dark:text-red-400')}>{l.semanas_risco || '—'}</td>
        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{l.max_na_semana}</td>
        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{fmtData(l.ultima)}</td>
      </tr>
      {aberto && (
        <tr className="border-b bg-muted/20"><td colSpan={7} className="px-3 py-2">
          {diarias.length === 0 ? <div className="text-xs text-muted-foreground py-2">Carregando diárias…</div> : (
            <div className="flex flex-wrap gap-1.5">
              {diarias.map((d, i) => (
                <span key={i} className="text-[11px] rounded border bg-background px-1.5 py-0.5">
                  {fmtData(d.dia)} · {fmtR$(d.valor)}
                  {d.funcao && <span className="text-muted-foreground"> · {d.funcao}</span>}
                  {d.status !== 'pago' && <span className="text-amber-600 dark:text-amber-400"> · {d.status}</span>}
                </span>
              ))}
            </div>
          )}
        </td></tr>
      )}
    </>
  );
}
