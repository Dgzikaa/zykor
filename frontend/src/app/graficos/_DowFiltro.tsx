'use client';

/**
 * Filtro global por DIA DA SEMANA do hub /graficos.
 *
 * `dow` = 0..6 (0=domingo … 6=sábado) ou null = "Todos".
 *
 * IMPORTANTE: só faz sentido em análises com dado DIÁRIO (heatmap hora×dia de Vendas,
 * Atrações e Labels do Artístico, Custo de MO do RH). A maior parte do hub é semanal/
 * mensal/snapshot (DRE, DFC, desempenho semanal, RFM, coorte…) e NÃO se recorta por dia
 * da semana — nesses casos renderize <AvisoDow> pra deixar explícito que o filtro não
 * afeta aquele conteúdo (nada de filtro silencioso).
 */

export const DOW_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DOW_LONGO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function SeletorDow({ dow, onChange }: { dow: number | null; onChange: (d: number | null) => void }) {
  const opts: { v: number | null; l: string }[] = [{ v: null, l: 'Todos' }, ...DOW_CURTO.map((l, i) => ({ v: i, l }))];
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Filtrar por dia da semana">
      {opts.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className={`px-2 h-8 rounded-md text-xs border transition ${
            dow === o.v
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

/**
 * Selo "não se aplica". Só aparece quando um dia específico está selecionado.
 * `escopo` sobrescreve a mensagem padrão (ex.: numa seção mista, dizer qual gráfico responde).
 */
export function AvisoDow({ dow, escopo }: { dow: number | null; escopo?: string }) {
  if (dow == null) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-200 mb-3">
      📅 Filtro por dia da semana ativo (<b>{DOW_LONGO[dow]}</b>)
      {escopo
        ? ` — ${escopo}`
        : ' — esta seção usa dados semanais/mensais, então os gráficos abaixo não mudam com o dia da semana.'}
    </div>
  );
}
