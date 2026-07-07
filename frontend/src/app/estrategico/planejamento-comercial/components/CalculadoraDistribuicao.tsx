'use client';

/**
 * Calculadora de Distribuição de Metas por dia da semana.
 *
 * Espelha a planilha (colunas BP..BW): distribui uma meta mensal (Target M1) pelos
 * 7 dias da semana respeitando um "peso" manual por dia, e gera 2 cenários stretch
 * (M2/M3 = multiplicadores % sobre M1).
 *
 * Regra (reverse-engineered da planilha, bate exato):
 *   média-dia distribuição = média dos 7 pesos
 *   média-dia M1          = Target M1 / Dias de Venda
 *   conversão            = média-dia M1 / média-dia distribuição
 *   M1[dia]              = peso[dia] × conversão
 *   M2[dia]/M3[dia]      = M1[dia] × Target M2% / M3%
 *
 * NÃO grava nada no banco (só simulação). Config persiste em localStorage por bar.
 * O histórico das últimas 8 semanas (faturamento real por dia da semana) fica só
 * como referência ao lado — o preenchimento dos pesos é manual.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiCall } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calculator, ArrowDownToLine } from 'lucide-react';

const DIAS = [
  { dow: 1, key: 'seg', label: 'Seg' },
  { dow: 2, key: 'ter', label: 'Ter' },
  { dow: 3, key: 'qua', label: 'Qua' },
  { dow: 4, key: 'qui', label: 'Qui' },
  { dow: 5, key: 'sex', label: 'Sex' },
  { dow: 6, key: 'sab', label: 'Sáb' },
  { dow: 0, key: 'dom', label: 'Dom' },
] as const;

interface CalcCfg {
  targetM1: string;
  m2: string; // % (ex.: "120")
  m3: string; // % (ex.: "140")
  diasVenda: string;
  pesos: Record<number, string>; // dow -> R$ (texto)
}

interface HistDia { dow: number; dia: string; dias_com_venda: number; media_real: number; media_m1: number; }

const cfgDefault = (): CalcCfg => ({
  targetM1: '',
  m2: '120',
  m3: '140',
  diasVenda: '31',
  pesos: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
});

const storeKey = (barId?: number) => `zykor:calc-dist:v1:bar:${barId ?? 'na'}`;

// aceita "12.000,00" | "12000,5" | "12000" | "120" → número
function parseNum(s: string): number {
  if (!s) return 0;
  let t = String(s).trim().replace(/[^0-9.,-]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}
const fmt = (n: number, dec = 0) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtPct = (n: number) => `${(isFinite(n) ? n : 0).toFixed(1)}%`;

export function CalculadoraDistribuicao({ barId }: { barId?: number }) {
  const [cfg, setCfg] = useState<CalcCfg>(cfgDefault);
  const [hist, setHist] = useState<HistDia[]>([]);
  const [open, setOpen] = useState(false);

  // carrega config persistida por bar
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storeKey(barId)) : null;
      setCfg(raw ? { ...cfgDefault(), ...JSON.parse(raw) } : cfgDefault());
    } catch { setCfg(cfgDefault()); }
  }, [barId]);

  // persiste
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(storeKey(barId), JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg, barId]);

  // histórico 8 semanas
  useEffect(() => {
    if (!barId) return;
    apiCall('/api/eventos/distribuicao-semanal?semanas=8', { headers: { 'x-selected-bar-id': String(barId) } })
      .then((r: any) => { if (r?.success) setHist(r.porDia || []); })
      .catch(() => {});
  }, [barId]);

  const setPeso = (dow: number, v: string) => setCfg((p) => ({ ...p, pesos: { ...p.pesos, [dow]: v } }));
  const histDe = useCallback((dow: number) => hist.find((h) => h.dow === dow), [hist]);

  const preencherComHistorico = () => {
    setCfg((p) => ({
      ...p,
      pesos: DIAS.reduce((acc, d) => { acc[d.dow] = String(histDe(d.dow)?.media_real || 0); return acc; }, {} as Record<number, string>),
    }));
  };

  const calc = useMemo(() => {
    const pesos = DIAS.map((d) => parseNum(cfg.pesos[d.dow] || ''));
    const somaPesos = pesos.reduce((a, b) => a + b, 0);
    const mediaDistrib = somaPesos / 7;
    const targetM1 = parseNum(cfg.targetM1);
    const dias = parseNum(cfg.diasVenda);
    const m2 = parseNum(cfg.m2) / 100;
    const m3 = parseNum(cfg.m3) / 100;
    const mediaDiaM1 = dias > 0 ? targetM1 / dias : 0;
    const conversao = mediaDistrib > 0 ? mediaDiaM1 / mediaDistrib : 0;
    const linhas = DIAS.map((d, i) => {
      const m1 = pesos[i] * conversao;
      return { ...d, peso: pesos[i], m1, m2: m1 * m2, m3: m1 * m3 };
    });
    return {
      linhas, mediaDistrib, targetM1, dias, conversao, mediaDiaM1,
      mediaDiaM2: mediaDiaM1 * m2, mediaDiaM3: mediaDiaM1 * m3,
      totalM1: mediaDiaM1 * dias, totalM2: mediaDiaM1 * m2 * dias, totalM3: mediaDiaM1 * m3 * dias,
      temDados: somaPesos > 0 && targetM1 > 0 && dias > 0,
    };
  }, [cfg]);

  return (
    <div className="pt-4 border-t border-[hsl(var(--border))]">
      <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4" /> Distribuição de Metas
      </h3>

      {/* Resumo compacto */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Target M1:</span><span className="font-medium text-[hsl(var(--foreground))]">{calc.targetM1 > 0 ? fmt(calc.targetM1) : '—'}</span></div>
        <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Média-dia M1:</span><span className="font-medium text-[hsl(var(--foreground))]">{calc.temDados ? fmt(calc.mediaDiaM1) : '—'}</span></div>
        <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Conversão:</span><span className="font-medium text-[hsl(var(--foreground))]">{calc.temDados ? fmtPct(calc.conversao * 100) : '—'}</span></div>
      </div>

      {calc.temDados && (
        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
          {calc.linhas.map((l) => (
            <div key={l.dow} className="rounded bg-[hsl(var(--muted))] px-0.5 py-1">
              <div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">{l.label}</div>
              <div className="text-[9px] font-semibold text-[hsl(var(--foreground))] leading-tight">{l.m1 > 0 ? fmt(l.m1).replace('R$ ', '') : '—'}</div>
            </div>
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="w-full h-8 mt-3" leftIcon={<Calculator className="h-3.5 w-3.5" />}>
        {calc.temDados ? 'Editar calculadora' : 'Abrir calculadora'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Calculadora de Distribuição de Metas</DialogTitle>
            <DialogDescription>Distribui a meta mensal pelos dias da semana pelo peso de cada dia. Não grava nada — só simulação (salva no seu navegador).</DialogDescription>
          </DialogHeader>

          {/* Parâmetros */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label className="text-xs">Target M1 (mês)</Label><Input inputMode="decimal" value={cfg.targetM1} placeholder="1.500.000" onChange={(e) => setCfg((p) => ({ ...p, targetM1: e.target.value }))} /></div>
            <div><Label className="text-xs">Dias de Venda</Label><Input inputMode="decimal" value={cfg.diasVenda} onChange={(e) => setCfg((p) => ({ ...p, diasVenda: e.target.value }))} /></div>
            <div><Label className="text-xs">Target M2 (%)</Label><Input inputMode="decimal" value={cfg.m2} onChange={(e) => setCfg((p) => ({ ...p, m2: e.target.value }))} /></div>
            <div><Label className="text-xs">Target M3 (%)</Label><Input inputMode="decimal" value={cfg.m3} onChange={(e) => setCfg((p) => ({ ...p, m3: e.target.value }))} /></div>
          </div>

          {/* Pesos manuais por dia + hint do histórico */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Peso por dia da semana (R$)</Label>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={preencherComHistorico} leftIcon={<ArrowDownToLine className="h-3.5 w-3.5" />}>
                Preencher com média real (8 sem)
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS.map((d) => (
                <div key={d.dow}>
                  <div className="text-[10px] text-center text-[hsl(var(--muted-foreground))] uppercase mb-0.5">{d.label}</div>
                  <Input inputMode="decimal" className="text-center text-xs px-1 h-8" value={cfg.pesos[d.dow] || ''} onChange={(e) => setPeso(d.dow, e.target.value)} />
                  <div className="text-[9px] text-center text-[hsl(var(--muted-foreground))] mt-0.5" title="Média real das últimas 8 semanas">
                    {histDe(d.dow)?.media_real ? fmt(histDe(d.dow)!.media_real) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resultado */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                  <th className="text-left py-1.5 px-2">Dia</th>
                  <th className="text-right py-1.5 px-2">Peso</th>
                  <th className="text-right py-1.5 px-2">M1</th>
                  <th className="text-right py-1.5 px-2">M2</th>
                  <th className="text-right py-1.5 px-2">M3</th>
                </tr>
              </thead>
              <tbody>
                {calc.linhas.map((l) => (
                  <tr key={l.dow} className="border-b border-[hsl(var(--border))]/50">
                    <td className="py-1 px-2 font-medium">{l.label}</td>
                    <td className="py-1 px-2 text-right text-[hsl(var(--muted-foreground))]">{l.peso > 0 ? fmt(l.peso) : '—'}</td>
                    <td className="py-1 px-2 text-right font-semibold text-[hsl(var(--foreground))]">{l.m1 > 0 ? fmt(l.m1, 2) : '—'}</td>
                    <td className="py-1 px-2 text-right text-blue-600 dark:text-blue-400">{l.m2 > 0 ? fmt(l.m2, 2) : '—'}</td>
                    <td className="py-1 px-2 text-right text-emerald-600 dark:text-emerald-400">{l.m3 > 0 ? fmt(l.m3, 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold">
                <tr className="border-t-2 border-[hsl(var(--border))]">
                  <td className="py-1.5 px-2">Média-dia</td>
                  <td className="py-1.5 px-2 text-right text-[hsl(var(--muted-foreground))]">{calc.mediaDistrib > 0 ? fmt(calc.mediaDistrib) : '—'}</td>
                  <td className="py-1.5 px-2 text-right">{calc.temDados ? fmt(calc.mediaDiaM1) : '—'}</td>
                  <td className="py-1.5 px-2 text-right">{calc.temDados ? fmt(calc.mediaDiaM2) : '—'}</td>
                  <td className="py-1.5 px-2 text-right">{calc.temDados ? fmt(calc.mediaDiaM3) : '—'}</td>
                </tr>
                <tr>
                  <td className="py-1 px-2 text-[hsl(var(--muted-foreground))]">Total mês ({calc.dias || 0}d)</td>
                  <td className="py-1 px-2 text-right text-[hsl(var(--muted-foreground))]">Conv. {calc.temDados ? fmtPct(calc.conversao * 100) : '—'}</td>
                  <td className="py-1 px-2 text-right">{calc.temDados ? fmt(calc.totalM1) : '—'}</td>
                  <td className="py-1 px-2 text-right text-blue-600 dark:text-blue-400">{calc.temDados ? fmt(calc.totalM2) : '—'}</td>
                  <td className="py-1 px-2 text-right text-emerald-600 dark:text-emerald-400">{calc.temDados ? fmt(calc.totalM3) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Histórico 8 semanas (referência) */}
          <div className="mt-4 rounded-lg border border-[hsl(var(--border))] p-3">
            <div className="text-xs font-semibold text-[hsl(var(--foreground))] mb-2">Referência — últimas 8 semanas (faturamento real por dia da semana)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-[hsl(var(--muted-foreground))]">
                    <th className="text-left py-1 px-1"></th>
                    {DIAS.map((d) => <th key={d.dow} className="text-right py-1 px-1 uppercase">{d.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[hsl(var(--border))]">
                    <td className="py-1 px-1 text-[hsl(var(--muted-foreground))]">Média real</td>
                    {DIAS.map((d) => <td key={d.dow} className="text-right py-1 px-1 font-medium">{histDe(d.dow)?.media_real ? fmt(histDe(d.dow)!.media_real) : '—'}</td>)}
                  </tr>
                  <tr className="border-t border-[hsl(var(--border))]/50">
                    <td className="py-1 px-1 text-[hsl(var(--muted-foreground))]">Média M1 plan.</td>
                    {DIAS.map((d) => <td key={d.dow} className="text-right py-1 px-1 text-[hsl(var(--muted-foreground))]">{histDe(d.dow)?.media_m1 ? fmt(histDe(d.dow)!.media_m1) : '—'}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
