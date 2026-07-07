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
 * Config persiste em localStorage por bar. O histórico das últimas 8 semanas
 * (faturamento real por dia da semana) fica como referência — pesos são manuais.
 * O botão "Aplicar" grava o M1 de cada dia da semana na Meta M1 do mês (eventos_base).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiCall } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calculator, ArrowDownToLine, Check, Loader2, AlertTriangle } from 'lucide-react';

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
  pesos: Record<number, string>; // dow -> R$ (texto mascarado)
}

interface HistDia { dow: number; dia: string; dias_com_venda: number; media_real: number; media_m1: number; }

const cfgDefault = (): CalcCfg => ({
  targetM1: '',
  m2: '120',
  m3: '140',
  diasVenda: '31',
  pesos: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
});

const storeKey = (barId: number | undefined, ano: number, mes: number) => `zykor:calc-dist:v2:bar:${barId ?? 'na'}:${ano}-${mes}`;

// aceita "R$ 12.000,00" | "12000,5" | "12000" | "120" → número
function parseNum(s: string): number {
  if (!s) return 0;
  let t = String(s).trim().replace(/[^0-9.,-]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}
// máscara de moeda: dígitos → centavos → "R$ 12.000,00" (formata enquanto digita)
function maskMoeda(raw: string): string {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const fmt = (n: number, dec = 0) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtPct = (n: number) => `${(isFinite(n) ? n : 0).toFixed(1)}%`;
const fmtData = (iso: string) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

// linha do banco (números) → config da UI (strings mascaradas)
function cfgFromDb(row: any): CalcCfg {
  const pesos: Record<number, string> = { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' };
  for (const d of DIAS) {
    const v = row?.pesos?.[d.dow];
    pesos[d.dow] = v ? fmt(Number(v), 2) : '';
  }
  return {
    targetM1: row?.target_m1 ? fmt(Number(row.target_m1), 2) : '',
    m2: row?.m2_pct != null ? String(row.m2_pct) : '120',
    m3: row?.m3_pct != null ? String(row.m3_pct) : '140',
    diasVenda: row?.dias_venda != null ? String(row.dias_venda) : '31',
    pesos,
  };
}

export function CalculadoraDistribuicao({ barId, ano, mes, mesLabel, onAplicado }: {
  barId?: number;
  ano: number;
  mes: number;
  mesLabel: string;
  onAplicado?: () => void;
}) {
  const [cfg, setCfg] = useState<CalcCfg>(cfgDefault);
  const [hist, setHist] = useState<HistDia[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [aba, setAba] = useState<'calc' | 'hist'>('calc');
  const [histRows, setHistRows] = useState<Array<{ data_evento: string | null; dia: string | null; de: number | null; para: number | null; user_email: string | null; timestamp: string }>>([]);
  const [histLoading, setHistLoading] = useState(false);

  // carrega o histórico de mudanças da Meta M1 do mês (audit_trail) ao abrir a aba
  useEffect(() => {
    if (!open || aba !== 'hist' || !barId) return;
    setHistLoading(true);
    apiCall(`/api/eventos/distribuicao-historico?ano=${ano}&mes=${mes}`, { headers: { 'x-selected-bar-id': String(barId) } })
      .then((r: any) => setHistRows(r?.success ? (r.historico || []) : []))
      .catch(() => setHistRows([]))
      .finally(() => setHistLoading(false));
  }, [open, aba, barId, ano, mes]);

  // carrega config por bar+mês: rascunho local (instantâneo) OU, se não houver,
  // a config salva no banco (durável, gravada ao clicar Aplicar).
  useEffect(() => {
    setHydrated(false);
    let cancel = false;
    let draft: CalcCfg | null = null;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storeKey(barId, ano, mes)) : null;
      if (raw) draft = { ...cfgDefault(), ...JSON.parse(raw) };
    } catch { draft = null; }
    if (draft) { setCfg(draft); setHydrated(true); return; }
    if (!barId) { setCfg(cfgDefault()); setHydrated(true); return; }
    apiCall(`/api/eventos/distribuicao-config?ano=${ano}&mes=${mes}`, { headers: { 'x-selected-bar-id': String(barId) } })
      .then((r: any) => { if (!cancel) { setCfg(r?.config ? cfgFromDb(r.config) : cfgDefault()); setHydrated(true); } })
      .catch(() => { if (!cancel) { setCfg(cfgDefault()); setHydrated(true); } });
    return () => { cancel = true; };
  }, [barId, ano, mes]);

  // persiste rascunho local (só depois de hidratar, pra não gravar default por cima)
  useEffect(() => {
    if (!hydrated) return;
    try { if (typeof window !== 'undefined') window.localStorage.setItem(storeKey(barId, ano, mes), JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg, barId, ano, mes, hydrated]);

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
      pesos: DIAS.reduce((acc, d) => { acc[d.dow] = histDe(d.dow)?.media_real ? fmt(histDe(d.dow)!.media_real, 2) : ''; return acc; }, {} as Record<number, string>),
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

  const aplicar = async () => {
    if (!barId || !calc.temDados) return;
    setAplicando(true);
    setResultado(null);
    try {
      // 1) salva a config da calculadora no banco (durável, por bar+mês)
      const pesosNum: Record<number, number> = {};
      DIAS.forEach((d) => { pesosNum[d.dow] = parseNum(cfg.pesos[d.dow] || ''); });
      await apiCall('/api/eventos/distribuicao-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ ano, mes, target_m1: parseNum(cfg.targetM1), m2_pct: parseNum(cfg.m2), m3_pct: parseNum(cfg.m3), dias_venda: parseNum(cfg.diasVenda), pesos: pesosNum }),
      }).catch(() => {});

      // 2) aplica o M1 de cada dia da semana na Meta M1 do mês
      const m1PorDow: Record<number, number> = {};
      calc.linhas.forEach((l) => { m1PorDow[l.dow] = Math.round(l.m1 * 100) / 100; });
      const r: any = await apiCall('/api/eventos/aplicar-m1-distribuicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ ano, mes, m1PorDow }),
      });
      if (r?.success) {
        setResultado(`✅ Meta M1 aplicada em ${r.updated} dia(s) de ${mesLabel}.`);
        setConfirmando(false);
        onAplicado?.();
      } else {
        setResultado(`❌ ${r?.error || 'Falha ao aplicar.'}`);
      }
    } catch (e: any) {
      setResultado(`❌ ${e?.message || 'Falha ao aplicar.'}`);
    } finally {
      setAplicando(false);
    }
  };

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

      {/* M1 por dia — uma linha por dia */}
      {calc.temDados && (
        <div className="mt-2 space-y-0.5">
          {calc.linhas.map((l) => (
            <div key={l.dow} className="flex justify-between items-center text-xs rounded bg-[hsl(var(--muted))] px-2 py-1">
              <span className="text-[hsl(var(--muted-foreground))] uppercase">{l.label}</span>
              <span className="font-semibold text-[hsl(var(--foreground))]">{l.m1 > 0 ? fmt(l.m1) : '—'}</span>
            </div>
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="w-full h-8 mt-3" leftIcon={<Calculator className="h-3.5 w-3.5" />}>
        {calc.temDados ? 'Editar calculadora' : 'Abrir calculadora'}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirmando(false); setResultado(null); setAba('calc'); } }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Calculadora de Distribuição de Metas</DialogTitle>
            <DialogDescription>Distribui a meta mensal pelos dias da semana pelo peso de cada dia. Salva no seu navegador; use &ldquo;Aplicar&rdquo; para gravar a Meta M1 no mês.</DialogDescription>
          </DialogHeader>

          <div className="px-6 flex gap-4 border-b border-[hsl(var(--border))]">
            {(['calc', 'hist'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAba(t)}
                className={`pb-2 -mb-px text-sm font-medium border-b-2 transition-colors ${aba === t ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
              >
                {t === 'calc' ? 'Calculadora' : 'Histórico do mês'}
              </button>
            ))}
          </div>

          {aba === 'calc' && (
          <div className="px-6 pb-2">
          {/* Parâmetros */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label className="text-xs">Target M1 (mês)</Label><Input inputMode="decimal" value={cfg.targetM1} placeholder="R$ 0,00" onChange={(e) => setCfg((p) => ({ ...p, targetM1: maskMoeda(e.target.value) }))} /></div>
            <div><Label className="text-xs">Dias de Venda</Label><Input inputMode="numeric" value={cfg.diasVenda} onChange={(e) => setCfg((p) => ({ ...p, diasVenda: e.target.value.replace(/\D/g, '') }))} /></div>
            <div><Label className="text-xs">Target M2 (%)</Label><Input inputMode="decimal" value={cfg.m2} onChange={(e) => setCfg((p) => ({ ...p, m2: e.target.value }))} /></div>
            <div><Label className="text-xs">Target M3 (%)</Label><Input inputMode="decimal" value={cfg.m3} onChange={(e) => setCfg((p) => ({ ...p, m3: e.target.value }))} /></div>
          </div>

          {/* Pesos manuais por dia (uma linha por dia) + hint do histórico */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Peso por dia da semana (R$)</Label>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={preencherComHistorico} leftIcon={<ArrowDownToLine className="h-3.5 w-3.5" />}>
                Preencher com média real (8 sem)
              </Button>
            </div>
            <div className="space-y-1.5">
              {DIAS.map((d) => {
                const h = histDe(d.dow);
                return (
                  <div key={d.dow} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase shrink-0">{d.label}</span>
                    <Input inputMode="decimal" className="flex-1 h-9" placeholder="R$ 0,00" value={cfg.pesos[d.dow] || ''} onChange={(e) => setPeso(d.dow, maskMoeda(e.target.value))} />
                    <button
                      type="button"
                      onClick={() => h?.media_real && setPeso(d.dow, fmt(h.media_real, 2))}
                      title="Usar a média real das últimas 8 semanas"
                      className="w-32 shrink-0 text-right text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
                    >
                      {h?.media_real ? `8 sem: ${fmt(h.media_real)}` : '—'}
                    </button>
                  </div>
                );
              })}
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
            <div className="space-y-1">
              {DIAS.map((d) => {
                const h = histDe(d.dow);
                return (
                  <div key={d.dow} className="flex justify-between items-center text-[11px]">
                    <span className="w-10 uppercase text-[hsl(var(--muted-foreground))]">{d.label}</span>
                    <span className="font-medium text-[hsl(var(--foreground))]">{h?.media_real ? fmt(h.media_real) : '—'}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">M1 plan.: {h?.media_m1 ? fmt(h.media_m1) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
          )}

          {aba === 'hist' && (
          <div className="px-6 pb-2">
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Alterações da Meta M1 dos dias de {mesLabel} — quem mudou, quando e de→para.</div>
            {histLoading ? (
              <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))] flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
            ) : histRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Nenhuma alteração de Meta M1 registrada ainda neste mês.</div>
            ) : (
              <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
                {histRows.map((h, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs rounded border border-[hsl(var(--border))] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="uppercase text-[hsl(var(--muted-foreground))] w-8 shrink-0">{h.dia || '—'}</span>
                      <span className="font-medium text-[hsl(var(--foreground))] shrink-0">{h.data_evento ? h.data_evento.split('-').reverse().join('/') : '—'}</span>
                      <span className="text-[hsl(var(--muted-foreground))] truncate">
                        {h.de != null ? fmt(h.de) : '—'}<span className="mx-1">→</span><span className="font-semibold text-[hsl(var(--foreground))]">{h.para != null ? fmt(h.para) : '—'}</span>
                      </span>
                    </div>
                    <div className="text-right shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <div className="truncate max-w-[140px]">{h.user_email || 'sistema'}</div>
                      <div>{fmtData(h.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {aba === 'calc' && resultado && <span className="text-xs mr-auto self-center">{resultado}</span>}
            {aba === 'hist' ? (
              <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            ) : confirmando ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Sobrescrever Meta M1 de {mesLabel}?</span>
                <Button size="sm" variant="outline" onClick={() => setConfirmando(false)} disabled={aplicando}>Cancelar</Button>
                <Button size="sm" onClick={aplicar} disabled={aplicando} leftIcon={aplicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}>
                  Confirmar
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
                <Button onClick={() => { setResultado(null); setConfirmando(true); }} disabled={!calc.temDados} leftIcon={<Check className="h-4 w-4" />}>
                  Aplicar ao Planejamento ({mesLabel})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
