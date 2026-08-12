'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ChevronLeft, ChevronRight, Loader2, CalendarRange } from 'lucide-react';

type Funcao = { id: string; codigo: string; nome: string; entra_no_custo: boolean; ordem: number };
type Celula = { id: string; entra: string | null; sai: string | null; horas: number | null; marcador: string | null; turno: string };
type Pessoa = { chave: string; funcao_id: string; slot: number; nome: string; dias: Record<string, Celula> };

/** Marcadores que a operação usa. Digitar qualquer um deles no lugar do horário grava o marcador. */
const MARCADORES = ['FOLGA', 'FÉRIAS', 'ATESTADO', 'BANCO', 'ABRE', 'FECHA', 'INTERMEDIÁRIO'];

const COR_MARCADOR: Record<string, string> = {
  FOLGA: 'text-gray-400',
  'FÉRIAS': 'text-blue-500',
  ATESTADO: 'text-red-500',
  BANCO: 'text-purple-500',
};

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somaDias = (d: Date, n: number) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
function segundaDa(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return x;
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

/**
 * Célula da escala. Aceita "15:00-01:00" (entra-sai) ou um marcador (FOLGA, FÉRIAS…).
 * Formato livre de propósito: quem preenche a escala hoje digita rápido na planilha e
 * um formulário com 3 campos por dia seria mais lento do que o Excel que estamos tirando.
 */
function CelulaEscala({ cel, onSalvar, disabled }: {
  cel: Celula | undefined; onSalvar: (txt: string) => void; disabled?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState('');

  const mostrar = () => {
    if (!cel) return '';
    if (cel.marcador) return cel.marcador;
    if (cel.entra) return `${hhmm(cel.entra)}${cel.sai ? '-' + hhmm(cel.sai) : ''}`;
    return '';
  };
  const atual = mostrar();
  const cor = cel?.marcador ? (COR_MARCADOR[cel.marcador] || 'text-amber-600') : '';

  if (disabled) return <span className={`block px-1 py-1 text-center text-[11px] ${cor}`}>{atual || '—'}</span>;

  if (editando) {
    return (
      <input
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => { setEditando(false); if (txt !== atual) onSalvar(txt); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setTxt(atual); setEditando(false); }
        }}
        ref={(el) => el?.focus()}
        placeholder="15:00-01:00"
        className="w-full px-1 py-1 text-center text-[11px] border border-blue-400 rounded bg-white dark:bg-gray-900"
      />
    );
  }
  return (
    <button
      onClick={() => { setTxt(atual); setEditando(true); }}
      className={`w-full px-1 py-1 text-center text-[11px] rounded hover:ring-1 hover:ring-blue-400 ${cor} ${!atual ? 'text-gray-300' : ''}`}
    >
      {atual || '·'}
    </button>
  );
}

export default function EscalaPage() {
  const { setPageTitle } = usePageTitle();
  const { soLeitura } = useModuloPermissao('/operacao/escala');
  const { showToast } = useToast();
  useEffect(() => { setPageTitle('👥 Escala'); return () => setPageTitle(''); }, [setPageTitle]);

  const [segunda, setSegunda] = useState(() => segundaDa(new Date()));
  const de = iso(segunda);
  const ate = iso(somaDias(segunda, 6));
  const datas = useMemo(() => Array.from({ length: 7 }, (_, i) => iso(somaDias(segunda, i))), [segunda]);

  const { data, isLoading, mutate } = useApiSWR<{ funcoes: Funcao[]; pessoas: Pessoa[] }>(
    `/api/operacao/escala?de=${de}&ate=${ate}`,
  );

  const funcoes = data?.funcoes || [];
  const pessoas = data?.pessoas || [];

  /** Interpreta o texto digitado: horário "15:00-01:00" ou marcador. */
  const salvar = useCallback(async (p: Pessoa, dataISO: string, txt: string) => {
    const limpo = txt.trim();
    try {
      if (!limpo) {
        await api.patch('/api/operacao/escala', { data: dataISO, funcao_id: p.funcao_id, slot: p.slot, apagar: true });
      } else {
        const m = /^(\d{1,2}):?(\d{2})\s*[-–a]\s*(\d{1,2}):?(\d{2})$/.exec(limpo);
        if (m) {
          const entra = `${m[1].padStart(2, '0')}:${m[2]}`;
          const sai = `${m[3].padStart(2, '0')}:${m[4]}`;
          // horas líquidas: a operação desconta 1h ou 2h de intervalo conforme o turno, e isso
          // varia caso a caso na planilha — aqui grava a duração bruta e deixa o ajuste manual.
          let dur = (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
          if (dur < 0) dur += 24 * 60; // virou o dia
          await api.patch('/api/operacao/escala', {
            data: dataISO, funcao_id: p.funcao_id, slot: p.slot, pessoa_nome: p.nome,
            entra, sai, horas: Math.round((dur / 60) * 100) / 100,
          });
        } else {
          const up = limpo.toUpperCase();
          const marcador = MARCADORES.find(x => up.startsWith(x.slice(0, 4))) || up;
          await api.patch('/api/operacao/escala', {
            data: dataISO, funcao_id: p.funcao_id, slot: p.slot, pessoa_nome: p.nome,
            entra: null, sai: null, horas: null, marcador,
          });
        }
      }
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    }
  }, [mutate, showToast]);

  // contagem de escalados por dia — é exatamente o FIXOS que o Plano Operacional consome
  const escaladosNoDia = (dataISO: string, funcaoId?: string) =>
    pessoas.filter(p => (!funcaoId || p.funcao_id === funcaoId) && p.dias[dataISO]?.entra).length;

  return (
    <PageShell width="wide">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSegunda(s => somaDias(s, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium inline-flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            {de.slice(8)}/{de.slice(5, 7)} — {ate.slice(8)}/{ate.slice(5, 7)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSegunda(s => somaDias(s, 7))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setSegunda(segundaDa(new Date()))}>hoje</Button>
        </div>
        {soLeitura && <BadgeSomenteLeitura />}
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…
        </CardContent></Card>
      ) : pessoas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma escala nesta semana.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-[hsl(var(--card))] z-10 min-w-[160px]">Pessoa</th>
                {datas.map(d => {
                  const [a, m, dd] = d.split('-').map(Number);
                  const dow = new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
                  return (
                    <th key={d} className="px-2 py-2 font-medium text-center min-w-[92px]">
                      {DIA_CURTO[dow]} {String(dd).padStart(2, '0')}/{String(m).padStart(2, '0')}
                      <div className="text-[10px] font-normal text-muted-foreground">{escaladosNoDia(d)} escalados</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {funcoes.map(f => {
                const doGrupo = pessoas.filter(p => p.funcao_id === f.id);
                if (!doGrupo.length) return null;
                return (
                  <Fragment key={f.id}>
                    <tr className="bg-muted/50 border-y border-[hsl(var(--border))]">
                      <td className="px-3 py-1 font-semibold sticky left-0 bg-muted/50">
                        {f.nome}
                        {!f.entra_no_custo && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(fora do custo)</span>}
                      </td>
                      {datas.map(d => (
                        <td key={d} className="px-2 py-1 text-center text-[10px] text-muted-foreground tabular-nums">
                          {escaladosNoDia(d, f.id) || ''}
                        </td>
                      ))}
                    </tr>
                    {doGrupo.map(p => (
                      <tr key={p.chave} className="border-b border-[hsl(var(--border))] hover:bg-muted/30">
                        <td className="px-3 py-1 sticky left-0 bg-[hsl(var(--card))] whitespace-nowrap">{p.nome}</td>
                        {datas.map(d => (
                          <td key={d} className="px-0.5 py-0.5">
                            <CelulaEscala cel={p.dias[d]} disabled={soLeitura}
                              onSalvar={(txt) => salvar(p, d, txt)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      <p className="text-xs text-muted-foreground">
        Digite <b>15:00-01:00</b> para escalar, ou um marcador (<b>FOLGA</b>, <b>FÉRIAS</b>, <b>ATESTADO</b>,
        <b> BANCO</b>). Apagar a célula remove o dia da pessoa. A contagem de escalados por dia é
        exatamente o <b>FIXOS</b> que o Plano Operacional consome — mexeu aqui, o custo projetado
        de lá se ajusta sozinho.
      </p>
    </PageShell>
  );
}
