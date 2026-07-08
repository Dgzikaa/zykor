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
  artPct: Record<number, string>; // dow -> % custo artístico projetado
  artFixo: Record<number, string>; // dow -> R$ cachê fixo artístico (ex.: DJ) — soma ao %
  prodPct: Record<number, string>; // dow -> % custo produção projetado
}

interface HistDia { dow: number; dia: string; dias_com_venda: number; media_real: number; media_m1: number; }

const cfgDefault = (): CalcCfg => ({
  targetM1: '',
  m2: '120',
  m3: '140',
  diasVenda: '31',
  pesos: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  artPct: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  artFixo: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  prodPct: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
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
    ...cfgDefault(), // garante artPct/prodPct default (não persistidos no banco de config)
    targetM1: row?.target_m1 ? fmt(Number(row.target_m1), 2) : '',
    m2: row?.m2_pct != null ? String(row.m2_pct) : '120',
    m3: row?.m3_pct != null ? String(row.m3_pct) : '140',
    diasVenda: row?.dias_venda != null ? String(row.dias_venda) : '31',
    pesos,
  };
}

export function CalculadoraDistribuicao({ barId, ano, mes, mesLabel, diasManuais = 0, variant = 'sidebar', onAplicado }: {
  barId?: number;
  ano: number;
  mes: number;
  mesLabel: string;
  diasManuais?: number;
  variant?: 'sidebar' | 'card';
  onAplicado?: () => void;
}) {
  const [cfg, setCfg] = useState<CalcCfg>(cfgDefault);
  const [operaDias, setOperaDias] = useState<Record<number, boolean>>({}); // dow -> opera? (vazio = todos abertos)
  const [hist, setHist] = useState<HistDia[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [aba, setAba] = useState<'calc' | 'custos' | 'hist'>('calc');
  const [cenario, setCenario] = useState<'m1' | 'm2' | 'm3'>('m1');
  const [preservarManuais, setPreservarManuais] = useState(true);
  // aba "Custos projetados" (% de custo artístico/produção por dia da semana → previsão do mês)
  const [confirmandoCustos, setConfirmandoCustos] = useState(false);
  const [aplicandoCustos, setAplicandoCustos] = useState(false);
  const [resultadoCustos, setResultadoCustos] = useState<string | null>(null);
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

  // dias de operação do bar (bar fechado num dia não entra na distribuição — ex.: Deboche às segundas)
  useEffect(() => {
    if (!barId) { setOperaDias({}); return; }
    let cancel = false;
    apiCall(`/api/eventos/distribuicao-config?ano=${ano}&mes=${mes}`, { headers: { 'x-selected-bar-id': String(barId) } })
      .then((r: any) => { if (!cancel) setOperaDias(r?.opera || {}); })
      .catch(() => { if (!cancel) setOperaDias({}); });
    return () => { cancel = true; };
  }, [barId, ano, mes]);

  const diaAtivo = useCallback((dow: number) => operaDias[dow] !== false, [operaDias]);
  const diasAtivos = useMemo(() => DIAS.filter((d) => operaDias[d.dow] !== false), [operaDias]);

  const setPeso = (dow: number, v: string) => setCfg((p) => ({ ...p, pesos: { ...p.pesos, [dow]: v } }));
  const histDe = useCallback((dow: number) => hist.find((h) => h.dow === dow), [hist]);

  // % de custo projetado por dia da semana (só dígitos/vírgula/ponto)
  const limpaPct = (v: string) => v.replace(/[^\d.,]/g, '');
  const setArtPct = (dow: number, v: string) => setCfg((p) => ({ ...p, artPct: { ...p.artPct, [dow]: limpaPct(v) } }));
  const setProdPct = (dow: number, v: string) => setCfg((p) => ({ ...p, prodPct: { ...p.prodPct, [dow]: limpaPct(v) } }));
  const setArtFixo = (dow: number, v: string) => setCfg((p) => ({ ...p, artFixo: { ...p.artFixo, [dow]: maskMoeda(v) } }));
  const preencherPct = (campo: 'artPct' | 'prodPct', v: string) =>
    setCfg((p) => ({ ...p, [campo]: DIAS.reduce((a, d) => { a[d.dow] = diaAtivo(d.dow) ? limpaPct(v) : ''; return a; }, {} as Record<number, string>) }));
  const preencherArtFixo = (v: string) =>
    setCfg((p) => ({ ...p, artFixo: DIAS.reduce((a, d) => { a[d.dow] = diaAtivo(d.dow) ? maskMoeda(v) : ''; return a; }, {} as Record<number, string>) }));
  const temCustos = DIAS.some((d) => parseNum(cfg.artPct?.[d.dow] || '') > 0 || parseNum(cfg.prodPct?.[d.dow] || '') > 0 || parseNum(cfg.artFixo?.[d.dow] || '') > 0);

  const aplicarCustos = async () => {
    if (!barId || !temCustos) return;
    setAplicandoCustos(true);
    setResultadoCustos(null);
    try {
      const artPorDow: Record<number, number> = {};
      const prodPorDow: Record<number, number> = {};
      const artFixoPorDow: Record<number, number> = {};
      diasAtivos.forEach((d) => {
        const a = parseNum(cfg.artPct?.[d.dow] || ''); if (a > 0) artPorDow[d.dow] = a;
        const pr = parseNum(cfg.prodPct?.[d.dow] || ''); if (pr > 0) prodPorDow[d.dow] = pr;
        const af = parseNum(cfg.artFixo?.[d.dow] || ''); if (af > 0) artFixoPorDow[d.dow] = af;
      });
      const r: any = await apiCall('/api/eventos/aplicar-custos-projetados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ ano, mes, artPorDow, prodPorDow, artFixoPorDow }),
      });
      if (r?.success) {
        setResultadoCustos(`✅ Projeção aplicada em ${mesLabel}: custo artístico em ${r.updated_art} dia(s), produção em ${r.updated_prod} dia(s).`);
        setConfirmandoCustos(false);
        onAplicado?.();
      } else {
        setResultadoCustos(`❌ ${r?.error || 'Falha ao aplicar.'}`);
      }
    } catch (e: any) {
      setResultadoCustos(`❌ ${e?.message || 'Falha ao aplicar.'}`);
    } finally {
      setAplicandoCustos(false);
    }
  };

  const preencherComHistorico = () => {
    setCfg((p) => ({
      ...p,
      pesos: DIAS.reduce((acc, d) => { acc[d.dow] = diaAtivo(d.dow) && histDe(d.dow)?.media_real ? fmt(histDe(d.dow)!.media_real, 2) : ''; return acc; }, {} as Record<number, string>),
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

      // 2) aplica o cenário escolhido (M1/M2/M3) de cada dia da semana na Meta M1 do mês
      const m1PorDow: Record<number, number> = {};
      calc.linhas.forEach((l) => {
        if (!diaAtivo(l.dow)) return; // dia fechado não recebe meta
        const v = cenario === 'm2' ? l.m2 : cenario === 'm3' ? l.m3 : l.m1;
        m1PorDow[l.dow] = Math.round(v * 100) / 100;
      });
      const r: any = await apiCall('/api/eventos/aplicar-m1-distribuicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ ano, mes, m1PorDow, preservarManuais }),
      });
      if (r?.success) {
        const extra = r.preservados > 0 ? ` (${r.preservados} manual(is) 🔔 preservado(s))` : '';
        setResultado(`✅ Cenário ${cenario.toUpperCase()} aplicado na Meta M1 de ${r.updated} dia(s) de ${mesLabel}${extra}.`);
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
    <div className={variant === 'card' ? 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3' : 'pt-4 border-t border-[hsl(var(--border))]'}>
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
          {calc.linhas.filter((l) => diaAtivo(l.dow)).map((l) => (
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

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirmando(false); setResultado(null); setConfirmandoCustos(false); setResultadoCustos(null); setAba('calc'); } }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Calculadora de Distribuição de Metas</DialogTitle>
            <DialogDescription>Distribui a meta mensal pelos dias da semana pelo peso de cada dia. Salva no seu navegador; use &ldquo;Aplicar&rdquo; para gravar a Meta M1 no mês.</DialogDescription>
          </DialogHeader>

          <div className="px-6 flex gap-4 border-b border-[hsl(var(--border))]">
            {(['calc', 'custos', 'hist'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAba(t)}
                className={`pb-2 -mb-px text-sm font-medium border-b-2 transition-colors ${aba === t ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
              >
                {t === 'calc' ? 'Calculadora' : t === 'custos' ? 'Custos projetados' : 'Histórico do mês'}
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
              {diasAtivos.map((d) => {
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
                {calc.linhas.filter((l) => diaAtivo(l.dow)).map((l) => (
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
              {diasAtivos.map((d) => {
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

          {aba === 'custos' && (
          <div className="px-6 pb-2">
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              Projeta o custo <b>artístico</b> e de <b>produção</b> de cada dia, pro mês todo de {mesLabel}.
              O custo artístico é <b>% do faturamento</b> + um <b>cachê fixo</b> (R$) — some os dois quando há negociação por % <i>e</i> um DJ de valor fechado.
              Base do %: <b>realizado</b>; se ainda não houver, a <b>Meta M1</b> (o cachê fixo entra sempre). Grava na <b>previsão</b> (c_artistico_plan / c_prod_plan) —
              não sobrescreve lançamento real do Conta Azul (o real sempre ganha) e sobrevive à projeção automática.
            </div>

            {/* preencher todos os dias de uma vez */}
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">Aplicar em todos os dias:</span>
              <span className="text-[hsl(var(--muted-foreground))]">Artístico</span>
              <div className="relative"><Input inputMode="decimal" className="h-8 w-16 pr-5 text-right" placeholder="0" onChange={(e) => preencherPct('artPct', e.target.value)} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))]">%</span></div>
              <span className="text-[hsl(var(--muted-foreground))]">Cachê fixo</span>
              <Input inputMode="decimal" className="h-8 w-28 text-right" placeholder="R$ 0,00" onChange={(e) => preencherArtFixo(e.target.value)} />
              <span className="text-[hsl(var(--muted-foreground))]">Produção</span>
              <div className="relative"><Input inputMode="decimal" className="h-8 w-16 pr-5 text-right" placeholder="0" onChange={(e) => preencherPct('prodPct', e.target.value)} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))]">%</span></div>
            </div>

            {/* colunas por dia da semana */}
            <div className="flex items-center gap-3 text-[11px] uppercase text-[hsl(var(--muted-foreground))] mb-1">
              <span className="w-10 shrink-0" />
              <span className="flex-1 text-center">% Custo Artístico</span>
              <span className="flex-1 text-center">Cachê Fixo (R$)</span>
              <span className="flex-1 text-center">% Custo Produção</span>
            </div>
            <div className="space-y-1.5">
              {diasAtivos.map((d) => (
                <div key={d.dow} className="flex items-center gap-3">
                  <span className="w-10 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase shrink-0">{d.label}</span>
                  <div className="relative flex-1"><Input inputMode="decimal" className="h-9 pr-6 text-right" placeholder="0" value={cfg.artPct?.[d.dow] || ''} onChange={(e) => setArtPct(d.dow, e.target.value)} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))]">%</span></div>
                  <div className="flex-1"><Input inputMode="decimal" className="h-9 text-right" placeholder="R$ 0,00" value={cfg.artFixo?.[d.dow] || ''} onChange={(e) => setArtFixo(d.dow, e.target.value)} /></div>
                  <div className="relative flex-1"><Input inputMode="decimal" className="h-9 pr-6 text-right" placeholder="0" value={cfg.prodPct?.[d.dow] || ''} onChange={(e) => setProdPct(d.dow, e.target.value)} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))]">%</span></div>
                </div>
              ))}
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
            ) : aba === 'custos' ? (
              confirmandoCustos ? (
                <div className="flex flex-col gap-2 w-full">
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Aplicar a projeção de custos (artístico/produção) em {mesLabel}? Só aparece nos dias sem lançamento real do Conta Azul.</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmandoCustos(false)} disabled={aplicandoCustos}>Cancelar</Button>
                    <Button size="sm" onClick={aplicarCustos} disabled={aplicandoCustos} leftIcon={aplicandoCustos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}>Confirmar</Button>
                  </div>
                </div>
              ) : (
                <>
                  {resultadoCustos && <span className="text-xs mr-auto self-center">{resultadoCustos}</span>}
                  <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
                  <Button onClick={() => { setResultadoCustos(null); setConfirmandoCustos(true); }} disabled={!temCustos} leftIcon={<Check className="h-4 w-4" />}>Aplicar custos ({mesLabel})</Button>
                </>
              )
            ) : confirmando ? (
              <div className="flex flex-col gap-2 w-full">
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Aplicar cenário {cenario.toUpperCase()} na Meta M1 de {mesLabel}?</span>
                {diasManuais > 0 && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-amber-600" checked={preservarManuais} onChange={(e) => setPreservarManuais(e.target.checked)} />
                    <span>Preservar {diasManuais} dia(s) editado(s) manualmente (🔔){preservarManuais ? '' : ' — serão sobrescritos'}</span>
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirmando(false)} disabled={aplicando}>Cancelar</Button>
                  <Button size="sm" onClick={aplicar} disabled={aplicando} leftIcon={aplicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}>
                    Confirmar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 mr-auto">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Cenário:</span>
                  {(['m1', 'm2', 'm3'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCenario(c)}
                      className={`px-2 py-1 rounded text-xs font-medium border ${cenario === c ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--foreground))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                    >
                      {c.toUpperCase()}
                    </button>
                  ))}
                </div>
                <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
                <Button onClick={() => { setResultado(null); setConfirmando(true); }} disabled={!calc.temDados} leftIcon={<Check className="h-4 w-4" />}>
                  Aplicar {cenario.toUpperCase()} ({mesLabel})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
