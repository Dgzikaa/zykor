'use client'

import { motion } from 'framer-motion'
import {
  Calendar,
  Crown,
  DollarSign,
  Users,
  Trophy,
  TrendingUp,
  Lightbulb,
  Flame,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  TOP_DIAS_2025, 
  FATURAMENTO_POR_DIA_2025, 
  COMPARACAO_DATAS,
  DATAS_2026
} from '../data/constants'

export function HistoricoInsightsTab() {
  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Crown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  R$ {TOP_DIAS_2025[0]?.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) || '0'}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400">Melhor Dia de 2025</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  R$ {FATURAMENTO_POR_DIA_2025.find(d => d.diaSemana === 'Sexta')?.mediaFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) || '0'}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">Média Sextas-feiras</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {TOP_DIAS_2025[0]?.pessoas.toLocaleString('pt-BR') || '0'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Máximo de Pessoas (1 dia)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras - Faturamento por Dia da Semana */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <DollarSign className="w-5 h-5 text-green-500" />
            Faturamento Médio por Dia da Semana (2025)
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Análise de desempenho para planejar 2026
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {FATURAMENTO_POR_DIA_2025.map((dia, idx) => {
              const maxFat = Math.max(...FATURAMENTO_POR_DIA_2025.map(d => d.mediaFaturamento))
              const percent = (dia.mediaFaturamento / maxFat) * 100
              const isTop = dia.diaSemana === 'Sexta' || dia.diaSemana === 'Sábado'
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-4"
                >
                  <div className={`w-20 text-sm font-medium ${
                    isTop ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {dia.diaSemana.slice(0, 3)}
                  </div>
                  <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ delay: idx * 0.05 + 0.2, duration: 0.5 }}
                      className={`h-full rounded-lg flex items-center justify-end px-2 ${
                        isTop 
                          ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                          : dia.diaSemana === 'Quarta'
                          ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                          : 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-600'
                      }`}
                    >
                      {percent > 30 && (
                        <span className="text-xs font-semibold text-white">
                          R$ {dia.mediaFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </span>
                      )}
                    </motion.div>
                  </div>
                  {percent <= 30 && (
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-20">
                      R$ {(dia.mediaFaturamento / 1000).toFixed(0)}k
                    </span>
                  )}
                  {isTop && <Flame className="w-4 h-4 text-orange-500" />}
                </motion.div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span><strong>Insight:</strong> Sextas têm faturamento 3.5x maior que domingos. Quartas surpreendem!</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Top Dias 2025 */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 15 Melhores Dias de 2025
            <span className="text-sm font-normal text-gray-500 ml-2">(Dados reais do sistema)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 font-medium">#</th>
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Dia</th>
                  <th className="pb-3 font-medium">Evento/Motivo</th>
                  <th className="pb-3 font-medium text-right">Faturamento</th>
                  <th className="pb-3 font-medium text-right">Pessoas</th>
                  <th className="pb-3 font-medium text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {TOP_DIAS_2025.slice(0, 15).map((dia, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`border-b border-gray-100 dark:border-gray-700/50 ${
                      idx < 3 ? 'bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/10 dark:to-transparent' : ''
                    }`}
                  >
                    <td className="py-3">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                    </td>
                    <td className="py-3 font-mono text-gray-600 dark:text-gray-400">
                      {new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        dia.diaSemana === 'Sexta' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                          : dia.diaSemana === 'Sábado'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {dia.diaSemana}
                      </span>
                    </td>
                    <td className="py-3 text-gray-700 dark:text-gray-300">
                      {dia.evento || '-'}
                    </td>
                    <td className="py-3 text-right font-semibold text-green-600 dark:text-green-400">
                      R$ {dia.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                      {dia.pessoas.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                      R$ {dia.ticketMedio.toFixed(0)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Insights e Aprendizados */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Lightbulb className="w-5 h-5" />
            Insights de 2025 para Aplicar em 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h5 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                📈 O que Funcionou
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Confraternizações de Dezembro:</strong> 6 dos top 10 dias foram em dezembro. Foco em pacotes corporativos!</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Sextas-feiras dominam:</strong> 5 dos top 10 dias foram sextas. Priorizar promoções para este dia.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Festivais atraem:</strong> Lollapalooza weekend teve excelente performance. Rock in Rio 2026 será oportunidade.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Ticket médio alto em datas especiais:</strong> R$120+ em dias de pico vs R$97 em dias normais.</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h5 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                🎯 Aplicar em 2026
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span><strong>Copa do Mundo:</strong> Nunca tivemos dados de Copa. Preparar para lotação máxima!</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span><strong>Carnaval mais cedo:</strong> Em 2026 será em Fevereiro (vs Março 2025). Antecipar preparativos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span><strong>Quartas surpreendentes:</strong> Média de R$41k em quartas. Investir em promoções mid-week.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span><strong>Reservas antecipadas:</strong> Em datas de pico, sistema de reservas evita perda de clientes.</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativo de Datas Equivalentes */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Calendar className="w-5 h-5 text-purple-500" />
            Datas Equivalentes: 2025 vs 2026
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Referência de desempenho para planejar expectativas
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(COMPARACAO_DATAS).map(([data2026, dados], idx) => {
              const evento2026 = DATAS_2026.find(d => d.data === data2026)
              return (
                <motion.div
                  key={data2026}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">2026</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">2025</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-center">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {new Date(data2026 + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-500">{evento2026?.diaSemana}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <div className="text-center">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {new Date(dados.data2025 + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-500">{dados.evento2025.split(' ')[0]}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {evento2026?.nome || data2026}
                    </p>
                    {dados.faturamento2025 > 0 ? (
                      <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
                        Em 2025: R$ {dados.faturamento2025.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Sem dados comparáveis
                      </p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
