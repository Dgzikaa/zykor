'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { AREAS, CORES, corNota, corFelicidade, fmtTempo, type AreaOperacional } from '@/lib/operacao/painel-lider';
import {
  Smile, Timer, PackageX, Users, MessageSquareQuote, ArrowUpRight, ArrowDownRight,
  Minus, ExternalLink, AlertTriangle,
} from 'lucide-react';

/**
 * Painel do Líder (Mafê, 22/08/2026): cada liderança abre e vê os indicadores DA ÁREA DELA.
 *
 * A área vem da cadeira do organograma — quem é Chefe de Bar abre no Bar, sem filtro pra errar.
 * Gerência e sócio caem no seletor e enxergam todas.
 *
 * Regra da tela: nenhum número nasce aqui. Todo card aponta pra tela onde aquele indicador mora
 * inteiro, porque o painel é o resumo do dia a dia, não uma segunda versão da verdade.
 */

const PERIODOS = [7, 30, 90];

export default function PainelLiderPage() {
  const { setPageTitle } = usePageTitle();
  const [area, setArea] = useState<AreaOperacional | ''>('');
  const [dias, setDias] = useState(30);

  useEffect(() => {
    setPageTitle('🎯 Painel do Líder');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { data, isLoading } = useApiSWR<any>(
    `/api/operacao/painel-lider?dias=${dias}${area ? `&area=${encodeURIComponent(area)}` : ''}`,
  );

  // A área efetiva vem do servidor na 1ª carga (a do organograma); só depois o seletor manda.
  const areaAtual: string = data?.area || area || '';
  const podeTrocar = data?.pode_trocar === true;

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-4 max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {areaAtual || '—'}
              {data?.sou && <span className="ml-2 text-sm font-normal text-gray-500">· {data.sou}</span>}
            </div>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              {podeTrocar
                ? 'Você enxerga todas as áreas — escolha qual acompanhar.'
                : 'Os indicadores da sua área. Clique em qualquer card pra abrir a tela completa.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PERIODOS.map((d) => (
              <button key={d} onClick={() => setDias(d)}
                className={`h-8 px-2.5 rounded-md text-sm border transition ${d === dias
                  ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {podeTrocar && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {AREAS.map((a) => (
              <button key={a} onClick={() => setArea(a)}
                className={`h-8 px-3 rounded-full text-sm border transition ${a === areaAtual
                  ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                {a}
              </button>
            ))}
          </div>
        )}

        {isLoading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* NPS da área — o que o cliente disse sobre o que ELA entrega */}
            {data.nps && (
              <CardIndicador
                icone={<MessageSquareQuote className="h-4 w-4 text-violet-500" />}
                titulo={`NPS · ${data.nps.dimensao}`}
                link={data.nps.link}
                valor={data.nps.nota != null ? data.nps.nota.toFixed(2).replace('.', ',') : '—'}
                sufixo={data.nps.nota != null ? '/ 5' : ''}
                cor={CORES[corNota(data.nps.nota)]}
                delta={data.nps.delta}
                deltaBomSeSobe
                rodape={data.nps.n > 0
                  ? <>{data.nps.n} resposta{data.nps.n === 1 ? '' : 's'}{data.nps.reclamacoes > 0 && (
                      <span className="text-rose-600 dark:text-rose-400"> · {data.nps.reclamacoes} nota ≤ 3</span>
                    )}</>
                  : 'sem resposta no período'}
              />
            )}

            {/* Tempo de saída — só Bar e Cozinha têm o próprio no ContaHub */}
            {data.tempo && (
              <CardIndicador
                icone={<Timer className="h-4 w-4 text-sky-500" />}
                titulo={data.tempo.rotulo}
                link={data.tempo.link}
                valor={fmtTempo(data.tempo.seg)}
                cor={CORES.vazio}
                delta={data.tempo.delta}
                // Tempo é ao contrário: cair é bom.
                deltaBomSeSobe={false}
                deltaFmt={(v: number) => fmtTempo(Math.abs(v))}
                rodape={data.tempo.dias_com_dado > 0
                  ? `média de ${data.tempo.dias_com_dado} dia(s) com movimento`
                  : 'sem dado no período'}
              />
            )}

            {/* Atrasos de pedido (hoje só o bar tem no ContaHub) */}
            {data.tempo?.atrasos && (
              <CardIndicador
                icone={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                titulo="Pedidos atrasados"
                link={data.tempo.link}
                valor={String(data.tempo.atrasos.atrasinho + data.tempo.atrasos.atrasao)}
                cor={data.tempo.atrasos.atrasao > 0 ? CORES.ruim : CORES.atencao}
                rodape={<>{data.tempo.atrasos.atrasinho} atrasinho · <b>{data.tempo.atrasos.atrasao}</b> atrasão</>}
              />
            )}

            {/* Stockout: o que faltou pra vender */}
            {data.stockout && (
              <CardIndicador
                icone={<PackageX className="h-4 w-4 text-rose-500" />}
                titulo="Stockout"
                link={data.stockout.link}
                valor={data.stockout.pct != null ? `${String(data.stockout.pct).replace('.', ',')}%` : '—'}
                cor={data.stockout.pct == null ? CORES.vazio
                  : data.stockout.pct >= 10 ? CORES.ruim : data.stockout.pct >= 5 ? CORES.atencao : CORES.bom}
                rodape={data.stockout.top?.length
                  ? <>mais faltou: <b>{data.stockout.top[0].nome}</b> ({data.stockout.top[0].vezes}×)</>
                  : `${data.stockout.zerados} de ${data.stockout.total} itens`}
              />
            )}

            {/* Felicidade da equipe da área */}
            {data.felicidade && (
              <CardIndicador
                icone={<Smile className="h-4 w-4 text-emerald-500" />}
                titulo="Felicidade da equipe"
                link={data.felicidade.link}
                valor={data.felicidade.pct != null ? `${String(data.felicidade.pct).replace('.', ',')}%` : '—'}
                cor={CORES[corFelicidade(data.felicidade.pct)]}
                rodape={data.felicidade.data
                  ? `setor ${data.felicidade.setor} · ${String(data.felicidade.data).slice(0, 10).split('-').reverse().join('/')}`
                  : 'sem pesquisa registrada'}
              />
            )}

            {/* Time da área */}
            {data.equipe && (
              <CardIndicador
                icone={<Users className="h-4 w-4 text-gray-500" />}
                titulo="Equipe"
                link={data.equipe.link}
                valor={String(data.equipe.pessoas)}
                cor={CORES.vazio}
                rodape="pessoas ativas na área"
              />
            )}
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Todo indicador aqui é um recorte da tela onde ele mora inteiro — se um número divergir do
          detalhe, é bug, não metodologia diferente. <b>Ambiente, música e custo-benefício</b> ficam
          fora de propósito: são da casa, não de uma área.
        </p>
      </div>
    </ProtectedRoute>
  );
}

function CardIndicador({
  icone, titulo, valor, sufixo, cor, rodape, delta, deltaBomSeSobe = true, deltaFmt, link,
}: {
  icone: React.ReactNode; titulo: string; valor: string; sufixo?: string; cor: string;
  rodape?: React.ReactNode; delta?: number | null; deltaBomSeSobe?: boolean;
  deltaFmt?: (v: number) => string; link?: string;
}) {
  const temDelta = delta != null && delta !== 0;
  const subiu = (delta ?? 0) > 0;
  const bom = subiu === deltaBomSeSobe;
  const corpo = (
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">{icone}{titulo}</div>
        {link && <ExternalLink className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
        <span className={`text-2xl font-bold ${cor}`}>{valor}</span>
        {sufixo && <span className="text-xs text-gray-400">{sufixo}</span>}
        {temDelta && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
            bom ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {subiu ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {deltaFmt ? deltaFmt(delta!) : String(Math.abs(delta!)).replace('.', ',')}
          </span>
        )}
        {delta === 0 && <Minus className="h-3 w-3 text-gray-400" />}
      </div>
      {rodape && <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{rodape}</div>}
    </CardContent>
  );
  return link
    ? <Link href={link} className="block"><Card className="hover:border-violet-300 dark:hover:border-violet-700 transition">{corpo}</Card></Link>
    : <Card>{corpo}</Card>;
}
