'use client';

/**
 * RASCUNHO de redesign do Planejamento Comercial.
 *
 * NÃO está no menu nem é fonte de verdade — é um protótipo de layout pra
 * discutir a direção (acabar com o scroll lateral do tabelão Excel).
 * Dados são FICTÍCIOS (seeded, mas realistas nos KPIs reais). Nada vem do banco.
 *
 * CSS escopado em `.pcr` e dark-mode pela classe `.dark` do <html> (padrão do
 * app, tailwind darkMode:'class') — nada vaza pro resto do sistema.
 */

import { useMemo, useState } from 'react';

// ----------------------------- tipos -----------------------------
type St = 'good' | 'bad' | 'warn' | 'none';

interface Dia {
  d: number; dow: number; nome: string; urgente: boolean;
  receita: number; metaM1: number; clientes: number; clPlan: number;
  resTot: number; resP: number; lotMax: number;
  te: number; tePlan: number; tb: number; tbPlan: number; tMedio: number;
  artFat: number; cArt: number; cProd: number; couvert: number; consumacao: number;
  tCoz: number; tBar: number; atrasaoCoz: number; atrasaoBar: number;
  stkDrinks: number; stkComidas: number; fat19h: number;
  mixB: number; mixD: number; mixC: number; cmv: number;
}

interface Agg {
  receita: number; metaM1: number; gap: number;
  clientes: number; clPlan: number; resTot: number; resP: number; ocup: number;
  te: number; tePlan: number; tb: number; tbPlan: number; tMedio: number;
  artFat: number; cArt: number; cProd: number; couvert: number; consumacao: number; couvArt: number;
  tCoz: number; tBar: number; atrasaoCoz: number; atrasaoBar: number;
  stkDrinks: number; stkComidas: number; fat19h: number;
  mixB: number; mixD: number; mixC: number; cmv: number;
}

interface Semana { days: Dia[] }

// --------------------------- constantes --------------------------
const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NOMES = ['Samba do Ordi', 'Pagode da Casa', 'Quinta do Fole', 'DJ Set Rooftop', 'Sexta Sertaneja',
  'Roda de Samba', 'Domingo Ensolarado', 'Segunda Acústica', 'Terça de MPB', 'Forró Pé de Serra',
  'Baile Black', 'Sunset Sessions', 'Feijoada + Roda', 'Karaokê Night'];

const META = {
  t_medio: 93, art_fat: 15, t_coz: 720, t_bar: 240, atrasao_coz: 10, atrasao_bar: 50,
  stk_g: 10, stk_y: 25, fat_19h: 40, couv_art: 1.0,
};

// -------------------------- geração mock -------------------------
function rng(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genMonth(ano: number, mes: number): Dia[] {
  const dias = new Date(ano, mes, 0).getDate();
  const out: Dia[] = [];
  for (let d = 1; d <= dias; d++) {
    const dt = new Date(ano, mes - 1, d);
    const dow = dt.getDay();
    const r = rng(mes * 1000 + d * 37 + 7);
    const p = (a: number, b: number) => a + (b - a) * r();
    const wknd = dow === 5 || dow === 6;
    const dom = dow === 0;
    const seg = dow === 1;
    const baseFat = wknd ? p(34000, 56000) : dom ? p(20000, 32000) : seg ? p(12000, 20000) : p(17000, 30000);
    const receita = Math.round(baseFat);
    const metaM1 = Math.round(baseFat * p(0.86, 1.12));
    const clientes = Math.round(receita / p(72, 104));
    const clPlan = Math.round(clientes * p(0.85, 1.15));
    const lotMax = wknd ? 720 : 560;
    const resTot = Math.round(clientes * p(0.28, 0.5));
    const resP = Math.round(resTot * p(0.6, 0.92));
    const te = Math.round(p(16, 38));
    const tePlan = Math.round(te * p(0.9, 1.15));
    const tb = Math.round(p(58, 118));
    const tbPlan = Math.round(tb * p(0.9, 1.12));
    const tMedio = Math.round(p(78, 112));
    const artFat = +p(8, 21).toFixed(1);
    const cArt = Math.round(receita * artFat / 100);
    const cProd = Math.round(p(900, 4800));
    const couvert = Math.round(cArt * p(0.6, 1.6));
    const consumacao = Math.round(p(150, 1400));
    const tCoz = Math.round(p(520, 900));
    const tBar = Math.round(p(175, 330));
    const atrasaoCoz = Math.round(p(1, 26));
    const atrasaoBar = Math.round(p(18, 88));
    const stkDrinks = +p(2, 30).toFixed(1);
    const stkComidas = +p(2, 30).toFixed(1);
    const fat19h = +p(26, 54).toFixed(1);
    let mixB = p(42, 58); let mixD = p(15, 30); let mixC = p(20, 34);
    const s = mixB + mixD + mixC; mixB = +(mixB / s * 100).toFixed(1); mixD = +(mixD / s * 100).toFixed(1); mixC = +(100 - mixB - mixD).toFixed(1);
    const cmv = +p(27, 38).toFixed(1);
    const urgente = mes === 7 && (d === 11 || d === 25);
    out.push({
      d, dow, nome: urgente ? '' : NOMES[Math.floor(r() * NOMES.length)], urgente,
      receita, metaM1, clientes, clPlan, resTot, resP, lotMax, te, tePlan, tb, tbPlan, tMedio,
      artFat, cArt, cProd, couvert, consumacao, tCoz, tBar, atrasaoCoz, atrasaoBar,
      stkDrinks, stkComidas, fat19h, mixB, mixD, mixC, cmv,
    });
  }
  return out;
}
function groupWeeks(days: Dia[]): Semana[] {
  const weeks: Semana[] = []; let cur: Semana | null = null;
  days.forEach(day => {
    if (!cur || day.dow === 0) { cur = { days: [] }; weeks.push(cur); }
    cur.days.push(day);
  });
  return weeks;
}

// ---------------------------- formato ----------------------------
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const nf = new Intl.NumberFormat('pt-BR');
const brl = (v: number) => brl0.format(v || 0);
const brlK = (v: number) => (v >= 1000 ? 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + 'k' : brl(v));
const pct = (v: number | null) => (v == null ? '—' : v.toFixed(1).replace('.', ',') + '%');
const int = (v: number) => nf.format(Math.round(v || 0));
const minF = (s: number) => (s / 60).toFixed(1).replace('.', ',') + ' min';

// ---------------------------- agregar ----------------------------
function agg(days: Dia[]): Agg {
  const sum = (f: (e: Dia) => number) => days.reduce((s, e) => s + (+f(e) || 0), 0);
  const avg = (f: (e: Dia) => number) => { const v = days.map(f).filter(x => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const receita = sum(e => e.receita); const metaM1 = sum(e => e.metaM1);
  const cArt = sum(e => e.cArt); const couvert = sum(e => e.couvert);
  const ocupVals = days.map(e => e.clientes / e.lotMax * 100).filter(x => x > 0);
  return {
    receita, metaM1, gap: receita - metaM1,
    clientes: sum(e => e.clientes), clPlan: sum(e => e.clPlan), resTot: sum(e => e.resTot), resP: sum(e => e.resP),
    ocup: ocupVals.length ? ocupVals.reduce((a, b) => a + b, 0) / ocupVals.length : 0,
    te: avg(e => e.te), tePlan: avg(e => e.tePlan), tb: avg(e => e.tb), tbPlan: avg(e => e.tbPlan), tMedio: avg(e => e.tMedio),
    artFat: avg(e => e.artFat), cArt, cProd: sum(e => e.cProd), couvert, consumacao: sum(e => e.consumacao),
    couvArt: cArt > 0 ? couvert / cArt : 0,
    tCoz: avg(e => e.tCoz), tBar: avg(e => e.tBar), atrasaoCoz: sum(e => e.atrasaoCoz), atrasaoBar: sum(e => e.atrasaoBar),
    stkDrinks: avg(e => e.stkDrinks), stkComidas: avg(e => e.stkComidas), fat19h: avg(e => e.fat19h),
    mixB: avg(e => e.mixB), mixD: avg(e => e.mixD), mixC: avg(e => e.mixC), cmv: avg(e => e.cmv),
  };
}

const stStk = (v: number): St => (v <= META.stk_g ? 'good' : v <= META.stk_y ? 'warn' : 'bad');

// ---------------------- catálogo de KPIs -------------------------
interface KItem {
  id: string; label: string; fmt: (a: Agg) => string; st: (a: Agg) => St;
  sub: (a: Agg) => string; delta?: (a: Agg) => number; spark?: keyof Dia;
}
interface KSection { name: string; hero?: boolean; items: KItem[] }

const SECTIONS: KSection[] = [
  { name: 'Faturamento', hero: true, items: [
    { id: 'receita', label: 'Receita Real', fmt: a => brl(a.receita), st: a => (a.receita >= a.metaM1 ? 'good' : 'bad'),
      sub: a => 'Meta M1 ' + brlK(a.metaM1), delta: a => (a.metaM1 ? (a.receita - a.metaM1) / a.metaM1 * 100 : 0), spark: 'receita' },
    { id: 'clientes', label: 'Clientes', fmt: a => int(a.clientes), st: a => (a.clientes >= a.clPlan ? 'good' : 'bad'),
      sub: a => 'Plano ' + int(a.clPlan), delta: a => (a.clPlan ? (a.clientes - a.clPlan) / a.clPlan * 100 : 0), spark: 'clientes' },
    { id: 'tMedio', label: 'Ticket Médio', fmt: a => brl(a.tMedio), st: a => (a.tMedio >= META.t_medio ? 'good' : 'bad'),
      sub: () => 'Meta ' + brl(META.t_medio), delta: a => (a.tMedio - META.t_medio) / META.t_medio * 100, spark: 'tMedio' },
  ] },
  { name: 'Público e Reservas', items: [
    { id: 'ocup', label: 'Ocupação', fmt: a => pct(a.ocup), st: a => (a.ocup >= 75 ? 'good' : a.ocup >= 55 ? 'warn' : 'bad'), sub: () => 'sobre a lotação' },
    { id: 'resTot', label: 'Reservas Total', fmt: a => int(a.resTot), st: () => 'none', sub: a => int(a.resP) + ' presentes' },
    { id: 'resP', label: 'Reservas Presentes', fmt: a => int(a.resP), st: () => 'none', sub: a => (a.resTot ? (a.resP / a.resTot * 100).toFixed(0) + '% de comparecimento' : '—') },
  ] },
  { name: 'Ticket', items: [
    { id: 'te', label: 'Ticket Entrada', fmt: a => brl(a.te), st: a => (a.te >= a.tePlan ? 'good' : 'bad'), sub: a => 'Plano ' + brl(a.tePlan) },
    { id: 'tb', label: 'Ticket Bar', fmt: a => brl(a.tb), st: a => (a.tb >= a.tbPlan ? 'good' : 'bad'), sub: a => 'Plano ' + brl(a.tbPlan) },
  ] },
  { name: 'Artístico', items: [
    { id: 'artFat', label: 'Art / Fat', fmt: a => pct(a.artFat), st: a => (a.artFat <= META.art_fat ? 'good' : 'bad'), sub: () => 'meta até ' + META.art_fat + '%', spark: 'artFat' },
    { id: 'cArt', label: 'Custo Artístico', fmt: a => brl(a.cArt), st: () => 'none', sub: () => 'no período' },
    { id: 'cProd', label: 'Custo Produção', fmt: a => brl(a.cProd), st: () => 'none', sub: () => 'no período' },
    { id: 'couvert', label: 'Couvert', fmt: a => brl(a.couvert), st: () => 'none', sub: () => 'arrecadado' },
    { id: 'couvArt', label: 'Couvert / Art', fmt: a => a.couvArt.toFixed(2).replace('.', ',') + '×', st: a => (a.couvArt >= META.couv_art ? 'good' : 'bad'), sub: () => 'meta a partir de 1,0×' },
    { id: 'consumacao', label: 'Consumação', fmt: a => brl(a.consumacao), st: () => 'none', sub: () => 'artistas' },
  ] },
  { name: 'Operação', items: [
    { id: 'tCoz', label: 'Tempo Cozinha', fmt: a => minF(a.tCoz), st: a => (a.tCoz <= META.t_coz ? 'good' : 'bad'), sub: () => 'meta até 12 min' },
    { id: 'tBar', label: 'Tempo Bar', fmt: a => minF(a.tBar), st: a => (a.tBar <= META.t_bar ? 'good' : 'bad'), sub: () => 'meta até 4 min' },
    { id: 'atrasaoCoz', label: 'Atrasão Coz', fmt: a => int(a.atrasaoCoz), st: a => (a.atrasaoCoz <= META.atrasao_coz ? 'good' : 'bad'), sub: () => 'meta até 10' },
    { id: 'atrasaoBar', label: 'Atrasão Bar', fmt: a => int(a.atrasaoBar), st: a => (a.atrasaoBar <= META.atrasao_bar ? 'good' : 'bad'), sub: () => 'meta até 50' },
    { id: 'stkDrinks', label: 'Stockout Drinks', fmt: a => pct(a.stkDrinks), st: a => stStk(a.stkDrinks), sub: () => 'verde até 10%' },
    { id: 'stkComidas', label: 'Stockout Comidas', fmt: a => pct(a.stkComidas), st: a => stStk(a.stkComidas), sub: () => 'verde até 10%' },
    { id: 'fat19h', label: 'Fat até 19h', fmt: a => pct(a.fat19h), st: a => (a.fat19h >= META.fat_19h ? 'good' : 'bad'), sub: () => 'meta a partir de 40%', spark: 'fat19h' },
    { id: 'cmv', label: 'CMV Teórico', fmt: a => pct(a.cmv), st: () => 'none', sub: () => 'ficha × vendas' },
    { id: 'mixB', label: 'Mix — Bebida', fmt: a => pct(a.mixB), st: () => 'none', sub: a => 'drink ' + pct(a.mixD) + ' · com ' + pct(a.mixC) },
  ] },
];

const CHIP_KPIS: { id: string; l: string; f: (a: Agg) => string; st: (a: Agg) => St }[] = [
  { id: 'receita', l: 'Fat', f: a => brlK(a.receita), st: a => (a.receita >= a.metaM1 ? 'good' : 'bad') },
  { id: 'clientes', l: 'Cli', f: a => int(a.clientes), st: a => (a.clientes >= a.clPlan ? 'good' : 'bad') },
  { id: 'tMedio', l: 'T.Méd', f: a => brl(a.tMedio), st: a => (a.tMedio >= META.t_medio ? 'good' : 'bad') },
  { id: 'artFat', l: 'Art/Fat', f: a => pct(a.artFat), st: a => (a.artFat <= META.art_fat ? 'good' : 'bad') },
  { id: 'couvArt', l: 'Couv/Art', f: a => a.couvArt.toFixed(1).replace('.', ',') + '×', st: a => (a.couvArt >= META.couv_art ? 'good' : 'bad') },
  { id: 'tCoz', l: 'Coz', f: a => minF(a.tCoz), st: a => (a.tCoz <= META.t_coz ? 'good' : 'bad') },
  { id: 'tBar', l: 'Bar', f: a => minF(a.tBar), st: a => (a.tBar <= META.t_bar ? 'good' : 'bad') },
  { id: 'stkDrinks', l: 'Stk Drk', f: a => pct(a.stkDrinks), st: a => stStk(a.stkDrinks) },
  { id: 'stkComidas', l: 'Stk Com', f: a => pct(a.stkComidas), st: a => stStk(a.stkComidas) },
  { id: 'fat19h', l: '19h', f: a => pct(a.fat19h), st: a => (a.fat19h >= META.fat_19h ? 'good' : 'bad') },
];

// --------------------------- sparkline ---------------------------
function Spark({ values, stat, id }: { values: number[]; stat: St; id: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values); const max = Math.max(...values); const rg = (max - min) || 1;
  const W = 180; const H = 30; const pad = 3;
  const stepX = (W - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [pad + i * stepX, H - pad - (v - min) / rg * (H - pad * 2)] as [number, number]);
  const line = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  const col = stat === 'good' ? 'var(--pc-good)' : stat === 'bad' ? 'var(--pc-bad)' : stat === 'warn' ? 'var(--pc-warn)' : 'var(--pc-accent)';
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity="0.22" />
          <stop offset="1" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={col} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.4" fill={col} />
    </svg>
  );
}

function DeltaTag({ d }: { d: number }) {
  if (d == null || !isFinite(d)) return null;
  const v = Math.abs(d) < 0.05 ? 0 : d;
  const cls = v > 0 ? 'good' : v < 0 ? 'bad' : 'flat';
  const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '•';
  return <span className={`kdelta ${cls}`}>{arrow} {Math.abs(v).toFixed(0)}%</span>;
}

const CMAP: Record<St, string> = { good: 'var(--pc-good)', bad: 'var(--pc-bad)', warn: 'var(--pc-warn)', none: 'var(--pc-line-strong)' };

// =============================== app =============================
export default function RascunhoClient() {
  const [mes, setMes] = useState(7);
  const [mode, setMode] = useState<'semana' | 'mes'>('semana');
  const [week, setWeek] = useState(0); // -1 = mês inteiro
  const [day, setDay] = useState(0);

  const days = useMemo(() => genMonth(2026, mes), [mes]);
  const weeks = useMemo(() => groupWeeks(days), [days]);

  const isAll = week === -1;
  const wk = weeks[Math.min(week, weeks.length - 1)] || { days: [] };
  const viewDays = isAll ? days : wk.days;
  const a = useMemo(() => agg(viewDays), [viewDays]);

  const dayIdx = Math.min(day, viewDays.length - 1);
  const dsel = viewDays[dayIdx] || viewDays[0];

  const setMonth = (m: number) => { setMes(m); setWeek(0); setDay(0); };
  const fmtRange = (w: Semana) => `${String(w.days[0].d).padStart(2, '0')}–${String(w.days[w.days.length - 1].d).padStart(2, '0')}`;

  return (
    <div className="pcr">
      <style>{PCR_CSS}</style>

      {/* header da página */}
      <div className="pc-head">
        <div className="pc-title">
          <h2>Planejamento Comercial</h2>
          <span className="draft-badge">RASCUNHO</span>
        </div>
        <div className="pc-controls">
          <div className="monthnav">
            <button onClick={() => setMonth(mes === 7 ? 6 : 7)} aria-label="Mês anterior">‹</button>
            <div className="mlabel">{MESES[mes - 1]} 2026</div>
            <button onClick={() => setMonth(mes === 6 ? 7 : 6)} aria-label="Próximo mês">›</button>
          </div>
          <div className="modetoggle" role="group" aria-label="Modo de visualização">
            <button aria-pressed={mode === 'semana'} onClick={() => setMode('semana')}>Semana</button>
            <button aria-pressed={mode === 'mes'} onClick={() => setMode('mes')}>Mês</button>
          </div>
        </div>
      </div>

      {mode === 'semana' ? (
        <>
          <div className="weekbar">
            <button className="weekchip allchip" aria-pressed={isAll} onClick={() => { setWeek(-1); setDay(0); }}>
              <b>Mês inteiro</b><small>{days.length} dias</small>
            </button>
            {weeks.map((w, i) => (
              <button key={i} className="weekchip" aria-pressed={!isAll && i === week} onClick={() => { setWeek(i); setDay(0); }}>
                <b>Semana {i + 1}</b><small>{fmtRange(w)} · {w.days.length}d</small>
              </button>
            ))}
            <span className="hint">Cards são só leitura neste rascunho ✦</span>
          </div>

          {SECTIONS.map(sec => (
            <div key={sec.name}>
              <div className="sectionlabel">{sec.name}</div>
              <div className={`kgrid ${sec.hero ? 'hero' : ''}`}>
                {sec.items.map(it => {
                  const st = it.st(a);
                  const sparkVals = it.spark ? viewDays.map(dd => dd[it.spark as keyof Dia] as number) : null;
                  return (
                    <div key={it.id} className={`kpi s-${st} ${sec.hero ? 'big' : ''}`}>
                      <div className="kstripe" />
                      <div className="klabel"><span>{it.label}</span></div>
                      <div className="krow">
                        <div className="kval">{it.fmt(a)}</div>
                        {it.delta ? <DeltaTag d={it.delta(a)} /> : null}
                      </div>
                      <div className="ksub">{it.sub(a)}</div>
                      {sparkVals ? <Spark values={sparkVals} stat={st} id={`sp-${mes}-${week}-${it.id}`} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="sectionlabel">Furar por dia</div>
          <div className="daybar">
            {viewDays.map((dd, i) => (
              <button key={dd.d} className="daycell" aria-pressed={i === dayIdx} onClick={() => setDay(i)}>
                <small>{DOW[dd.dow]}</small>
                <b className={dd.urgente ? 'flag' : ''}>{String(dd.d).padStart(2, '0')}</b>
                <span className="df">{brlK(dd.receita)}</span>
              </button>
            ))}
          </div>
          {dsel ? <DayPanel d={dsel} mes={mes} /> : null}
        </>
      ) : (
        <>
          <div className="sectionlabel" style={{ marginTop: 18 }}>Visão do mês — desça e veja o que variou por semana</div>
          {weeks.map((w, i) => {
            const wa = agg(w.days);
            const gpos = wa.gap >= 0;
            return (
              <div key={i} className="weekband">
                <div className="wb-head" onClick={() => { setMode('semana'); setWeek(i); setDay(0); }}>
                  <div className="wb-badge">S{i + 1}</div>
                  <div className="wb-title">
                    <b>Semana {i + 1}</b>
                    <small>{fmtRange(w)} · {w.days.length} dias</small>
                  </div>
                  <div className="wb-fat">
                    <div className="v">{brl(wa.receita)}</div>
                    <div className="g" style={{ color: gpos ? 'var(--pc-good)' : 'var(--pc-bad)' }}>
                      {gpos ? '▲' : '▼'} {brlK(Math.abs(wa.gap))} vs Meta {brlK(wa.metaM1)}
                    </div>
                  </div>
                </div>
                <div className="wb-chips">
                  {CHIP_KPIS.map(c => (
                    <span key={c.id} className={`chip ${c.st(wa)}`}>
                      <span className="dot" />{c.l} <span className="cv">{c.f(wa)}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="footnote">
            Cada faixa é uma semana. Os chips ficam verdes ou vermelhos conforme a meta — bate o olho e vê onde a semana furou. Clique numa faixa pra abrir o resumo dela.
          </p>
        </>
      )}

      {/* planilha completa como drill-down opcional */}
      <details className="sheet">
        <summary><span className="chev">›</span> Ver planilha completa (edição)</summary>
        <div className="sheetscroll"><Sheet days={days} /></div>
      </details>

      <p className="footnote">
        Rascunho de layout · dados fictícios · Ordinário Bar · {MESES[mes - 1]}/2026. A ideia é acabar com o scroll lateral:
        <b> Semana</b> resume 1 card por KPI + drill por dia; <b>Mês</b> empilha as semanas pra comparar o que variou; a planilha vira drill-down opcional.
      </p>
    </div>
  );
}

function DayPanel({ d, mes }: { d: Dia; mes: number }) {
  const items: [string, string, St][] = [
    ['Receita', brl(d.receita), d.receita >= d.metaM1 ? 'good' : 'bad'],
    ['Meta M1', brl(d.metaM1), 'none'],
    ['Clientes', int(d.clientes), d.clientes >= d.clPlan ? 'good' : 'bad'],
    ['Reservas', int(d.resP) + '/' + int(d.resTot), 'none'],
    ['Ticket Médio', brl(d.tMedio), d.tMedio >= META.t_medio ? 'good' : 'bad'],
    ['Ticket Entrada', brl(d.te), d.te >= d.tePlan ? 'good' : 'bad'],
    ['Ticket Bar', brl(d.tb), d.tb >= d.tbPlan ? 'good' : 'bad'],
    ['Art / Fat', pct(d.artFat), d.artFat <= META.art_fat ? 'good' : 'bad'],
    ['Custo Art', brl(d.cArt), 'none'],
    ['Couvert', brl(d.couvert), 'none'],
    ['Tempo Cozinha', minF(d.tCoz), d.tCoz <= META.t_coz ? 'good' : 'bad'],
    ['Tempo Bar', minF(d.tBar), d.tBar <= META.t_bar ? 'good' : 'bad'],
    ['Atrasão Coz', int(d.atrasaoCoz), d.atrasaoCoz <= META.atrasao_coz ? 'good' : 'bad'],
    ['Stockout Drinks', pct(d.stkDrinks), stStk(d.stkDrinks)],
    ['Stockout Comidas', pct(d.stkComidas), stStk(d.stkComidas)],
    ['Fat até 19h', pct(d.fat19h), d.fat19h >= META.fat_19h ? 'good' : 'bad'],
    ['Mix B/D/C', pct(d.mixB) + ' · ' + pct(d.mixD) + ' · ' + pct(d.mixC), 'none'],
    ['CMV Teórico', pct(d.cmv), 'none'],
  ];
  return (
    <div className="daypanel">
      <div className="dp-head">
        <h3>{d.nome || 'Sem atração definida'}</h3>
        <span className="sub">
          {DOW[d.dow]} · {String(d.d).padStart(2, '0')}/{String(mes).padStart(2, '0')}/2026
          {d.urgente ? <b style={{ color: 'var(--pc-bad)' }}> · ⚑ pendência</b> : null}
        </span>
      </div>
      <div className="dp-grid">
        {items.map(([l, v, s]) => (
          <div key={l} className="dp-item">
            <div className="l">{l}</div>
            <div className="v"><span className="pt" style={{ background: CMAP[s] }} />{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sheet({ days }: { days: Dia[] }) {
  const cols: [string, keyof Dia, string][] = [
    ['Receita', 'receita', 'r'], ['Meta', 'metaM1', 'r'], ['Cli', 'clientes', 'i'], ['T.Méd', 'tMedio', 'r'],
    ['%Art', 'artFat', 'p'], ['C.Art', 'cArt', 'r'], ['Couv', 'couvert', 'r'], ['Coz', 'tCoz', 'm'], ['Bar', 'tBar', 'm'],
    ['Atr.Coz', 'atrasaoCoz', 'i'], ['Stk.Drk', 'stkDrinks', 'p'], ['Stk.Com', 'stkComidas', 'p'], ['19h', 'fat19h', 'p'], ['CMV', 'cmv', 'p'],
  ];
  const fmt = (v: number, t: string) => (t === 'r' ? brl(v) : t === 'i' ? int(v) : t === 'p' ? pct(v) : t === 'm' ? minF(v) : String(v));
  return (
    <table className="mini">
      <thead>
        <tr>
          <th className="lft">Dia</th><th className="lft">Label</th>
          {cols.map(c => <th key={c[0]}>{c[0]}</th>)}
        </tr>
      </thead>
      <tbody>
        {days.map(d => (
          <tr key={d.d}>
            <td className="lft" style={d.urgente ? { color: 'var(--pc-bad)' } : undefined}>{DOW[d.dow]} {String(d.d).padStart(2, '0')}</td>
            <td className="lft nm">{d.nome || '—'}</td>
            {cols.map(c => {
              let cls = '';
              if (c[1] === 'receita') cls = d.receita >= d.metaM1 ? 'cellgood' : 'cellbad';
              if (c[1] === 'tMedio') cls = d.tMedio >= META.t_medio ? 'cellgood' : 'cellbad';
              if (c[1] === 'artFat') cls = d.artFat <= META.art_fat ? 'cellgood' : 'cellbad';
              return <td key={c[0]} className={cls}>{fmt(d[c[1]] as number, c[2])}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================== css ==============================
const PCR_CSS = `
.pcr {
  --pc-bg: transparent;
  --pc-card: #ffffff; --pc-card-2: #f8f9fb;
  --pc-line: #e4e7ee; --pc-line-strong: #d3d8e2;
  --pc-ink: #1a2130; --pc-ink-2: #5a6478; --pc-ink-3: #8b94a7;
  --pc-accent: #4f63d2; --pc-accent-soft: #eaedfb;
  --pc-good: #16a34a; --pc-good-soft: #e4f6ea;
  --pc-warn: #c47d10; --pc-warn-soft: #fbf1dd;
  --pc-bad: #dc2f34; --pc-bad-soft: #fbe6e6;
  --pc-shadow: 0 1px 2px rgba(20,28,50,.05), 0 4px 16px rgba(20,28,50,.05);
  --pc-radius: 14px;
  color: var(--pc-ink);
  font-variant-numeric: tabular-nums;
  padding-bottom: 40px;
}
.dark .pcr {
  --pc-card: #141b27; --pc-card-2: #0f1520;
  --pc-line: #232c3b; --pc-line-strong: #2e394b;
  --pc-ink: #e8ecf4; --pc-ink-2: #9aa5b8; --pc-ink-3: #667089;
  --pc-accent: #7d8ff0; --pc-accent-soft: #1c2340;
  --pc-good: #3ecf7e; --pc-good-soft: #12281d;
  --pc-warn: #e0a53a; --pc-warn-soft: #2c2410;
  --pc-bad: #f26b6f; --pc-bad-soft: #2c1518;
  --pc-shadow: 0 1px 2px rgba(0,0,0,.3), 0 6px 20px rgba(0,0,0,.35);
}
.pcr * { box-sizing: border-box; }
.pcr .tnum { font-variant-numeric: tabular-nums; }

.pcr .pc-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
.pcr .pc-title { display: flex; align-items: center; gap: 10px; }
.pcr .pc-title h2 { margin: 0; font-size: 20px; font-weight: 750; letter-spacing: -.02em; }
.pcr .draft-badge { font-size: 10px; font-weight: 700; letter-spacing: .08em; color: var(--pc-warn);
  background: var(--pc-warn-soft); border: 1px solid color-mix(in srgb, var(--pc-warn) 30%, transparent);
  padding: 3px 8px; border-radius: 999px; }
.pcr .pc-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.pcr .monthnav { display: flex; align-items: center; gap: 2px; background: var(--pc-card);
  border: 1px solid var(--pc-line); border-radius: 10px; padding: 2px; }
.pcr .monthnav button { border: 0; background: transparent; color: var(--pc-ink-2); cursor: pointer;
  width: 30px; height: 30px; border-radius: 8px; font-size: 16px; display: grid; place-items: center; }
.pcr .monthnav button:hover { background: var(--pc-card-2); color: var(--pc-ink); }
.pcr .monthnav .mlabel { min-width: 118px; text-align: center; font-weight: 650; font-size: 13.5px; text-transform: capitalize; }

.pcr .modetoggle { display: flex; background: var(--pc-card); border: 1px solid var(--pc-line); border-radius: 10px; padding: 3px; gap: 3px; }
.pcr .modetoggle button { border: 0; background: transparent; color: var(--pc-ink-2); cursor: pointer;
  padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
.pcr .modetoggle button[aria-pressed="true"] { background: var(--pc-accent); color: #fff; box-shadow: var(--pc-shadow); }

.pcr .weekbar { display: flex; gap: 8px; flex-wrap: wrap; margin: 18px 0 6px; align-items: center; }
.pcr .weekchip { border: 1px solid var(--pc-line); background: var(--pc-card); color: var(--pc-ink-2);
  border-radius: 11px; padding: 8px 13px; cursor: pointer; text-align: left; line-height: 1.2; box-shadow: var(--pc-shadow); }
.pcr .weekchip b { display: block; font-size: 13.5px; color: var(--pc-ink); font-weight: 700; }
.pcr .weekchip small { font-size: 10.5px; color: var(--pc-ink-3); }
.pcr .weekchip[aria-pressed="true"] { border-color: var(--pc-accent); background: var(--pc-accent-soft); box-shadow: 0 0 0 1px var(--pc-accent) inset; }
.pcr .weekchip[aria-pressed="true"] b { color: var(--pc-accent); }
.pcr .hint { font-size: 12px; color: var(--pc-ink-3); margin-left: auto; }

.pcr .sectionlabel { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: var(--pc-ink-3); margin: 24px 2px 10px; display: flex; align-items: center; gap: 8px; }
.pcr .sectionlabel::after { content: ""; flex: 1; height: 1px; background: var(--pc-line); }

.pcr .kgrid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.pcr .kgrid.hero { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.pcr .kpi { background: var(--pc-card); border: 1px solid var(--pc-line); border-radius: var(--pc-radius);
  padding: 13px 14px 11px; box-shadow: var(--pc-shadow); position: relative; overflow: hidden; }
.pcr .kpi .kstripe { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.pcr .kpi.s-good .kstripe { background: var(--pc-good); }
.pcr .kpi.s-warn .kstripe { background: var(--pc-warn); }
.pcr .kpi.s-bad .kstripe { background: var(--pc-bad); }
.pcr .kpi.s-none .kstripe { background: var(--pc-line-strong); }
.pcr .klabel { font-size: 11.5px; color: var(--pc-ink-2); font-weight: 600; margin-bottom: 3px;
  display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.pcr .kval { font-size: 22px; font-weight: 750; letter-spacing: -.02em; line-height: 1.1; }
.pcr .kpi.big .kval { font-size: 27px; }
.pcr .ksub { font-size: 11.5px; color: var(--pc-ink-3); margin-top: 2px; }
.pcr .krow { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
.pcr .kdelta { font-size: 11.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.pcr .kdelta.good { color: var(--pc-good); background: var(--pc-good-soft); }
.pcr .kdelta.bad { color: var(--pc-bad); background: var(--pc-bad-soft); }
.pcr .kdelta.flat { color: var(--pc-ink-3); background: var(--pc-card-2); }
.pcr .spark { margin-top: 9px; height: 30px; width: 100%; display: block; }

.pcr .weekband { background: var(--pc-card); border: 1px solid var(--pc-line); border-radius: var(--pc-radius);
  box-shadow: var(--pc-shadow); margin-bottom: 12px; overflow: hidden; }
.pcr .wb-head { display: flex; align-items: center; gap: 14px; padding: 14px 16px; cursor: pointer;
  border-bottom: 1px solid var(--pc-line); flex-wrap: wrap; }
.pcr .wb-head:hover { background: var(--pc-card-2); }
.pcr .wb-badge { width: 42px; height: 42px; border-radius: 11px; background: var(--pc-accent-soft); color: var(--pc-accent);
  display: grid; place-items: center; font-weight: 800; font-size: 15px; flex: none; }
.pcr .wb-title b { font-size: 14.5px; font-weight: 700; }
.pcr .wb-title small { display: block; font-size: 11px; color: var(--pc-ink-3); }
.pcr .wb-fat { margin-left: auto; text-align: right; }
.pcr .wb-fat .v { font-size: 18px; font-weight: 750; letter-spacing: -.02em; }
.pcr .wb-fat .g { font-size: 11.5px; font-weight: 700; }
.pcr .wb-chips { display: flex; flex-wrap: wrap; gap: 7px; padding: 13px 16px; }
.pcr .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600;
  border: 1px solid var(--pc-line); border-radius: 999px; padding: 4px 10px 4px 8px; color: var(--pc-ink-2); background: var(--pc-card-2); }
.pcr .chip .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--pc-line-strong); }
.pcr .chip .cv { color: var(--pc-ink); font-weight: 700; }
.pcr .chip.good { border-color: color-mix(in srgb, var(--pc-good) 35%, transparent); }
.pcr .chip.good .dot { background: var(--pc-good); }
.pcr .chip.bad { border-color: color-mix(in srgb, var(--pc-bad) 35%, transparent); }
.pcr .chip.bad .dot { background: var(--pc-bad); }
.pcr .chip.warn { border-color: color-mix(in srgb, var(--pc-warn) 35%, transparent); }
.pcr .chip.warn .dot { background: var(--pc-warn); }

.pcr .daybar { display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 8px; }
.pcr .daycell { flex: none; border: 1px solid var(--pc-line); background: var(--pc-card); border-radius: 10px;
  padding: 7px 9px; min-width: 54px; text-align: center; cursor: pointer; line-height: 1.15; }
.pcr .daycell small { font-size: 9.5px; color: var(--pc-ink-3); text-transform: uppercase; font-weight: 700; letter-spacing: .04em; }
.pcr .daycell b { display: block; font-size: 15px; font-weight: 700; }
.pcr .daycell .df { font-size: 10px; color: var(--pc-ink-3); font-weight: 600; }
.pcr .daycell[aria-pressed="true"] { border-color: var(--pc-accent); background: var(--pc-accent-soft); }
.pcr .daycell[aria-pressed="true"] b, .pcr .daycell[aria-pressed="true"] small { color: var(--pc-accent); }
.pcr .daycell .flag { color: var(--pc-bad); }

.pcr .daypanel { background: var(--pc-card); border: 1px solid var(--pc-line); border-radius: var(--pc-radius);
  box-shadow: var(--pc-shadow); padding: 16px; margin-top: 10px; }
.pcr .dp-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.pcr .dp-head h3 { margin: 0; font-size: 17px; font-weight: 750; letter-spacing: -.01em; }
.pcr .dp-head .sub { color: var(--pc-ink-3); font-size: 12.5px; }
.pcr .dp-grid { display: grid; gap: 10px 18px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.pcr .dp-item { border-bottom: 1px dashed var(--pc-line); padding-bottom: 7px; }
.pcr .dp-item .l { font-size: 11px; color: var(--pc-ink-3); font-weight: 600; }
.pcr .dp-item .v { font-size: 15.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.pcr .dp-item .v .pt { width: 7px; height: 7px; border-radius: 50%; }

.pcr .sheet { margin-top: 30px; border: 1px solid var(--pc-line); border-radius: var(--pc-radius);
  background: var(--pc-card); box-shadow: var(--pc-shadow); overflow: hidden; }
.pcr .sheet summary { padding: 13px 16px; cursor: pointer; font-weight: 650; font-size: 13.5px; color: var(--pc-ink-2);
  list-style: none; display: flex; align-items: center; gap: 8px; }
.pcr .sheet summary::-webkit-details-marker { display: none; }
.pcr .sheet summary .chev { transition: transform .2s; display: inline-block; }
.pcr .sheet[open] summary .chev { transform: rotate(90deg); }
.pcr .sheetscroll { overflow-x: auto; }
.pcr table.mini { border-collapse: collapse; width: 100%; font-size: 11.5px; white-space: nowrap; }
.pcr table.mini th, .pcr table.mini td { padding: 6px 9px; border-bottom: 1px solid var(--pc-line); text-align: right; }
.pcr table.mini th { color: var(--pc-ink-3); font-weight: 700; text-transform: uppercase; font-size: 9.5px; letter-spacing: .04em;
  position: sticky; top: 0; background: var(--pc-card-2); }
.pcr table.mini td.lft, .pcr table.mini th.lft { text-align: left; position: sticky; left: 0; background: var(--pc-card); }
.pcr table.mini th.lft { background: var(--pc-card-2); z-index: 2; }
.pcr table.mini td.nm { color: var(--pc-ink-2); max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
.pcr table.mini tr:hover td { background: var(--pc-card-2); }
.pcr .cellgood { color: var(--pc-good); font-weight: 700; }
.pcr .cellbad { color: var(--pc-bad); font-weight: 700; }

.pcr .footnote { color: var(--pc-ink-3); font-size: 12px; margin: 20px 4px 0; line-height: 1.5; }
.pcr .footnote b { color: var(--pc-ink-2); }

@media (max-width: 640px) {
  .pcr .wb-fat { margin-left: 0; text-align: left; width: 100%; order: 3; }
  .pcr .monthnav .mlabel { min-width: 92px; font-size: 12px; }
  .pcr .hint { display: none; }
  .pcr .pc-controls { width: 100%; }
}
`;
