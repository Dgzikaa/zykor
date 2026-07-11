'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, User, Clock, X, Scale, Package, Pencil } from 'lucide-react';
import { entradaPeso, fmtBRL, fmtNum, fmtPeso, fmtPct, pf } from './_shared';

export function EditarExecucaoModal({ exec, fichas, responsaveis, barId, onClose, onSaved }: {
  exec: any; fichas: any[]; responsaveis: any[]; barId: number; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [resp, setResp] = useState<number | null>(exec.responsavel_id ?? null);
  const [durMin, setDurMin] = useState<string>(String(Math.floor((exec.duracao_seg || 0) / 60)));
  const [durSeg, setDurSeg] = useState<string>(String((exec.duracao_seg || 0) % 60));
  const [pesoBruto, setPesoBruto] = useState('');   // em unidade amigável (kg/L) — preenchido ao carregar a ficha
  const [pesoMestre, setPesoMestre] = useState('');
  const [rendReal, setRendReal] = useState<string>('');  // em unidade amigável (kg/L) — preenchido ao carregar a ficha
  const [obs, setObs] = useState<string>(exec.observacao || '');
  const [qtdReal, setQtdReal] = useState<Record<number, string>>({}); // "Usado" por item da ficha (editável)
  const [tentou, setTentou] = useState(false); // já clicou em salvar → destaca "Usado" vazio

  const ficha = fichas.find(f => f.id === exec.producao_id) || null;

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        // carrega a ficha (base p/ recalcular) + os insumos salvos da execução (p/ preencher o "Usado")
        const [r, rExec] = await Promise.all([
          api.get(`/api/operacional/producoes/ficha?producao_id=${exec.producao_id}&bar_id=${barId}`),
          api.get(`/api/operacional/producoes/execucao?bar_id=${barId}&execucao_id=${exec.id}`),
        ]);
        if (cancel) return;
        const its = r.success ? (r.itens || []) : [];
        setItens(its);
        // prefill peso mestre/bruto convertendo o valor salvo (base g/ml) → unidade de entrada (kg/L)
        const m = its.find((i: any) => i.is_mestre) || null;
        const ent = entradaPeso(m?.unidade_exib || null, Number(m?.quantidade || 0));
        if (exec.peso_mestre_real != null) setPesoMestre(String(Number(exec.peso_mestre_real) / ent.fator));
        if (exec.peso_bruto != null) setPesoBruto(String(Number(exec.peso_bruto) / ent.fator));
        // rendimento salvo → unidade do PRODUTO (ficha.unidade): un→fator 1 (sem ÷1000), kg/L→÷1000
        const fatRend = entradaPeso(ficha?.unidade || null, Number(exec.rendimento_esperado ?? exec.rendimento_real ?? 0)).fator;
        if (exec.rendimento_real != null) setRendReal(String(Number(exec.rendimento_real) / fatRend));
        // prefill "Usado" de cada insumo não-mestre com o qtd_real salvo (casa por código, fallback nome)
        const salvos = rExec?.success ? (rExec.insumos || []) : [];
        const byCod = new Map<string, any>(); const byNome = new Map<string, any>();
        salvos.forEach((s: any) => {
          if (s.insumo_codigo) byCod.set(String(s.insumo_codigo), s);
          if (s.nome) byNome.set(String(s.nome).toLowerCase(), s);
        });
        const pre: Record<number, string> = {};
        its.forEach((it: any) => {
          if (it.is_mestre) return;
          const cod = it.insumo_codigo ?? it.componente_codigo;
          const nome = it.nome_componente ?? it.componente_codigo;
          const s = (cod && byCod.get(String(cod))) || (nome && byNome.get(String(nome).toLowerCase()));
          if (s && s.qtd_real != null) pre[it.id] = String(s.qtd_real);
        });
        setQtdReal(pre);
      } catch (e: any) { if (!cancel) toast({ title: 'Erro ao carregar ficha', description: e?.message, variant: 'destructive' }); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec.producao_id, exec.id, barId]);

  const mestre = itens.find(i => i.is_mestre) || null;
  const mestreQtd = Number(mestre?.quantidade || 0);
  const baseMestre = mestre?.unidade_exib || null;
  const ent = entradaPeso(baseMestre, mestreQtd);
  const mestreFc = !!mestre?.insumo_fc;
  const pesoMestreBase = (pf(pesoMestre) || 0) * ent.fator;
  const proporcao = (mestre && pesoMestreBase > 0 && mestreQtd > 0) ? pesoMestreBase / mestreQtd : 1;
  const rendEsperado = Number(ficha?.rendimento || 0) * proporcao;
  // rendimento na unidade do PRODUTO (ficha.unidade), NÃO na do insumo mestre — un não vira kg
  const entRend = entradaPeso(ficha?.unidade || null, rendEsperado);

  // quantidade calculada (proporção) e o "usado" (override manual, ou o calculado) por item
  const calcItem = (it: any) => {
    const qtdPlan = Number(it.quantidade || 0);
    const qtdCalc = it.is_mestre ? (pesoMestreBase > 0 ? pesoMestreBase : qtdPlan) : qtdPlan * proporcao;
    const ov = qtdReal[it.id];
    const real = it.is_mestre ? qtdCalc : (ov != null && String(ov).trim() !== '' ? (pf(ov) || 0) : qtdCalc);
    const precoUn = Number(it.preco_un || 0);
    const desvio = qtdCalc > 0 ? (real - qtdCalc) / qtdCalc : null;
    return { qtdPlan, qtdCalc, real, precoUn, desvio, cReal: real * precoUn };
  };
  const usadoVazio = (it: any) => !it.is_mestre && (qtdReal[it.id] == null || String(qtdReal[it.id]).trim() === '');
  const preencherCalculado = () => {
    const next: Record<number, string> = { ...qtdReal };
    itens.forEach((it: any) => { if (!it.is_mestre) next[it.id] = String(Math.round(calcItem(it).qtdCalc * 1000) / 1000); });
    setQtdReal(next);
  };

  const salvar = async () => {
    if (salvando) return;
    const faltando = itens.filter((it: any) => usadoVazio(it));
    if (faltando.length) {
      setTentou(true);
      toast({ title: 'Preencha o "Usado"', description: `${faltando.length} insumo${faltando.length > 1 ? 's' : ''} sem valor`, variant: 'destructive' });
      return;
    }
    const dur = (parseInt(durMin) || 0) * 60 + (parseInt(durSeg) || 0);
    const linhas = itens.map((it: any) => {
      const c = calcItem(it);
      return {
        insumo_codigo: it.insumo_codigo ?? it.componente_codigo ?? null,
        insumo_id_vmarket: it.insumo_id_vmarket ?? null,
        nome: it.nome_componente ?? it.componente_codigo ?? null,
        is_mestre: it.is_mestre,
        qtd_planejada: c.qtdPlan,
        qtd_calculada: c.qtdCalc,
        qtd_real: c.real, // usado = override manual da coluna, ou o calculado se não mexeram
        unidade: it.unidade_exib ?? null,
        preco_un: c.precoUn,
      };
    });
    const respNome = responsaveis.find(r => r.id === resp)?.nome ?? null;
    setSalvando(true);
    try {
      const r = await api.put('/api/operacional/producoes/execucao', {
        execucao_id: exec.id, bar_id: barId, producao_id: exec.producao_id,
        responsavel_id: resp, responsavel_nome: respNome, duracao_seg: dur,
        rendimento_esperado: rendEsperado || null,
        rendimento_real: (pf(rendReal) * entRend.fator) || null,  // unidade do produto (un→×1, kg/L→×1000)
        peso_mestre_real: pesoMestreBase || null,
        peso_bruto: mestreFc ? ((pf(pesoBruto) || 0) * ent.fator || null) : null,
        observacao: obs.trim() || null,
        insumos: linhas,
      });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Execução atualizada', description: exec.producao_nome || '' });
      onSaved();
    } catch (e: any) { toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' }); }
    finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-indigo-600" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Editar execução — {exec.producao_nome}</h4>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {loading ? <div className="py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><User className="w-3.5 h-3.5" />Responsável</label>
                <select value={resp ?? ''} onChange={e => setResp(e.target.value ? Number(e.target.value) : null)}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
                  <option value="">Selecione…</option>
                  {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}{r.cargo ? ` (${r.cargo})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Clock className="w-3.5 h-3.5" />Duração</label>
                <div className="flex items-center gap-1">
                  <Input type="number" inputMode="numeric" value={durMin} onChange={e => setDurMin(e.target.value)} className="h-10" />
                  <span className="text-xs text-gray-400">min</span>
                  <Input type="number" inputMode="numeric" value={durSeg} onChange={e => setDurSeg(e.target.value)} className="h-10" />
                  <span className="text-xs text-gray-400">seg</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mestreFc && (
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5" />Peso bruto{ent.unidade ? ` (${ent.unidade})` : ''}</label>
                  <Input type="text" inputMode="decimal" step="any" value={pesoBruto} onChange={e => setPesoBruto(e.target.value)} placeholder="antes de limpar" className="h-10" />
                </div>
              )}
              {mestre && (
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5" />Peso mestre{ent.unidade ? ` (${ent.unidade})` : ''}</label>
                  <Input type="text" inputMode="decimal" step="any" value={pesoMestre} onChange={e => setPesoMestre(e.target.value)} placeholder={`ficha: ${fmtPeso(mestreQtd, baseMestre)}`} className="h-10" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Package className="w-3.5 h-3.5" />Rendimento real{(entRend.unidade || ficha?.unidade) ? ` (${entRend.unidade || ficha?.unidade})` : ''} {rendEsperado > 0 && <span className="text-gray-400">· meta {fmtNum(rendEsperado / entRend.fator, 2)} {entRend.unidade || ficha?.unidade || ''}</span>}</label>
                <Input type="text" inputMode="decimal" step="any" value={rendReal} onChange={e => setRendReal(e.target.value)} placeholder="produzido…" className="h-10" />
              </div>
            </div>

            {/* Insumos — editar o "Usado" de cada um (o mestre é dirigido pelo peso) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 flex items-center gap-1"><Package className="w-3.5 h-3.5" />Insumos — usado <span className="text-gray-400">(obrigatório)</span></label>
                <button type="button" onClick={preencherCalculado}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                  <Scale className="w-3.5 h-3.5" />Preencher c/ o calculado
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                    <th className="text-left font-medium px-2 py-1.5">Insumo</th>
                    <th className="text-right font-medium px-2 py-1.5">Calculado</th>
                    <th className="text-right font-medium px-2 py-1.5 w-28">Usado *</th>
                    <th className="text-right font-medium px-2 py-1.5">Desvio</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {itens.length === 0 ? <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-400">Ficha sem componentes.</td></tr>
                    : itens.map((it: any) => {
                      const c = calcItem(it);
                      const err = tentou && usadoVazio(it);
                      // mestre na mesma unidade amigável do campo de peso (kg/L); demais na base do insumo
                      const uFat = it.is_mestre ? (ent.fator || 1) : 1;
                      const uLbl = it.is_mestre ? (ent.unidade || '') : (it.unidade_exib || '');
                      return (
                        <tr key={it.id} className={it.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                          <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">
                            {it.is_mestre && <span className="text-amber-500 mr-1" title="Insumo mestre (dirigido pelo peso)">★</span>}
                            {it.nome_componente || it.componente_codigo || `#${it.id}`}
                            <span className="text-xs text-gray-400 ml-1">{uLbl}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{fmtNum(c.qtdCalc / uFat, 3)}</td>
                          <td className="px-2 py-1.5 text-right">
                            {it.is_mestre
                              ? <span className="text-xs text-gray-400">via peso</span>
                              : <Input type="text" inputMode="decimal" step="any" value={qtdReal[it.id] ?? ''}
                                  onChange={e => setQtdReal(prev => ({ ...prev, [it.id]: e.target.value }))}
                                  placeholder="obrigatório" className={`h-8 text-right text-sm ${err ? 'border-red-500 ring-1 ring-red-500' : ''}`} />}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {c.desvio == null ? '—' : <span className={Math.abs(c.desvio) < 0.05 ? 'text-emerald-600' : Math.abs(c.desvio) < 0.15 ? 'text-amber-600' : 'text-red-600'}>{c.desvio > 0 ? '+' : ''}{fmtPct(c.desvio * 100)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Observação</label>
              <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (opcional)…" />
            </div>

            {proporcao !== 1 && <p className="text-[11px] text-gray-400">Proporção recalculada: ×{fmtNum(proporcao, 3)} · o custo e a aderência são recomputados ao salvar.</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando} className="bg-indigo-600 hover:bg-indigo-700">
                {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Salvar alterações
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
