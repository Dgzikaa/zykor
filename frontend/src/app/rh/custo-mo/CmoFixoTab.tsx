'use client';

import { Fragment, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { Loader2, Lock, LockOpen, Save, AlertTriangle, Eye, EyeOff } from 'lucide-react';

/**
 * CMO FIXO do mês — a tela que substitui a planilha CMO.
 *
 * As pessoas vêm do ORGANOGRAMA (cadeira ocupada). Todo o resto é calculado do cadastro. O que
 * se digita aqui é só o que depende do mês: dias que a pessoa contou, dias de VT e aviso prévio.
 * Salário, VT, adicional, consumação, estimativa e tempo de casa são do cadastro da pessoa —
 * mudar ali muda aqui, e não existe número que só viva nesta tela.
 */

const fmt = (v: number) => (v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–');
const fmtC = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type Linha = {
  funcionario_id: number; nome: string; tipo_contratacao: string; cargo: string | null;
  area: string | null; grupo: string; cargo_confianca: boolean;
  dias_trabalhados: number; dias_mes: number; dias_vt: number; vt_diaria: number;
  salario_bruto: number; estimativa: number; adicional_noturno: number; drs_noturno: number;
  tempo_casa: number; produtividade: number; desc_vale_transporte: number; inss: number; ir: number;
  salario_liquido: number; inss_empresa: number; fgts: number; vale_transporte: number;
  provisao_certa: number; mensalidade_sindical: number; adicionais: number; consumacao: number;
  aviso_previo: number; custo_empresa: number;
};

type Ajuste = { dias_trabalhados?: number; dias_vt?: number; aviso_previo?: number };

export function CmoFixoTab() {
  const { showToast } = useToast();
  const hoje = new Date();
  const [mesAno, setMesAno] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
  const [ano, mes] = mesAno.split('-').map(Number);
  const [tudo, setTudo] = useState(false);
  const [edit, setEdit] = useState<Record<number, Ajuste>>({});
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading, mutate } = useApiSWR<any>(`/api/rh/cmo-fixo?ano=${ano}&mes=${mes}`);
  const linhas: Linha[] = data?.linhas || [];
  const fechado = !!data?.fechado;
  const sujo = Object.keys(edit).length > 0;

  /** valor mostrado no input: o que foi editado, senão o que veio da API */
  const val = (l: Linha, k: keyof Ajuste) => {
    const e = edit[l.funcionario_id]?.[k];
    if (e != null) return String(e);
    return String(k === 'dias_trabalhados' ? l.dias_trabalhados : k === 'dias_vt' ? l.dias_vt : l.aviso_previo || 0);
  };
  const setVal = (id: number, k: keyof Ajuste, v: string) =>
    setEdit((x) => ({ ...x, [id]: { ...x[id], [k]: v === '' ? 0 : Number(v) } }));

  /**
   * Prévia do total enquanto o mês não é salvo: o custo é proporcional aos dias, então mexer nos
   * dias sem ver o total mudar faria o RH salvar às cegas pra descobrir o número.
   */
  const totalPrevia = useMemo(() => linhas.reduce((s, l) => {
    const e = edit[l.funcionario_id];
    if (!e?.dias_trabalhados || !l.dias_trabalhados) return s + l.custo_empresa;
    const fixos = l.adicionais + l.aviso_previo + l.consumacao;
    const proporcional = (l.custo_empresa - fixos) / l.dias_trabalhados * e.dias_trabalhados;
    return s + proporcional + fixos;
  }, 0), [linhas, edit]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const ajustes = Object.entries(edit).map(([id, a]) => ({ funcionario_id: Number(id), ...a }));
      await api.post('/api/rh/cmo-fixo', { ano, mes, ajustes });
      setEdit({});
      await mutate();
      showToast({ type: 'success', title: 'Mês salvo', message: `${ajustes.length || linhas.length} linha(s) gravada(s)` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    } finally { setSalvando(false); }
  };

  const trancar = async (acao: 'fechar' | 'reabrir') => {
    setSalvando(true);
    try {
      await api.post('/api/rh/cmo-fixo', { ano, mes, acao });
      setEdit({});
      await mutate();
      showToast({ type: 'success', title: acao === 'fechar' ? 'Mês fechado' : 'Mês reaberto' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não deu', message: e?.message });
    } finally { setSalvando(false); }
  };

  const r = data?.resumo;
  // marca a primeira linha de cada grupo aqui, e não no meio do JSX: atribuir variável durante o
  // render é o tipo de coisa que funciona até a lista reordenar.
  const comCabecalho = useMemo(() => {
    let anterior = '';
    return linhas.map((l) => {
      const primeiro = l.grupo !== anterior;
      anterior = l.grupo;
      return { l, primeiro };
    });
  }, [linhas]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input type="month" value={mesAno} onChange={(e) => { setMesAno(e.target.value); setEdit({}); }}
            className="h-9 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-sm" />
          {fechado && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <Lock className="w-3.5 h-3.5" /> mês fechado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTudo((v) => !v)}>
            {tudo ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {tudo ? 'Resumido' : 'Todas as colunas'}
          </Button>
          {!fechado && (
            <Button size="sm" onClick={salvar} disabled={salvando || isLoading}>
              {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              {sujo ? 'Salvar alterações' : 'Gravar mês'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => trancar(fechado ? 'reabrir' : 'fechar')} disabled={salvando}>
            {fechado ? <LockOpen className="w-4 h-4 mr-1.5" /> : <Lock className="w-4 h-4 mr-1.5" />}
            {fechado ? 'Reabrir' : 'Fechar mês'}
          </Button>
        </div>
      </div>

      {r && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi label="Pessoas" value={`${r.pessoas}`} sub={`${r.clt} CLT · ${r.pj} PJ`} />
          <Kpi label="Líquido" value={fmtC(r.salario_liquido)} />
          <Kpi label="Encargos" value={fmtC(r.encargos)} sub="INSS + FGTS + provisão + sindical" />
          <Kpi label="VT + benefícios" value={fmtC(r.vale_transporte + r.adicionais + r.consumacao)} />
          <Kpi label="Custo-empresa" value={fmtC(sujo ? totalPrevia : r.custo_empresa)}
            cor="text-emerald-600 dark:text-emerald-400" sub={sujo ? 'prévia (não salvo)' : undefined} />
        </div>
      )}

      {/* Cadastro incompleto vira custo 0 e o total mental do RH fica menor do que a realidade —
          então a tela cobra o cadastro em vez de esconder o furo. */}
      {data?.sem_salario?.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px]">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>{data.sem_salario.length} pessoa(s) sem salário no cadastro</strong> — entram com custo zero:{' '}
            {data.sem_salario.join(', ')}.
          </span>
        </div>
      )}

      <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
        ) : linhas.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Ninguém em cadeira ocupada no organograma deste bar.
          </div>
        ) : (
          <table className="w-full text-[13px] whitespace-nowrap">
            <thead className="text-[10px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-muted/40">Pessoa</th>
                <th className="text-center px-2 py-2">Tipo</th>
                <th className="text-center px-2 py-2">Dias</th>
                <th className="text-right px-2 py-2">Salário</th>
                {tudo && <>
                  <th className="text-right px-2 py-2">Estimativa</th>
                  <th className="text-right px-2 py-2">Ad. not.</th>
                  <th className="text-right px-2 py-2">DSR</th>
                  <th className="text-right px-2 py-2">T. casa</th>
                  <th className="text-right px-2 py-2">Produt.</th>
                  <th className="text-right px-2 py-2">Desc VT</th>
                  <th className="text-right px-2 py-2">INSS</th>
                  <th className="text-right px-2 py-2">IR</th>
                </>}
                <th className="text-right px-2 py-2">Líquido</th>
                {tudo && <>
                  <th className="text-right px-2 py-2">INSS emp.</th>
                  <th className="text-right px-2 py-2">FGTS</th>
                  <th className="text-right px-2 py-2">Provisão</th>
                  <th className="text-right px-2 py-2">Sindical</th>
                </>}
                <th className="text-center px-2 py-2">Dias VT</th>
                <th className="text-right px-2 py-2">VT</th>
                <th className="text-right px-2 py-2">Adicional</th>
                {tudo && <>
                  <th className="text-right px-2 py-2">Consumação</th>
                  <th className="text-center px-2 py-2">Aviso</th>
                </>}
                <th className="text-right px-3 py-2">Custo-empresa</th>
              </tr>
            </thead>
            <tbody>
              {comCabecalho.map(({ l, primeiro }) => {
                const pj = l.tipo_contratacao !== 'CLT';
                return (
                  <Fragment key={l.funcionario_id}>
                    {primeiro && (
                      <tr className="bg-muted/60">
                        <td colSpan={30} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {l.grupo}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-1.5 sticky left-0 bg-[hsl(var(--card))]">
                        <span className="font-medium">{l.nome}</span>
                        <span className="block text-[10px] text-muted-foreground">{l.cargo || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center text-[11px] text-muted-foreground">{l.tipo_contratacao}</td>
                      <td className="px-2 py-1.5 text-center">
                        {fechado ? l.dias_trabalhados : (
                          <input type="number" min={0} max={l.dias_mes} value={val(l, 'dias_trabalhados')}
                            onChange={(e) => setVal(l.funcionario_id, 'dias_trabalhados', e.target.value)}
                            className="w-14 h-7 text-center rounded border border-[hsl(var(--border))] bg-transparent tabular-nums" />
                        )}
                        <span className="text-[10px] text-muted-foreground">/{l.dias_mes}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.salario_bruto)}</td>
                      {tudo && <>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.estimativa)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.adicional_noturno)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.drs_noturno)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.tempo_casa)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.produtividade)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-red-600/80">{fmt(l.desc_vale_transporte)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-red-600/80">{fmt(l.inss)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.ir)}</td>
                      </>}
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmt(l.salario_liquido)}</td>
                      {tudo && <>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.inss_empresa)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.fgts)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.provisao_certa)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.mensalidade_sindical)}</td>
                      </>}
                      <td className="px-2 py-1.5 text-center">
                        {fechado ? l.dias_vt : (
                          <input type="number" min={0} max={31} value={val(l, 'dias_vt')}
                            onChange={(e) => setVal(l.funcionario_id, 'dias_vt', e.target.value)}
                            className="w-14 h-7 text-center rounded border border-[hsl(var(--border))] bg-transparent tabular-nums" />
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums" title={`${l.dias_vt} × ${fmt(l.vt_diaria)}`}>{fmt(l.vale_transporte)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.adicionais)}</td>
                      {tudo && <>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.consumacao)}</td>
                        <td className="px-2 py-1.5 text-center">
                          {fechado ? fmt(l.aviso_previo) : (
                            <input type="number" step="0.01" value={val(l, 'aviso_previo')}
                              onChange={(e) => setVal(l.funcionario_id, 'aviso_previo', e.target.value)}
                              className="w-20 h-7 text-right px-1 rounded border border-[hsl(var(--border))] bg-transparent tabular-nums" />
                          )}
                        </td>
                      </>}
                      <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${pj ? 'text-sky-600 dark:text-sky-400' : ''}`}>
                        {fmt(l.custo_empresa)}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong>Dias</strong> saem da admissão/demissão (quem entrou no dia 20 custa 11/31) e rateiam o
        custo. <strong>Dias VT</strong> é quanto a pessoa trabalha no mês — sai de dias/semana do cadastro
        e vai virar automático quando o check-in da escala estiver rodando. Salário, VT, adicional,
        consumação, estimativa e tempo de casa vêm do <strong>cadastro da pessoa</strong>; adicional
        noturno vem da <strong>área</strong> e cargo de confiança não recebe. Gravar congela o cálculo;
        fechar o mês impede alteração.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, cor }: { label: string; value: string; sub?: string; cor?: string }) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
      <CardContent className="p-3.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold mt-0.5 ${cor || ''}`}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
