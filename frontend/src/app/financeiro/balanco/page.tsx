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

type Mes = { ano: number; mes: number; ca: any; manual: any; imob: any; estoque: number };
type RowTipo = 'header' | 'ca' | 'manual' | 'calc' | 'ratio' | 'days';
interface RowDef { id: string; label: string; tipo: RowTipo; campo?: string; bold?: boolean; indent?: boolean; destaque?: boolean }

const ROWS: RowDef[] = [
  { id: 'h_topo', label: 'Topo (DRE do mês)', tipo: 'header' },
  { id: 'receita_liquida', label: 'Receita Líquida', tipo: 'ca' },
  { id: 'lucro_liquido', label: 'Lucro Líquido', tipo: 'ca' },
  { id: 'cmv', label: 'CMV', tipo: 'ca' },
  { id: 'cmc', label: 'CMC', tipo: 'ca' },
  { id: 'h_ativo', label: 'ATIVO', tipo: 'header' },
  { id: 'ativo_circulante', label: 'Ativo Circulante', tipo: 'calc', bold: true },
  { id: 'caixa_investimentos', label: 'Caixa + Investimentos', tipo: 'manual', campo: 'caixa_investimentos', indent: true },
  { id: 'contas_receber', label: 'Contas a Receber', tipo: 'ca', indent: true },
  { id: 'emprestimos_cp_receber', label: 'Empréstimos CP a Receber', tipo: 'manual', campo: 'emprestimos_cp_receber', indent: true },
  { id: 'estoques', label: 'Estoques (CMV)', tipo: 'calc', indent: true },
  { id: 'ativo_nao_circulante', label: 'Ativo Não Circulante', tipo: 'calc', bold: true },
  { id: 'imobilizado_inicial', label: 'Imobilizado Inicial', tipo: 'calc', indent: true },
  { id: 'imobilizado_liq', label: 'Imobilizado Líq', tipo: 'calc', indent: true },
  { id: 'ativo_total', label: 'ATIVO TOTAL', tipo: 'calc', bold: true },
  { id: 'h_passivo', label: 'PASSIVO', tipo: 'header' },
  { id: 'passivo_circulante', label: 'Passivo Circulante', tipo: 'calc', bold: true },
  { id: 'outras', label: 'Outras Contas a Pagar', tipo: 'ca', indent: true },
  { id: 'pc_artistas_producao', label: 'Artistas e Produção', tipo: 'ca', indent: true },
  { id: 'pc_fornecedores_cmv', label: 'Fornecedores CMV', tipo: 'ca', indent: true },
  { id: 'pc_adm_mkt', label: 'Adm & Mkt', tipo: 'ca', indent: true },
  { id: 'pc_operacionais', label: 'Despesas Operacionais', tipo: 'ca', indent: true },
  { id: 'pc_ocupacao', label: 'Ocupação', tipo: 'ca', indent: true },
  { id: 'pc_cmo_comissao', label: 'CMO + Comissão', tipo: 'ca', indent: true },
  { id: 'pc_investimentos', label: 'Investimentos', tipo: 'ca', indent: true },
  { id: 'pc_impostos', label: 'Impostos', tipo: 'ca', indent: true },
  { id: 'passivo_nao_circulante', label: 'Passivo Não Circulante', tipo: 'calc', bold: true },
  { id: 'investimentos_aprovados_a_fazer', label: 'Investimentos Aprovados a Fazer', tipo: 'manual', campo: 'investimentos_aprovados_a_fazer', indent: true },
  { id: 'financiamentos_lp', label: 'Financiamentos LP', tipo: 'manual', campo: 'financiamentos_lp', indent: true },
  { id: 'provisoes_fiscais', label: 'Provisões Fiscais Eventos', tipo: 'ca', indent: true },
  { id: 'provisoes_trabalhistas', label: 'Provisões Trabalhistas', tipo: 'ca', indent: true },
  { id: 'patrimonio_liquido', label: 'Patrimônio Líquido', tipo: 'manual', campo: 'patrimonio_liquido', indent: true, destaque: true },
  { id: 'passivo_total', label: 'PASSIVO TOTAL', tipo: 'calc', bold: true },
  { id: 'h_ncg', label: 'Necessidade de Capital de Giro (NCG)', tipo: 'header' },
  { id: 'ncg_forn', label: 'NCG Contábil / Fornecedores', tipo: 'calc' },
  { id: 'ncg_pc', label: 'NCG Contábil / Passivo Circulante', tipo: 'calc' },
  { id: 'variacao_ncg', label: 'Variação de NCG', tipo: 'calc', destaque: true },
  { id: 'h_liq', label: 'Liquidez & Tesouraria', tipo: 'header' },
  { id: 'saldo_tes', label: 'Saldo Tesouraria', tipo: 'calc' },
  { id: 'liq_corrente', label: 'Liquidez Corrente', tipo: 'ratio' },
  { id: 'liq_imediata', label: 'Liquidez Imediata', tipo: 'ratio' },
  { id: 'liq_seca', label: 'Liquidez Seca', tipo: 'ratio' },
  { id: 'h_prazos', label: 'Prazos Médios (Contábil)', tipo: 'header' },
  { id: 'pme', label: 'PME — Estoques (d)', tipo: 'days' },
  { id: 'pmr', label: 'PMR — Recebimento (d)', tipo: 'days' },
  { id: 'pmp', label: 'PMP — Pagamento (d)', tipo: 'days' },
  { id: 'ciclo', label: 'Ciclo Financeiro (d)', tipo: 'days' },
  { id: 'h_estrutura', label: 'Estrutura', tipo: 'header' },
  { id: 'capital_giro', label: 'Capital de Giro', tipo: 'calc' },
  { id: 'dividendos', label: 'Dividendos Pagos', tipo: 'ca' },
  { id: 'caixa_liquido', label: 'Caixa "Líquido"', tipo: 'calc', destaque: true },
];

const CAMPO_DE_ID: Record<string, string> = Object.fromEntries(ROWS.filter(r => r.campo).map(r => [r.id, r.campo!]));

/** Calcula todos os valores derivados de um mês. */
function computeMes(ca: any, man: any, imob: any, estoque: number): Record<string, number> {
  ca = ca || {}; man = man || {}; imob = imob || {};
  const v: Record<string, number> = {};
  v.receita_liquida = n(ca.receita_liquida);
  v.lucro_liquido = n(ca.lucro_liquido);
  v.cmv = Math.abs(n(ca.cmv));
  v.cmc = Math.abs(n(ca.cmc));
  v.caixa_investimentos = n(man.caixa_investimentos);
  v.contas_receber = n(ca.contas_receber);
  v.emprestimos_cp_receber = n(man.emprestimos_cp_receber);
  v.estoques = n(estoque);
  v.ativo_circulante = v.caixa_investimentos + v.contas_receber + v.emprestimos_cp_receber + v.estoques;
  v.imobilizado_inicial = n(imob.imob_inicial);
  v.imobilizado_liq = n(imob.imob_liq);
  v.ativo_nao_circulante = v.imobilizado_inicial + v.imobilizado_liq;
  v.ativo_total = v.ativo_circulante + v.ativo_nao_circulante;
  const blocks = ['pc_artistas_producao', 'pc_fornecedores_cmv', 'pc_adm_mkt', 'pc_operacionais', 'pc_ocupacao', 'pc_cmo_comissao', 'pc_investimentos', 'pc_impostos'];
  let soma8 = 0;
  blocks.forEach(k => { v[k] = n(ca[k]); soma8 += v[k]; });
  v.outras = n(ca.pc_total_despesas) - soma8;
  v.passivo_circulante = v.outras + soma8;
  v.investimentos_aprovados_a_fazer = n(man.investimentos_aprovados_a_fazer);
  v.financiamentos_lp = n(man.financiamentos_lp);
  v.provisoes_fiscais = n(ca.provisoes_fiscais);
  v.provisoes_trabalhistas = n(ca.provisoes_trabalhistas);
  v.patrimonio_liquido = n(man.patrimonio_liquido);
  v.passivo_nao_circulante = v.investimentos_aprovados_a_fazer + v.financiamentos_lp + v.provisoes_fiscais + v.provisoes_trabalhistas + v.patrimonio_liquido;
  v.passivo_total = v.passivo_circulante + v.passivo_nao_circulante;
  const ncgBase = v.contas_receber + v.emprestimos_cp_receber + v.estoques;
  v.ncg_forn = ncgBase - v.pc_fornecedores_cmv;
  v.ncg_pc = ncgBase - v.passivo_circulante;
  v.saldo_tes = v.caixa_investimentos;
  v.caixa_liquido = v.caixa_investimentos + v.emprestimos_cp_receber - (v.investimentos_aprovados_a_fazer + v.financiamentos_lp + v.provisoes_fiscais + v.provisoes_trabalhistas);
  v.capital_giro = v.passivo_nao_circulante - v.ativo_nao_circulante;
  v.dividendos = n(ca.dividendos_pagos);
  const liq = (x: number) => v.passivo_circulante > 0 ? x / v.passivo_circulante : 0;
  v.liq_corrente = liq(v.ativo_circulante);
  v.liq_imediata = liq(v.caixa_investimentos);
  v.liq_seca = liq(v.caixa_investimentos + v.contas_receber);
  v.pme = v.cmv > 0 ? v.estoques / v.cmv * 30 : 0;
  v.pmr = v.receita_liquida > 0 ? v.contas_receber / v.receita_liquida * 30 : 0;
  v.pmp = v.cmv > 0 ? v.pc_fornecedores_cmv / v.cmv * 30 : 0;
  v.ciclo = v.pme + v.pmr - v.pmp;
  return v;
}

export default function BalancoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() === 0 ? 12 : hoje.getMonth());
  const [qtdMeses, setQtdMeses] = useState(6);
  const [meses, setMeses] = useState<Mes[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/financeiro/balanco?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}&n=${qtdMeses}`, { cache: 'no-store' });
      const j = await r.json();
      setMeses(Array.isArray(j.meses) ? j.meses : []);
    } finally { setLoading(false); }
  }, [selectedBar?.id, ano, mes, qtdMeses]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (m: Mes, campo: string) => {
    if (!selectedBar?.id) return;
    const valor = parseFloat(editVal.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
    setEditKey(null);
    await fetch('/api/financeiro/balanco', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bar_id: selectedBar.id, ano: m.ano, mes: m.mes, campo, valor }),
    });
    toast({ title: 'Salvo' });
    carregar();
  };

  // ---- Cadastro de imobilizado (depreciação) ----
  const [ativos, setAtivos] = useState<any[]>([]);
  const formVazio = { descricao: '', valor: '', data_aquisicao: '', tipo: 'reinvestimento', taxa_anual: '10' };
  const [form, setForm] = useState(formVazio);

  const carregarAtivos = useCallback(async () => {
    if (!selectedBar?.id) return;
    const r = await fetch(`/api/financeiro/balanco/imobilizado?bar_id=${selectedBar.id}`, { cache: 'no-store' });
    const j = await r.json();
    setAtivos(Array.isArray(j.ativos) ? j.ativos : []);
  }, [selectedBar?.id]);
  useEffect(() => { carregarAtivos(); }, [carregarAtivos]);

  const addAtivo = async () => {
    if (!selectedBar?.id || !form.descricao || !form.valor || !form.data_aquisicao) {
      toast({ title: 'Preencha descrição, valor e mês', variant: 'destructive' }); return;
    }
    const valor = parseFloat(form.valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
    const data = form.data_aquisicao.length === 7 ? form.data_aquisicao + '-01' : form.data_aquisicao;
    await fetch('/api/financeiro/balanco/imobilizado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bar_id: selectedBar.id, descricao: form.descricao, valor, data_aquisicao: data, tipo: form.tipo, taxa_anual: Number(form.taxa_anual) || 10 }),
    });
    setForm(formVazio);
    toast({ title: 'Imobilizado cadastrado' });
    carregarAtivos(); carregar();
  };

  const delAtivo = async (id: number) => {
    await fetch(`/api/financeiro/balanco/imobilizado?id=${id}`, { method: 'DELETE' });
    carregarAtivos(); carregar();
  };

  // valores calculados por mês + variação de NCG (vs mês anterior na série)
  const vals = useMemo(() => {
    const arr = meses.map(m => computeMes(m.ca, m.manual, m.imob, m.estoque));
    arr.forEach((v, i) => { v.variacao_ncg = i === 0 ? 0 : v.ncg_forn - arr[i - 1].ncg_forn; });
    return arr;
  }, [meses]);

  const anos = Array.from({ length: hoje.getFullYear() - 2023 }, (_, i) => hoje.getFullYear() - i);
  const fmtCell = (id: string, tipo: RowTipo, val: number) =>
    tipo === 'ratio' ? fmtNum(val, 2) : tipo === 'days' ? fmtNum(val, 1) : fmtBRL(val);

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="w-6 h-6 text-indigo-600" /> Balanço Patrimonial</h1>
        <div className="flex gap-2">
          <select value={qtdMeses} onChange={e => setQtdMeses(Number(e.target.value))} className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-gray-800">
            {[3, 6, 8, 12].map(q => <option key={q} value={q}>{q} meses</option>)}
          </select>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-gray-800">
            {MES_ABBR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-gray-800">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Foto do último dia de cada mês, lado a lado (mês final = {MES_ABBR[mes - 1]}/{ano}).
        <span className="text-orange-500"> ●</span> Conta Azul · <span className="text-blue-500">●</span> manual (clique p/ editar) · <span className="text-gray-400">●</span> cálculo.
      </p>

      {loading ? <Skeleton className="h-[600px]" /> : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800/60">
                <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-gray-50 dark:bg-gray-800/60 z-10 min-w-[220px]">{selectedBar?.nome || 'Bar'}</th>
                {meses.map((m, i) => (
                  <th key={i} className="text-right font-semibold px-3 py-2 whitespace-nowrap min-w-[110px]">{MES_ABBR[m.mes - 1]}/{String(m.ano).slice(2)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => {
                if (row.tipo === 'header') {
                  return (
                    <tr key={row.id} className="bg-indigo-50 dark:bg-indigo-950/40 border-t-[3px] border-indigo-300 dark:border-indigo-800">
                      <td colSpan={meses.length + 1} className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide text-indigo-700 dark:text-indigo-300 sticky left-0 bg-indigo-50 dark:bg-indigo-950/40">{row.label}</td>
                    </tr>
                  );
                }
                const corLabel = row.tipo === 'ca' ? 'border-l-orange-400' : row.tipo === 'manual' ? 'border-l-blue-400' : 'border-l-gray-300';
                const rowBg = row.destaque ? 'bg-amber-100/70 dark:bg-amber-900/30 font-bold' : row.bold ? 'font-bold bg-gray-50/70 dark:bg-gray-800/40' : '';
                const labelBg = row.destaque ? 'bg-amber-100/70 dark:bg-amber-900/30' : row.bold ? 'bg-gray-50/70 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900';
                const labelBorder = row.destaque ? 'border-l-4 border-l-amber-500' : `border-l-2 ${corLabel}`;
                return (
                  <tr key={row.id} className={`border-b border-gray-100 dark:border-gray-800 ${rowBg} ${row.destaque ? 'ring-1 ring-amber-300/60 dark:ring-amber-700/40' : ''}`}>
                    <td className={`px-3 py-1 ${labelBorder} sticky left-0 ${labelBg} ${row.indent ? 'pl-6' : ''} ${row.destaque ? 'text-amber-900 dark:text-amber-200' : ''}`}>{row.label}</td>
                    {meses.map((m, i) => {
                      const v = vals[i]?.[row.id] ?? 0;
                      const campo = row.tipo === 'manual' ? CAMPO_DE_ID[row.id] : undefined;
                      const ek = `${m.ano}-${m.mes}-${campo}`;
                      if (campo) {
                        return (
                          <td key={i} className="px-3 py-1 text-right tabular-nums">
                            {editKey === ek ? (
                              <input ref={el => el?.focus()} defaultValue={String(v)} onChange={e => setEditVal(e.target.value)}
                                onBlur={() => salvar(m, campo)} onKeyDown={e => { if (e.key === 'Enter') salvar(m, campo); if (e.key === 'Escape') setEditKey(null); }}
                                className="w-24 h-6 text-xs text-right border rounded px-1" />
                            ) : (
                              <button className="text-blue-600 hover:underline" onClick={() => { setEditKey(ek); setEditVal(String(v)); }}>{fmtCell(row.id, row.tipo, v)}</button>
                            )}
                          </td>
                        );
                      }
                      const cor = row.destaque ? 'text-amber-900 dark:text-amber-200' : row.tipo === 'ca' ? 'text-orange-700 dark:text-orange-400' : '';
                      return <td key={i} className={`px-3 py-1 text-right tabular-nums ${cor} ${v < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{fmtCell(row.id, row.tipo, v)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Cadastro de imobilizado — alimenta as linhas Imobilizado Inicial/Líq */}
      <Card className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2"><Landmark className="w-4 h-4 text-indigo-600" /> Imobilizado — cadastro & depreciação</h3>
          <p className="text-xs text-gray-500">Cada ativo entra com o valor cheio no mês da compra e deprecia um valor fixo/mês (taxa anual ÷ 12, juros simples) até zerar. <b>Inicial</b> = base de abertura · <b>Reinvestimento</b> = compras novas. Isto alimenta as linhas Imobilizado Inicial/Líq automaticamente.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div className="col-span-2 md:col-span-2">
            <label className="text-[11px] text-gray-500">Descrição</label>
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Telão, Câmara fria" className="w-full h-8 text-xs border rounded px-2 bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Valor (R$)</label>
            <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="120000" className="w-full h-8 text-xs border rounded px-2 text-right bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Mês da compra</label>
            <input type="month" value={form.data_aquisicao} onChange={e => setForm({ ...form, data_aquisicao: e.target.value })} className="w-full h-8 text-xs border rounded px-2 bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full h-8 text-xs border rounded px-2 bg-white dark:bg-gray-800">
              <option value="reinvestimento">Reinvestimento</option>
              <option value="inicial">Inicial (base)</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-gray-500">Taxa %/ano</label>
              <input value={form.taxa_anual} onChange={e => setForm({ ...form, taxa_anual: e.target.value })} className="w-full h-8 text-xs border rounded px-2 text-right bg-white dark:bg-gray-800" />
            </div>
            <button onClick={addAtivo} className="h-8 px-3 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700 self-end">Adicionar</button>
          </div>
        </div>

        {ativos.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1">Descrição</th><th>Tipo</th><th className="text-right">Valor</th>
                <th className="text-right">Mês compra</th><th className="text-right">Depreciação/mês</th><th className="text-right">Fim</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ativos.map(a => {
                const dep = (n(a.valor) * n(a.taxa_anual)) / 1200;
                const meses = a.taxa_anual ? Math.round(1200 / n(a.taxa_anual)) : 120;
                const d = new Date(a.data_aquisicao + 'T00:00:00');
                const fim = new Date(d); fim.setMonth(fim.getMonth() + meses);
                return (
                  <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-1">{a.descricao}</td>
                    <td>{a.tipo === 'inicial' ? 'Inicial' : 'Reinvest.'}</td>
                    <td className="text-right tabular-nums">{fmtBRL(n(a.valor))}</td>
                    <td className="text-right tabular-nums">{MES_ABBR[d.getMonth()]}/{String(d.getFullYear()).slice(2)}</td>
                    <td className="text-right tabular-nums">{fmtBRL(dep)}</td>
                    <td className="text-right tabular-nums text-gray-500">{MES_ABBR[fim.getMonth()]}/{String(fim.getFullYear()).slice(2)}</td>
                    <td className="text-right"><button onClick={() => delAtivo(a.id)} className="text-red-600 hover:underline">remover</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
