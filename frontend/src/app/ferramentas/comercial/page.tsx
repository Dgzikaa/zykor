'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  TrendingUp,
  Target,
  Trophy,
  Music,
  CalendarDays,
  Megaphone,
  Info,
  Flame,
  Crown,
  Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { 
  DATAS_2026, 
  FERIADOES_2026, 
  EventoConcorrenciaBD 
} from './data/constants'
import { buscarEventosConcorrencia } from './services/comercial-service'
import {
  CalendarioVisualTab,
  ListaDatasTab,
  FeriadoesTab,
  PlanoAcaoTab,
  EventosTab,
  HistoricoInsightsTab,
} from './components'

export default function ComercialPage() {
  const [searchTerm, setSearchTerm] = useState('')
  
  const [eventosConcorrenciaBD, setEventosConcorrenciaBD] = useState<EventoConcorrenciaBD[]>([])
  const [loadingEventos, setLoadingEventos] = useState(false)

  const handleRefreshEventos = useCallback(async () => {
    setLoadingEventos(true)
    try {
      const eventos = await buscarEventosConcorrencia()
      setEventosConcorrenciaBD(eventos)
    } finally {
      setLoadingEventos(false)
    }
  }, [])

  useEffect(() => {
    handleRefreshEventos()
  }, [handleRefreshEventos])

  const stats = useMemo(() => {
    const feriadosOuro = DATAS_2026.filter(f => f.potencial === 'maximo').length
    const copaJogos = DATAS_2026.filter(f => f.tipo === 'copa').length
    const festivais = DATAS_2026.filter(f => f.tipo === 'festival').length
    const feriadoes = FERIADOES_2026.length
    
    return { feriadosOuro, copaJogos, festivais, feriadoes }
  }, [])

  const datasFiltradas = useMemo(() => {
    if (!searchTerm) return DATAS_2026
    return DATAS_2026.filter(f => 
      f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.dica.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <Megaphone className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Central Comercial 2026
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Planejamento estratégico de datas, eventos e oportunidades
              </p>
            </div>
          </div>
        </motion.div>

        {/* Legenda de cores */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Potencial:</span>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-sm" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Máximo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 shadow-sm" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Alto</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-sm" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Médio</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 shadow-sm" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Baixo</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <Info className="w-4 h-4" />
            Passe o mouse sobre os dias coloridos para ver detalhes
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Flame className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.feriadosOuro}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Datas Potencial Máximo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.copaJogos}</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">Jogos Copa do Mundo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Music className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.festivais}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Festivais/Shows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.feriadoes}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Feriadões Identificados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="calendario" className="space-y-6">
          <TabsList className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="calendario" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white rounded-lg">
              <Calendar className="w-4 h-4 mr-2" />
              Calendário Visual
            </TabsTrigger>
            <TabsTrigger value="lista" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white rounded-lg">
              <CalendarDays className="w-4 h-4 mr-2" />
              Lista de Datas
            </TabsTrigger>
            <TabsTrigger value="feriadoes" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white rounded-lg">
              <Crown className="w-4 h-4 mr-2" />
              Feriadões
            </TabsTrigger>
            <TabsTrigger value="acoes" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white rounded-lg">
              <Target className="w-4 h-4 mr-2" />
              Plano de Ação
            </TabsTrigger>
            <TabsTrigger value="concorrencia" className="data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg">
              <Users className="w-4 h-4 mr-2" />
              Concorrência BSB
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-lg">
              <TrendingUp className="w-4 h-4 mr-2" />
              Histórico 2025
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendario" className="space-y-6">
            <CalendarioVisualTab />
          </TabsContent>

          <TabsContent value="lista" className="space-y-6">
            <ListaDatasTab
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              datasFiltradas={datasFiltradas}
            />
          </TabsContent>

          <TabsContent value="feriadoes" className="space-y-6">
            <FeriadoesTab />
          </TabsContent>

          <TabsContent value="acoes" className="space-y-6">
            <PlanoAcaoTab />
          </TabsContent>

          <TabsContent value="concorrencia" className="space-y-6">
            <EventosTab
              eventosConcorrenciaBD={eventosConcorrenciaBD}
              loadingEventos={loadingEventos}
              onRefresh={handleRefreshEventos}
            />
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <HistoricoInsightsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
