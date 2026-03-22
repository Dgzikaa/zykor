'use client'

import { motion } from 'framer-motion'
import {
  Calendar,
  CalendarDays,
  Crown,
  Target,
  Lightbulb,
  Flame,
  TrendingUp,
  TrendingDown,
  Zap,
  Trophy,
  Gift,
  PartyPopper,
  Snowflake,
  Star,
  Heart,
  Flag,
  Users,
  Sparkles,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DataImportante, DATAS_2026, FERIADOES_2026, MESES, IDEIAS_ACOES } from '../data/constants'
import { CalendarioMes } from './CalendarMini'

interface DatasImportantesTabProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  datasFiltradas: DataImportante[]
}

export function CalendarioVisualTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {MESES.map((_, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05 }}
        >
          <CalendarioMes mes={idx} ano={2026} datasImportantes={DATAS_2026} />
        </motion.div>
      ))}
    </div>
  )
}

export function ListaDatasTab({ searchTerm, setSearchTerm, datasFiltradas }: DatasImportantesTabProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const getPotencialColor = (potencial: string) => {
    switch (potencial) {
      case 'maximo': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
      case 'alto': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
      case 'medio': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700'
      case 'baixo': return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'copa': return <Trophy className="w-4 h-4 text-yellow-500" />
      case 'carnaval': return <PartyPopper className="w-4 h-4 text-purple-500" />
      case 'pascoa': return <Gift className="w-4 h-4 text-pink-500" />
      case 'festa_junina': return <Sparkles className="w-4 h-4 text-orange-500" />
      case 'natal': return <Snowflake className="w-4 h-4 text-blue-400" />
      case 'reveillon': return <Star className="w-4 h-4 text-yellow-400" />
      case 'especial': return <Heart className="w-4 h-4 text-red-500" />
      case 'futebol': return <Trophy className="w-4 h-4 text-green-500" />
      case 'nacional': return <Flag className="w-4 h-4 text-green-600" />
      case 'concorrencia': return <Users className="w-4 h-4 text-red-500" />
      case 'brasilia': return <Flag className="w-4 h-4 text-yellow-500" />
      default: return <Calendar className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar data, evento ou tipo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Calendar className="w-5 h-5 text-emerald-500" />
            Todas as Datas Importantes 2026
            <span className="text-sm font-normal text-gray-500">({datasFiltradas.length} datas)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Dia</th>
                  <th className="pb-3 font-medium">Evento</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Potencial</th>
                  <th className="pb-3 font-medium">Dica</th>
                </tr>
              </thead>
              <tbody>
                {datasFiltradas.map((data, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.01 }}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 font-mono text-gray-600 dark:text-gray-400">
                      {formatDate(data.data)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ['Sexta', 'Sábado'].includes(data.diaSemana) 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                          : data.diaSemana === 'Domingo'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {data.diaSemana}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {getTipoIcon(data.tipo)}
                        {data.nome}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {data.tipo.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getPotencialColor(data.potencial)}`}>
                        {data.potencial === 'maximo' && <Flame className="w-3 h-3" />}
                        {data.potencial === 'alto' && <TrendingUp className="w-3 h-3" />}
                        {data.potencial === 'medio' && <Target className="w-3 h-3" />}
                        {data.potencial === 'baixo' && <TrendingDown className="w-3 h-3" />}
                        {data.potencial}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-gray-600 dark:text-gray-400 max-w-xs">
                      💡 {data.dica}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function FeriadoesTab() {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const getPotencialColor = (potencial: string) => {
    switch (potencial) {
      case 'maximo': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
      case 'alto': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
      case 'medio': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700'
      case 'baixo': return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Crown className="w-5 h-5" />
            Feriadões 2026 - Oportunidades de Ouro
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Períodos com múltiplos dias de folga - máximo potencial de faturamento
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FERIADOES_2026.map((f, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-amber-200 dark:border-amber-800 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{f.nome}</span>
                  <span className={`text-xs px-2 py-1 rounded-full border font-bold ${getPotencialColor(f.potencial)}`}>
                    {f.dias} dias
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  📅 {formatDate(f.inicio)} → {formatDate(f.fim)}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg">
                  💡 {f.descricao}
                </p>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resumo por Trimestre */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Zap className="w-5 h-5 text-indigo-500" />
            Resumo por Trimestre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
              <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Q1 (Jan-Mar)</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-center gap-2">🎭 <span>Carnaval (Fev)</span></li>
                <li className="flex items-center gap-2">☘️ <span>St. Patrick&apos;s (Mar)</span></li>
                <li className="flex items-center gap-2">🎵 <span>Lollapalooza (Mar)</span></li>
              </ul>
            </div>
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-xl border border-green-200 dark:border-green-800">
              <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Q2 (Abr-Jun)</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-center gap-2">🐰 <span>Páscoa (Abr)</span></li>
                <li className="flex items-center gap-2">👔 <span>Dia do Trabalho (Mai)</span></li>
                <li className="flex items-center gap-2">💑 <span>Dia Namorados (Jun)</span></li>
                <li className="flex items-center gap-2">🌽 <span>Festas Juninas</span></li>
                <li className="flex items-center gap-2 font-bold text-yellow-600">⚽ <span>COPA DO MUNDO!</span></li>
              </ul>
            </div>
            <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
              <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Q3 (Jul-Set)</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-center gap-2 font-bold text-yellow-600">🏆 <span>Final da Copa (Jul)</span></li>
                <li className="flex items-center gap-2">👨 <span>Dia dos Pais (Ago)</span></li>
                <li className="flex items-center gap-2">🇧🇷 <span>Independência (Set)</span></li>
                <li className="flex items-center gap-2">🎸 <span>Rock in Rio (Set)</span></li>
              </ul>
            </div>
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-xl border border-purple-200 dark:border-purple-800">
              <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Q4 (Out-Dez)</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-center gap-2">🎃 <span>Halloween (Out)</span></li>
                <li className="flex items-center gap-2 font-bold text-amber-600">🏆 <span>Final Libertadores (Nov)</span></li>
                <li className="flex items-center gap-2">🎄 <span>Confraternizações</span></li>
                <li className="flex items-center gap-2">🎆 <span>Réveillon</span></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function PlanoAcaoTab() {
  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Target className="w-5 h-5 text-purple-500" />
            Ideias de Ações Comerciais para 2026
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sugestões de ações para aumentar faturamento e recorrência
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {IDEIAS_ACOES.map((acao, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-xl border-2 ${
                  acao.prioridade === 'alta' 
                    ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' 
                    : acao.prioridade === 'media'
                    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{acao.titulo}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    acao.prioridade === 'alta' 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                      : acao.prioridade === 'media'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {acao.prioridade}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{acao.descricao}</p>
                <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                  {acao.categoria}
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dicas Gerais */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Lightbulb className="w-5 h-5" />
            Dicas de Ouro para 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h5 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                ⚽ Copa do Mundo
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>Fuso horário favorável: jogos à tarde/noite no Brasil</li>
                <li>Prepare decoração temática verde e amarela</li>
                <li>Monte combos especiais para jogos</li>
                <li>Reserve telão/TVs adicionais com antecedência</li>
                <li>Considere reservas antecipadas para jogos decisivos</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h5 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                📅 Feriadões
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>Planeje estoque extra para feriadões longos</li>
                <li>Escala de funcionários com antecedência</li>
                <li>Marketing 2-3 semanas antes das datas</li>
                <li>Promoções especiais para reservas antecipadas</li>
                <li>Parcerias com hotéis/pousadas para turistas</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
