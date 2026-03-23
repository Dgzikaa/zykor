'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { Target, TrendingUp, Users, Wine, Ticket } from 'lucide-react'
import type { Estatisticas } from '../types'

export interface ClientesStatisticsProps {
  estatisticas: Estatisticas
}

export function ClientesStatistics({ estatisticas }: ClientesStatisticsProps) {
  const ticketGeral = Number(estatisticas.ticket_medio_geral) || 0
  const ticketEntrada = Number(estatisticas.ticket_medio_entrada) || 0
  const ticketConsumo = Number(estatisticas.ticket_medio_consumo) || 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Card className="card-dark shadow-sm overflow-hidden h-full">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              Clientes únicos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              <AnimatedCounter
                value={estatisticas.total_clientes_unicos}
                duration={2}
                className="text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">ContaHub</p>
          </CardContent>
        </Card>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-75">
        <Card className="card-dark shadow-sm overflow-hidden h-full">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
              Total de visitas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              <AnimatedCounter
                value={estatisticas.total_visitas_geral}
                duration={2.2}
                className="text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Desde a abertura</p>
          </CardContent>
        </Card>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-100">
        <Card className="card-dark shadow-sm overflow-hidden h-full">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0" aria-hidden />
              Ticket médio geral
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              <AnimatedCounter
                value={ticketGeral}
                duration={2.4}
                prefix="R$ "
                decimals={2}
                className="text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Por visita paga</p>
          </CardContent>
        </Card>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-125">
        <Card className="card-dark shadow-sm overflow-hidden h-full">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Ticket className="h-4 w-4 shrink-0" aria-hidden />
              🎫 Ticket entrada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              <AnimatedCounter
                value={ticketEntrada}
                duration={2.6}
                prefix="R$ "
                decimals={2}
                className="text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Couvert médio</p>
          </CardContent>
        </Card>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
        <Card className="card-dark shadow-sm overflow-hidden h-full">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Wine className="h-4 w-4 shrink-0" aria-hidden />
              🍺 Ticket consumo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              <AnimatedCounter
                value={ticketConsumo}
                duration={2.8}
                prefix="R$ "
                decimals={2}
                className="text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Consumação média</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
