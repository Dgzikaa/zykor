'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CalendarRange, X } from 'lucide-react';
import type { Pedido } from '../types';

/**
 * Filtro de período dos pedidos — por VENCIMENTO ou por COMPETÊNCIA.
 *
 * Isaías (20/08/2026): "consegue deixar pra gente filtrar os lançamentos desses boletos? por
 * data de competência ou de vencimento". As duas datas respondem perguntas diferentes: o
 * vencimento é quando o dinheiro sai (fluxo de caixa) e a competência é a que mês a despesa
 * pertence (fechamento) — por isso é um SELETOR, não uma data só.
 *
 * Boleto sem competência preenchida cai no vencimento: melhor entrar no mês certo por
 * aproximação do que sumir da lista sem explicação.
 */

export type Campo = 'vencimento' | 'competencia';
export type Periodo = { campo: Campo; de: string; ate: string };

export const PERIODO_VAZIO: Periodo = { campo: 'vencimento', de: '', ate: '' };

/** A data que o filtro olha. Sem competência, o vencimento faz as vezes. */
export function dataDoPedido(p: Pedido, campo: Campo): string {
  const v = (p.data_vencimento || '').slice(0, 10);
  if (campo === 'vencimento') return v;
  return (p.data_competencia || '').slice(0, 10) || v;
}

export function aplicarPeriodo(pedidos: Pedido[], periodo: Periodo): Pedido[] {
  if (!periodo.de && !periodo.ate) return pedidos;
  return pedidos.filter((p) => {
    const d = dataDoPedido(p, periodo.campo);
    if (!d) return false;
    if (periodo.de && d < periodo.de) return false;
    if (periodo.ate && d > periodo.ate) return false;
    return true;
  });
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Primeiro e último dia do mês com deslocamento (0 = este mês, 1 = o que vem, -1 = passado). */
function mes(offset: number) {
  const h = new Date();
  const ini = new Date(h.getFullYear(), h.getMonth() + offset, 1);
  const fim = new Date(h.getFullYear(), h.getMonth() + offset + 1, 0);
  return { de: ymd(ini), ate: ymd(fim) };
}

export function FiltroPeriodo({
  periodo, onChange, total, filtrados, soma,
}: {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
  /** quantos existem na aba antes do filtro — pra tela dizer o que escondeu */
  total: number;
  filtrados: number;
  soma: number;
}) {
  const [aberto, setAberto] = useState(false);
  const ativo = !!(periodo.de || periodo.ate);

  const atalhos = useMemo(() => ([
    { rotulo: 'Este mês', ...mes(0) },
    { rotulo: 'Próximo mês', ...mes(1) },
    { rotulo: 'Mês passado', ...mes(-1) },
  ]), []);

  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={ativo ? 'default' : 'outline'} size="sm" onClick={() => setAberto((v) => !v)}>
          <CalendarRange className="w-4 h-4 mr-1.5" />
          {ativo
            ? `${periodo.campo === 'vencimento' ? 'Vencimento' : 'Competência'}: ${periodo.de ? periodo.de.slice(8, 10) + '/' + periodo.de.slice(5, 7) : '…'} – ${periodo.ate ? periodo.ate.slice(8, 10) + '/' + periodo.ate.slice(5, 7) : '…'}`
            : 'Filtrar por data'}
        </Button>
        {ativo && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...PERIODO_VAZIO, campo: periodo.campo })}>
              <X className="w-3.5 h-3.5 mr-1" />limpar
            </Button>
            <span className="text-[12px] text-muted-foreground">
              {filtrados} de {total} · total{' '}
              <b>{soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
            </span>
          </>
        )}
      </div>

      {aberto && (
        <div className="rounded-lg border border-[hsl(var(--border))] p-3 space-y-2.5">
          <div className="flex items-center gap-1.5">
            {(['vencimento', 'competencia'] as Campo[]).map((c) => (
              <button key={c} onClick={() => onChange({ ...periodo, campo: c })}
                className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition ${
                  periodo.campo === c
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>
                {c === 'vencimento' ? 'Por vencimento' : 'Por competência'}
              </button>
            ))}
            <span className="text-[11px] text-muted-foreground ml-1">
              {periodo.campo === 'vencimento'
                ? 'quando o dinheiro sai'
                : 'a que mês a despesa pertence (sem competência, usa o vencimento)'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-muted-foreground">De</label>
            <input type="date" value={periodo.de} onChange={(e) => onChange({ ...periodo, de: e.target.value })}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-sm" />
            <label className="text-[11px] text-muted-foreground">até</label>
            <input type="date" value={periodo.ate} onChange={(e) => onChange({ ...periodo, ate: e.target.value })}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-sm" />
            <div className="h-5 w-px bg-[hsl(var(--border))] mx-1" />
            {atalhos.map((a) => (
              <Button key={a.rotulo} variant="outline" size="sm" className="h-8"
                onClick={() => onChange({ ...periodo, de: a.de, ate: a.ate })}>
                {a.rotulo}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
