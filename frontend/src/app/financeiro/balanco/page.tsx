'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from 'lucide-react';

const n = (x: unknown) => Number(x) || 0;
const fmtBRL = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtNum = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAMPOS_MANUAIS = new Set([
  'caixa_investimentos', 'emprestimos_cp_receber', 'estoques', 'imobilizado_inicial', 'imobilizado_liq',
  'investimentos_aprovados_a_fazer', 'financiamentos_lp', 'provisoes_fiscais_eventos', 'provisoes_trabalhistas',
  'patrimonio_liquido', 'investimentos_aprovados',
]);

export default function BalancoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const hoje = new Date();
  // default = último mês fechado
  const [ano, setAno] = useState(hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() === 0 ? 12 : hoje.getMonth()); // mês anterior (1-12)
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/financeiro/balanco?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`, { cache: 'no-store' });
      setData(await r.json());
    } finally { setLoading(false); }
  }, [selectedBar?.id, ano, mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (campo: string) => {
    if (!selectedBar?.id) return;
    const valor = parseFloat(editVal.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
    setEditKey(null);
    await fetch('/api/financeiro/balanco', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bar_id: selectedBar.id, ano, mes, campo, valor }),
    });
    toast({ title: 'Salvo' });
    carregar();
  };

  const calc = useMemo(() => {
    const ca = data?.ca || {}, man = data?.manual || {}, caAnt = data?.caAnt || {}, manAnt = data?.manualAnt || {};
    const bloco = (ca: any) => {
      const blocks = ['pc_artistas_producao', 'pc_fornecedores_cmv', 'pc_adm_mkt', 'pc_operacionais', 'pc_ocupacao', 'pc_cmo_comissao', 'pc_investimentos', 'pc_impostos'];
      const soma8 = blocks.reduce((s, k) => s + n(ca[k]), 0);
      const outras = n(ca.pc_total_despesas) - soma8;
      const pc = outras + soma8;
      return { soma8, outras, pc };
    };
    const ncgFornDe = (ca: any, man: any) => (n(ca.contas_receber) + n(man.emprestimos_cp_receber) + n(man.estoques)) - n(ca.pc_fornecedores_cmv);

    const receitaLiq = n(ca.receita_liquida), cmv = Math.abs(n(ca.cmv));
    const contasReceber = n(ca.contas_receber);
    const caixaInv = n(man.caixa_investimentos), emprestimosCP = n(man.emprestimos_cp_receber), estoques = n(man.estoques);
    const ativoCirc = caixaInv + contasReceber + emprestimosCP + estoques;
    const ativoNaoCirc = n(man.imobilizado_inicial) + n(man.imobilizado_liq);
    const ativoTotal = ativoCirc + ativoNaoCirc;

    const { outras, pc: passivoCirc } = bloco(ca);
    const passivoNaoCirc = n(man.investimentos_aprovados_a_fazer) + n(man.financiamentos_lp) + n(man.provisoes_fiscais_eventos) + n(man.provisoes_trabalhistas) + n(man.patrimonio_liquido);
    const passivoTotal = passivoCirc + passivoNaoCirc;
    const fornCmv = n(ca.pc_fornecedores_cmv);

    const liq = (x: number) => passivoCirc > 0 ? x / passivoCirc : 0;
    const ncgForn = ncgFornDe(ca, man);
    return {
      receitaLiq, lucroLiq: n(ca.lucro_liquido), cmv, cmc: Math.abs(n(ca.cmc)),
      caixaInv, contasReceber, emprestimosCP, estoques, ativoCirc, ativoNaoCirc, ativoTotal,
      outras, fornCmv, passivoCirc, passivoNaoCirc, passivoTotal,
      ncgForn, ncgPC: ativoCircSemCaixa(contasReceber, emprestimosCP, estoques) - passivoCirc,
      saldoTes: caixaInv,
      liqCorrente: liq(ativoCirc), liqImediata: liq(caixaInv), liqSeca: liq(caixaInv + contasReceber),
      caixaLiquido: caixaInv + emprestimosCP - passivoNaoCirc + n(man.patrimonio_liquido),
      pmeC: cmv > 0 ? estoques / cmv * 30 : 0, pmrC: receitaLiq > 0 ? contasReceber / receitaLiq * 30 : 0, pmpC: cmv > 0 ? fornCmv / cmv * 30 : 0,
      pmeD: receitaLiq > 0 ? estoques / receitaLiq * 30 : 0, pmrD: receitaLiq > 0 ? contasReceber / receitaLiq * 30 : 0, pmpD: receitaLiq > 0 ? fornCmv / receitaLiq * 30 : 0,
      capitalGiro: passivoNaoCirc - ativoNaoCirc,
      dividendos: n(ca.dividendos_pagos),
      variacaoNcg: ncgForn - ncgFornDe(caAnt, manAnt),
      ca, man,
    };
  }, [data]);

  if (loading) return <main className="max-w-4xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  // Helpers de render
  const Lin = ({ label, val, tipo = 'calc', campo, bold = false, indent = false }: { label: string; val: number; tipo?: 'ca' | 'manual' | 'calc'; campo?: string; bold?: boolean; indent?: boolean }) => {
    const editando = editKey === campo;
    const cor = tipo === 'ca' ? 'border-l-orange-400' : tipo === 'manual' ? 'border-l-blue-400' : 'border-l-gray-300';
    return (
      <div className={`flex items-center justify-between gap-2 px-2 py-1 border-l-2 ${cor} ${bold ? 'font-bold bg-gray-50 dark:bg-gray-800/50' : ''} ${indent ? 'pl-5' : ''}`}>
        <span className="text-xs">{label}</span>
        {tipo === 'manual' && campo ? (
          editando ? (
            <input autoFocus defaultValue={String(val)} onChange={e => setEditVal(e.target.value)}
              onBlur={() => salvar(campo)} onKeyDown={e => { if (e.key === 'Enter') salvar(campo); if (e.key === 'Escape') setEditKey(null); }}
              className="w-28 h-6 text-xs text-right border rounded px-1" />
          ) : (
            <button className="text-xs tabular-nums text-blue-600 hover:underline" onClick={() => { setEditKey(campo); setEditVal(String(val)); }}>{fmtBRL(val)}</button>
          )
        ) : (
          <span className={`text-xs tabular-nums ${val < 0 ? 'text-red-600' : ''}`}>{fmtBRL(val)}</span>
        )}
      </div>
    );
  };

  const c = calc;
  const anos = Array.from({ length: hoje.getFullYear() - 2023 }, (_, i) => hoje.getFullYear() - i);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="w-6 h-6 text-indigo-600" /> Balanço Patrimonial</h1>
        <div className="flex gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-gray-800">
            {MES_ABBR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-gray-800">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">Foto do último dia de {MES_ABBR[mes - 1]}/{ano}. <span className="text-orange-500">●</span> Conta Azul · <span className="text-blue-500">●</span> manual (clique p/ editar) · <span className="text-gray-400">●</span> cálculo.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-3">
          <h3 className="text-sm font-bold mb-1">Topo (DRE do mês)</h3>
          <Lin label="Receita Líquida" val={c.receitaLiq} tipo="ca" />
          <Lin label="Lucro Líquido" val={c.lucroLiq} tipo="ca" />
          <Lin label="CMV" val={c.cmv} tipo="ca" />
          <Lin label="CMC" val={c.cmc} tipo="ca" />
        </Card>

        <Card className="p-3">
          <h3 className="text-sm font-bold mb-1">ATIVO</h3>
          <Lin label="Ativo Circulante" val={c.ativoCirc} bold />
          <Lin label="Caixa + Investimentos" val={c.caixaInv} tipo="manual" campo="caixa_investimentos" indent />
          <Lin label="Contas a Receber" val={c.contasReceber} tipo="ca" indent />
          <Lin label="Empréstimos CP a Receber" val={c.emprestimosCP} tipo="manual" campo="emprestimos_cp_receber" indent />
          <Lin label="Estoques" val={c.estoques} tipo="manual" campo="estoques" indent />
          <Lin label="Ativo Não Circulante" val={c.ativoNaoCirc} bold />
          <Lin label="Imobilizado Inicial" val={n(c.man.imobilizado_inicial)} tipo="manual" campo="imobilizado_inicial" indent />
          <Lin label="Imobilizado Líq" val={n(c.man.imobilizado_liq)} tipo="manual" campo="imobilizado_liq" indent />
          <Lin label="ATIVO TOTAL" val={c.ativoTotal} bold />
        </Card>
      </div>

      <Card className="p-3">
        <h3 className="text-sm font-bold mb-1">PASSIVO</h3>
        <Lin label="Passivo Circulante" val={c.passivoCirc} bold />
        <Lin label="Outras Contas a Pagar" val={c.outras} tipo="ca" indent />
        <Lin label="Artistas e Produção" val={n(c.ca.pc_artistas_producao)} tipo="ca" indent />
        <Lin label="Fornecedores CMV" val={n(c.ca.pc_fornecedores_cmv)} tipo="ca" indent />
        <Lin label="Adm & Mkt" val={n(c.ca.pc_adm_mkt)} tipo="ca" indent />
        <Lin label="Despesas Operacionais" val={n(c.ca.pc_operacionais)} tipo="ca" indent />
        <Lin label="Ocupação" val={n(c.ca.pc_ocupacao)} tipo="ca" indent />
        <Lin label="CMO + Comissão" val={n(c.ca.pc_cmo_comissao)} tipo="ca" indent />
        <Lin label="Investimentos" val={n(c.ca.pc_investimentos)} tipo="ca" indent />
        <Lin label="Impostos" val={n(c.ca.pc_impostos)} tipo="ca" indent />
        <Lin label="Passivo Não Circulante" val={c.passivoNaoCirc} bold />
        <Lin label="Investimentos Aprovados a Fazer" val={n(c.man.investimentos_aprovados_a_fazer)} tipo="manual" campo="investimentos_aprovados_a_fazer" indent />
        <Lin label="Financiamentos LP" val={n(c.man.financiamentos_lp)} tipo="manual" campo="financiamentos_lp" indent />
        <Lin label="Provisões Fiscais Eventos" val={n(c.man.provisoes_fiscais_eventos)} tipo="manual" campo="provisoes_fiscais_eventos" indent />
        <Lin label="Provisões Trabalhistas" val={n(c.man.provisoes_trabalhistas)} tipo="manual" campo="provisoes_trabalhistas" indent />
        <Lin label="Patrimônio Líquido" val={n(c.man.patrimonio_liquido)} tipo="manual" campo="patrimonio_liquido" indent />
        <Lin label="PASSIVO TOTAL" val={c.passivoTotal} bold />
      </Card>

      <Card className="p-3">
        <h3 className="text-sm font-bold mb-1">Indicadores</h3>
        <div className="grid md:grid-cols-2 gap-x-6">
          <div>
            <Lin label="NCG Contábil / Fornecedores" val={c.ncgForn} />
            <Lin label="NCG Contábil / Passivo Circulante" val={c.ncgPC} />
            <Lin label="Saldo Tesouraria" val={c.saldoTes} />
            <Lin label="Caixa Líquido" val={c.caixaLiquido} />
            <Lin label="Capital de Giro" val={c.capitalGiro} />
            <Lin label="Dividendos Pagos" val={c.dividendos} tipo="ca" />
            <Lin label="Variação de NCG" val={c.variacaoNcg} />
          </div>
          <div>
            <div className="flex justify-between px-2 py-1 text-xs"><span>Liquidez Corrente</span><span className="tabular-nums font-semibold">{fmtNum(c.liqCorrente, 2)}</span></div>
            <div className="flex justify-between px-2 py-1 text-xs"><span>Liquidez Imediata</span><span className="tabular-nums font-semibold">{fmtNum(c.liqImediata, 2)}</span></div>
            <div className="flex justify-between px-2 py-1 text-xs"><span>Liquidez Seca</span><span className="tabular-nums font-semibold">{fmtNum(c.liqSeca, 2)}</span></div>
            <div className="border-t my-1" />
            <div className="flex justify-between px-2 py-1 text-xs"><span>PME contábil (d)</span><span className="tabular-nums">{fmtNum(c.pmeC)}</span></div>
            <div className="flex justify-between px-2 py-1 text-xs"><span>PMR contábil (d)</span><span className="tabular-nums">{fmtNum(c.pmrC)}</span></div>
            <div className="flex justify-between px-2 py-1 text-xs"><span>PMP contábil (d)</span><span className="tabular-nums">{fmtNum(c.pmpC)}</span></div>
            <div className="flex justify-between px-2 py-1 text-xs font-semibold"><span>Ciclo Financeiro</span><span className="tabular-nums">{fmtNum(c.pmeC + c.pmrC - c.pmpC)}</span></div>
          </div>
        </div>
      </Card>
    </main>
  );
}

function ativoCircSemCaixa(receber: number, emp: number, est: number) { return receber + emp + est; }
