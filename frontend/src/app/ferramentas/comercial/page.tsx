'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  TrendingUp,
  Target,
  Sparkles,
  Flag,
  Trophy,
  Heart,
  Music,
  PartyPopper,
  Gift,
  Sun,
  Snowflake,
  Star,
  Users,
  DollarSign,
  Lightbulb,
  Search,
  ChevronLeft,
  ChevronRight,
  Flame,
  Zap,
  Crown,
  CalendarDays,
  Megaphone,
  TrendingDown,
  Info,
  RefreshCcw,
  Plus,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingState } from '@/components/ui/loading-state'

// ========================================
// TIPOS
// ========================================
interface DataImportante {
  data: string
  nome: string
  tipo: string
  diaSemana: string
  potencial: 'maximo' | 'alto' | 'medio' | 'baixo'
  dica: string
  categoria?: string
}

interface DadosHistorico2025 {
  data: string
  diaSemana: string
  comandas: number
  faturamento: number
  pessoas: number
  ticketMedio: number
  evento?: string
}

interface FaturamentoPorDia {
  diaSemana: string
  diaSemanaNum: number
  totalDias: number
  faturamentoTotal: number
  mediaFaturamento: number
}

// Interface para eventos do banco de dados
interface EventoConcorrenciaBD {
  id: string
  nome: string
  descricao?: string
  local_nome: string
  local_endereco?: string
  cidade: string
  data_evento: string
  horario_inicio?: string
  tipo: string
  impacto: 'alto' | 'medio' | 'baixo'
  fonte: string
  url_fonte?: string
  preco_minimo?: number
  preco_maximo?: number
  imagem_url?: string
  status: string
  verificado: boolean
  notas?: string
  created_at: string
}

// ========================================
// DADOS DE 2026 - DATAS IMPORTANTES
// ========================================

// Todas as datas importantes de 2026
const DATAS_2026: DataImportante[] = [
  // Janeiro
  { data: '2026-01-01', nome: 'Ano Novo', tipo: 'nacional', diaSemana: 'Quinta', potencial: 'alto', dica: 'Véspera é QUARTA - ótimo para evento especial' },
  
  // Fevereiro - Carnaval
  { data: '2026-02-08', nome: 'Supercopa do Brasil', tipo: 'futebol', diaSemana: 'Domingo', potencial: 'alto', dica: 'Primeira decisão do ano' },
  { data: '2026-02-14', nome: 'Carnaval (Sábado)', tipo: 'carnaval', diaSemana: 'Sábado', potencial: 'maximo', dica: 'Início do Carnaval - lotação máxima!' },
  { data: '2026-02-15', nome: 'Carnaval (Domingo)', tipo: 'carnaval', diaSemana: 'Domingo', potencial: 'maximo', dica: 'Domingo de Carnaval' },
  { data: '2026-02-16', nome: 'Carnaval (Segunda)', tipo: 'carnaval', diaSemana: 'Segunda', potencial: 'maximo', dica: 'Segunda de Carnaval' },
  { data: '2026-02-17', nome: 'Carnaval (Terça)', tipo: 'carnaval', diaSemana: 'Terça', potencial: 'maximo', dica: 'Terça de Carnaval - pico!' },
  { data: '2026-02-18', nome: 'Quarta de Cinzas', tipo: 'carnaval', diaSemana: 'Quarta', potencial: 'alto', dica: 'Ressaca de Carnaval - feijoada?' },
  
  // Março - mês mais fraco, sem feriados nacionais
  // (Março não tem feriados nacionais relevantes)
  
  // Abril - Páscoa
  { data: '2026-04-03', nome: 'Sexta-feira Santa', tipo: 'nacional', diaSemana: 'Sexta', potencial: 'alto', dica: 'Feriadão da Páscoa - sexta é ouro!' },
  { data: '2026-04-04', nome: 'Sábado de Aleluia', tipo: 'pascoa', diaSemana: 'Sábado', potencial: 'maximo', dica: 'Pós-Sexta Santa - evento especial' },
  { data: '2026-04-05', nome: 'Domingo de Páscoa', tipo: 'pascoa', diaSemana: 'Domingo', potencial: 'alto', dica: 'Almoço especial de Páscoa' },
  { data: '2026-04-21', nome: 'Tiradentes / Aniv. BSB', tipo: 'nacional', diaSemana: 'Terça', potencial: 'alto', dica: 'Terça-feira - possível emenda + Aniversário Brasília' },
  
  // Maio
  { data: '2026-05-01', nome: 'Dia do Trabalho', tipo: 'nacional', diaSemana: 'Sexta', potencial: 'maximo', dica: 'SEXTA - feriadão perfeito!' },
  { data: '2026-05-10', nome: 'Dia das Mães', tipo: 'especial', diaSemana: 'Domingo', potencial: 'alto', dica: 'Almoço especial - reservas antecipadas' },
  
  // Junho - Copa do Mundo + Festas Juninas
  { data: '2026-06-04', nome: 'Corpus Christi', tipo: 'nacional', diaSemana: 'Quinta', potencial: 'maximo', dica: 'Quinta + emenda sexta = feriadão!' },
  { data: '2026-06-05', nome: 'Emenda Corpus Christi', tipo: 'emenda', diaSemana: 'Sexta', potencial: 'maximo', dica: 'Sexta de emenda - alta demanda' },
  { data: '2026-06-12', nome: 'Dia dos Namorados', tipo: 'especial', diaSemana: 'Sexta', potencial: 'maximo', dica: 'SEXTA - noite romântica perfeita!' },
  { data: '2026-06-13', nome: 'São João (Véspera)', tipo: 'festa_junina', diaSemana: 'Sábado', potencial: 'maximo', dica: 'Festa Junina no sábado!' },
  { data: '2026-06-14', nome: 'Copa: Brasil Jogo 1', tipo: 'copa', diaSemana: 'Domingo', potencial: 'maximo', dica: 'ESTREIA DO BRASIL NA COPA! 🇧🇷' },
  { data: '2026-06-18', nome: 'Copa: Brasil Jogo 2', tipo: 'copa', diaSemana: 'Quinta', potencial: 'maximo', dica: 'Segundo jogo do Brasil' },
  { data: '2026-06-22', nome: 'Copa: Brasil Jogo 3', tipo: 'copa', diaSemana: 'Segunda', potencial: 'maximo', dica: 'Terceiro jogo - decisivo?' },
  { data: '2026-06-24', nome: 'São João (tradicional)', tipo: 'festa_junina', diaSemana: 'Quarta', potencial: 'alto', dica: 'Arraiá especial' },
  { data: '2026-06-29', nome: 'São Pedro', tipo: 'festa_junina', diaSemana: 'Segunda', potencial: 'medio', dica: 'Final das festas juninas' },
  
  // Julho - Copa do Mundo (mata-mata)
  { data: '2026-07-01', nome: 'Copa: Oitavas', tipo: 'copa', diaSemana: 'Quarta', potencial: 'maximo', dica: 'Oitavas de final - mata-mata!' },
  { data: '2026-07-05', nome: 'Copa: Quartas', tipo: 'copa', diaSemana: 'Domingo', potencial: 'maximo', dica: 'Quartas de final' },
  { data: '2026-07-09', nome: 'Copa: Semifinal', tipo: 'copa', diaSemana: 'Quinta', potencial: 'maximo', dica: 'Semifinal - tensão máxima!' },
  { data: '2026-07-13', nome: 'Copa: FINAL', tipo: 'copa', diaSemana: 'Segunda', potencial: 'maximo', dica: '🏆 FINAL DA COPA DO MUNDO!' },
  
  // Agosto
  { data: '2026-08-09', nome: 'Dia dos Pais', tipo: 'especial', diaSemana: 'Domingo', potencial: 'alto', dica: 'Almoço especial - churrasco?' },
  
  // Setembro
  { data: '2026-09-07', nome: 'Independência', tipo: 'nacional', diaSemana: 'Segunda', potencial: 'maximo', dica: 'SEGUNDA - feriadão domingo+segunda!' },
  
  // Outubro
  { data: '2026-10-12', nome: 'N. Sra. Aparecida', tipo: 'nacional', diaSemana: 'Segunda', potencial: 'maximo', dica: 'SEGUNDA - feriadão perfeito!' },
  { data: '2026-10-21', nome: 'Copa do Brasil Final 1', tipo: 'futebol', diaSemana: 'Quarta', potencial: 'alto', dica: 'Final da Copa do Brasil - Ida' },
  { data: '2026-10-28', nome: 'Copa do Brasil Final 2', tipo: 'futebol', diaSemana: 'Quarta', potencial: 'alto', dica: 'Final da Copa do Brasil - Volta' },
  { data: '2026-10-31', nome: 'Halloween', tipo: 'tematico', diaSemana: 'Sábado', potencial: 'maximo', dica: 'SÁBADO - festa fantasia!' },
  
  // Novembro
  { data: '2026-11-02', nome: 'Finados', tipo: 'nacional', diaSemana: 'Segunda', potencial: 'alto', dica: 'Segunda - emenda de domingo' },
  { data: '2026-11-15', nome: 'Proclamação República', tipo: 'nacional', diaSemana: 'Domingo', potencial: 'medio', dica: 'Domingo - dia normal' },
  { data: '2026-11-28', nome: 'Final Libertadores', tipo: 'futebol', diaSemana: 'Sábado', potencial: 'maximo', dica: '🏆 FINAL DA LIBERTADORES!' },
  
  // Dezembro
  { data: '2026-12-24', nome: 'Véspera de Natal', tipo: 'natal', diaSemana: 'Quinta', potencial: 'medio', dica: 'Happy hour corporativo' },
  { data: '2026-12-25', nome: 'Natal', tipo: 'natal', diaSemana: 'Sexta', potencial: 'baixo', dica: 'Fechado ou horário especial' },
  { data: '2026-12-31', nome: 'Réveillon', tipo: 'reveillon', diaSemana: 'Quinta', potencial: 'maximo', dica: '🎆 RÉVEILLON - evento do ano!' },
]

// Feriadões (períodos de múltiplos dias)
const FERIADOES_2026 = [
  { nome: 'Carnaval', inicio: '2026-02-14', fim: '2026-02-18', dias: 5, potencial: 'maximo' as const, descricao: 'Sáb-Qua: 5 dias de festa!' },
  { nome: 'Páscoa', inicio: '2026-04-03', fim: '2026-04-05', dias: 3, potencial: 'alto' as const, descricao: 'Sex-Dom: Feriadão religioso' },
  { nome: 'Tiradentes + Emenda', inicio: '2026-04-18', fim: '2026-04-21', dias: 4, potencial: 'alto' as const, descricao: 'Sáb-Ter: Possível emenda segunda' },
  { nome: 'Dia do Trabalho', inicio: '2026-05-01', fim: '2026-05-03', dias: 3, potencial: 'maximo' as const, descricao: 'Sex-Dom: Feriadão perfeito!' },
  { nome: 'Corpus Christi', inicio: '2026-06-04', fim: '2026-06-07', dias: 4, potencial: 'maximo' as const, descricao: 'Qui-Dom: Com emenda sexta!' },
  { nome: 'Independência', inicio: '2026-09-05', fim: '2026-09-07', dias: 3, potencial: 'maximo' as const, descricao: 'Sáb-Seg: Feriadão nacional' },
  { nome: 'Aparecida', inicio: '2026-10-10', fim: '2026-10-12', dias: 3, potencial: 'maximo' as const, descricao: 'Sáb-Seg: Outro feriadão perfeito' },
  { nome: 'Finados', inicio: '2026-10-31', fim: '2026-11-02', dias: 3, potencial: 'alto' as const, descricao: 'Sáb-Seg: Halloween + Finados' },
  { nome: 'Natal/Ano Novo', inicio: '2026-12-24', fim: '2027-01-01', dias: 9, potencial: 'alto' as const, descricao: 'Período festivo - corporativos' },
]

// ========================================
// DADOS HISTÓRICOS 2025
// ========================================

// Top dias de faturamento 2025 (dados reais do sistema)
const TOP_DIAS_2025: DadosHistorico2025[] = [
  { data: '2025-12-12', diaSemana: 'Sexta', comandas: 1153, faturamento: 129943.78, pessoas: 1292, ticketMedio: 112.70, evento: 'Confraternizações' },
  { data: '2025-12-05', diaSemana: 'Sexta', comandas: 1096, faturamento: 128058.96, pessoas: 1204, ticketMedio: 116.84, evento: 'Confraternizações' },
  { data: '2025-12-19', diaSemana: 'Sexta', comandas: 1064, faturamento: 127081.09, pessoas: 1181, ticketMedio: 119.44, evento: 'Confraternizações' },
  { data: '2025-11-29', diaSemana: 'Sábado', comandas: 1044, faturamento: 114729.15, pessoas: 1104, ticketMedio: 109.89, evento: 'Black Friday Weekend' },
  { data: '2025-12-21', diaSemana: 'Domingo', comandas: 903, faturamento: 113028.92, pessoas: 947, ticketMedio: 125.17, evento: 'Pré-Natal' },
  { data: '2025-12-17', diaSemana: 'Quarta', comandas: 876, faturamento: 103764.31, pessoas: 956, ticketMedio: 118.45, evento: 'Confraternizações' },
  { data: '2025-12-20', diaSemana: 'Sábado', comandas: 685, faturamento: 82225.48, pessoas: 729, ticketMedio: 120.04, evento: 'Pré-Natal' },
  { data: '2025-04-04', diaSemana: 'Sexta', comandas: 804, faturamento: 78667.18, pessoas: 823, ticketMedio: 97.84, evento: 'Sexta-feira Santa' },
  { data: '2025-12-03', diaSemana: 'Quarta', comandas: 717, faturamento: 76747.08, pessoas: 759, ticketMedio: 107.04, evento: 'Confraternizações' },
  { data: '2025-02-21', diaSemana: 'Sexta', comandas: 780, faturamento: 75903.54, pessoas: 789, ticketMedio: 97.31, evento: 'Pré-Carnaval' },
  { data: '2025-12-30', diaSemana: 'Terça', comandas: 618, faturamento: 69725.80, pessoas: 709, ticketMedio: 108.31, evento: 'Entre Natal e Réveillon' },
  { data: '2025-03-21', diaSemana: 'Sexta', comandas: 741, faturamento: 69238.20, pessoas: 763, ticketMedio: 93.44, evento: 'Sexta Normal' },
  { data: '2025-12-18', diaSemana: 'Quinta', comandas: 512, faturamento: 58626.06, pessoas: 531, ticketMedio: 114.50, evento: 'Confraternizações' },
  { data: '2025-02-15', diaSemana: 'Sábado', comandas: 554, faturamento: 54128.48, pessoas: 565, ticketMedio: 97.70, evento: 'Pré-Carnaval' },
  { data: '2025-12-06', diaSemana: 'Sábado', comandas: 489, faturamento: 53811.21, pessoas: 531, ticketMedio: 110.04, evento: 'Confraternizações' },
  { data: '2025-03-22', diaSemana: 'Sábado', comandas: 573, faturamento: 52799.69, pessoas: 589, ticketMedio: 92.15, evento: 'Sábado Normal' },
  { data: '2025-12-23', diaSemana: 'Terça', comandas: 505, faturamento: 51956.12, pessoas: 512, ticketMedio: 96.01, evento: 'Véspera de Natal' },
]

// Faturamento médio por dia da semana em 2025
const FATURAMENTO_POR_DIA_2025: FaturamentoPorDia[] = [
  { diaSemana: 'Domingo', diaSemanaNum: 0, totalDias: 7, faturamentoTotal: 144382.59, mediaFaturamento: 20626.08 },
  { diaSemana: 'Segunda', diaSemanaNum: 1, totalDias: 4, faturamentoTotal: 79555.74, mediaFaturamento: 19888.94 },
  { diaSemana: 'Terça', diaSemanaNum: 2, totalDias: 8, faturamentoTotal: 144648.01, mediaFaturamento: 18081.00 },
  { diaSemana: 'Quarta', diaSemanaNum: 3, totalDias: 9, faturamentoTotal: 370514.37, mediaFaturamento: 41168.26 },
  { diaSemana: 'Quinta', diaSemanaNum: 4, totalDias: 8, faturamentoTotal: 190430.13, mediaFaturamento: 23803.77 },
  { diaSemana: 'Sexta', diaSemanaNum: 5, totalDias: 10, faturamentoTotal: 746797.19, mediaFaturamento: 74679.72 },
  { diaSemana: 'Sábado', diaSemanaNum: 6, totalDias: 11, faturamentoTotal: 510178.84, mediaFaturamento: 46379.89 },
]

// Mapeamento de datas 2025 para 2026 (datas correspondentes)
const COMPARACAO_DATAS: { [key: string]: { data2025: string; faturamento2025: number; evento2025: string } } = {
  // Carnaval 2025 (1-4 Mar) → Carnaval 2026 (14-17 Fev)
  '2026-02-14': { data2025: '2025-03-01', faturamento2025: 0, evento2025: 'Carnaval 2025' },
  // Páscoa 2025 (18-20 Abr) → Páscoa 2026 (3-5 Abr)
  '2026-04-03': { data2025: '2025-04-04', faturamento2025: 78667.18, evento2025: 'Sexta-feira Santa 2025' },
  // Lollapalooza 2025 → 2026
}

// ========================================
// EVENTOS CONCORRÊNCIA BRASÍLIA
// ========================================
// Lista vazia - eventos são gerenciados via banco de dados

// Datas específicas de eventos de concorrência em 2026 (adicionar conforme descobrir)
const DATAS_CONCORRENCIA_2026: DataImportante[] = [
  // Exemplo de como adicionar datas específicas de concorrência:
  // { data: '2026-03-15', nome: 'Festival de Samba BSB', tipo: 'concorrencia', diaSemana: 'Domingo', potencial: 'baixo', dica: '⚠️ Evento grande no Parque - pode reduzir nosso movimento' },
]

// Ideias de Ações Comerciais
const IDEIAS_ACOES = [
  { titulo: 'Pacotes Corporativos', descricao: 'Monte pacotes de confraternização Nov-Dez com preço fechado por pessoa', categoria: 'Vendas', prioridade: 'alta' as const },
  { titulo: 'Parcerias Empresas', descricao: 'Feche parcerias com empresas próximas para happy hours mensais', categoria: 'Parcerias', prioridade: 'alta' as const },
  { titulo: 'Programa Fidelidade', descricao: 'Lançar programa de pontos para aumentar recorrência', categoria: 'Fidelização', prioridade: 'media' as const },
  { titulo: 'Reservas Antecipadas', descricao: 'Sistema de reservas para datas especiais com desconto antecipado', categoria: 'Vendas', prioridade: 'alta' as const },
  { titulo: 'Lives/Transmissões', descricao: 'Transmitir jogos importantes com promoções especiais', categoria: 'Eventos', prioridade: 'alta' as const },
  { titulo: 'Menu Temático', descricao: 'Criar cardápios especiais para datas (Junino, Copa, Halloween)', categoria: 'Produto', prioridade: 'media' as const },
  { titulo: 'Influenciadores Locais', descricao: 'Parcerias com micro-influenciadores de Brasília', categoria: 'Marketing', prioridade: 'media' as const },
  { titulo: 'Eventos Privados', descricao: 'Oferecer espaço para eventos fechados (aniversários, empresas)', categoria: 'Vendas', prioridade: 'alta' as const },
]

// ========================================
// COMPONENTE DE CALENDÁRIO VISUAL
// ========================================
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function CalendarioMes({ mes, ano, datasImportantes }: { mes: number; ano: number; datasImportantes: DataImportante[] }) {
  // Primeiro dia do mês
  const primeiroDia = new Date(ano, mes, 1)
  const ultimoDia = new Date(ano, mes + 1, 0)
  const diasNoMes = ultimoDia.getDate()
  const diaSemanaInicio = primeiroDia.getDay()
  
  // Criar array de dias
  const dias: (number | null)[] = []
  
  // Dias vazios antes do primeiro dia
  for (let i = 0; i < diaSemanaInicio; i++) {
    dias.push(null)
  }
  
  // Dias do mês
  for (let i = 1; i <= diasNoMes; i++) {
    dias.push(i)
  }
  
  // Verificar se um dia tem evento
  const getEventoDia = (dia: number) => {
    const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return datasImportantes.find(d => d.data === dataStr)
  }
  
  // Cores baseadas no potencial
  const getPotencialStyle = (potencial: string) => {
    switch (potencial) {
      case 'maximo':
        return 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-500/30 ring-2 ring-green-300'
      case 'alto':
        return 'bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-md shadow-blue-500/20'
      case 'medio':
        return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md shadow-yellow-500/20'
      case 'baixo':
        return 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
      default:
        return ''
    }
  }
  
  // Ícone do tipo de evento
  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'copa': return '⚽'
      case 'carnaval': return '🎭'
      case 'pascoa': return '🐰'
      case 'festa_junina': return '🌽'
      case 'natal': return '🎄'
      case 'reveillon': return '🎆'
      case 'especial': return '💝'
      case 'futebol': return '⚽'
      case 'nacional': return '🇧🇷'
      case 'concorrencia': return '⚠️'
      case 'brasilia': return '🏛️'
      default: return '📅'
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 text-center">
        {MESES[mes]}
      </h3>
      
      {/* Header dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map(dia => (
          <div key={dia} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
            {dia}
          </div>
        ))}
      </div>
      
      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia, idx) => {
          if (dia === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />
          }
          
          const evento = getEventoDia(dia)
          const isWeekend = (diaSemanaInicio + dia - 1) % 7 === 0 || (diaSemanaInicio + dia - 1) % 7 === 6
          
          return (
            <div
              key={dia}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm font-medium
                transition-all duration-200 cursor-default relative group
                ${evento 
                  ? getPotencialStyle(evento.potencial)
                  : isWeekend
                    ? 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                }
              `}
              title={evento ? `${evento.nome} - ${evento.dica}` : ''}
            >
              {dia}
              
              {/* Tooltip com info do evento */}
              {evento && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                    <div className="flex items-center gap-1 font-semibold">
                      {getTipoIcon(evento.tipo)} {evento.nome}
                    </div>
                    <div className="text-gray-300 mt-1">{evento.dica}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Eventos do mês */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {datasImportantes
            .filter(d => {
              const dataObj = new Date(d.data + 'T12:00:00')
              return dataObj.getMonth() === mes
            })
            .slice(0, 5)
            .map((evento, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  evento.potencial === 'maximo' ? 'bg-green-500' :
                  evento.potencial === 'alto' ? 'bg-blue-500' :
                  evento.potencial === 'medio' ? 'bg-yellow-500' : 'bg-gray-400'
                }`} />
                <span className="text-gray-600 dark:text-gray-400 truncate">
                  {new Date(evento.data + 'T12:00:00').getDate()}: {evento.nome}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

export default function ComercialPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null)
  
  // Estados para eventos de concorrência do banco
  const [eventosConcorrenciaBD, setEventosConcorrenciaBD] = useState<EventoConcorrenciaBD[]>([])
  const [loadingEventos, setLoadingEventos] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null)
  
  // Estados para formulário manual
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [salvandoEvento, setSalvandoEvento] = useState(false)
  const [novoEvento, setNovoEvento] = useState({
    nome: '',
    local_nome: '',
    local_endereco: '',
    data_evento: '',
    horario_inicio: '',
    tipo: 'samba',
    impacto: 'medio',
    url_fonte: '',
    notas: ''
  })

  // Função para buscar eventos do banco
  const buscarEventosConcorrencia = useCallback(async () => {
    setLoadingEventos(true)
    try {
      const response = await fetch('/api/concorrencia?status=ativo')
      const data = await response.json()
      
      if (data.success) {
        setEventosConcorrenciaBD(data.eventos)
        setUltimaAtualizacao(new Date().toLocaleString('pt-BR'))
      }
    } catch (error) {
      console.error('Erro ao buscar eventos:', error)
    } finally {
      setLoadingEventos(false)
    }
  }, [])

  // Função para adicionar evento manualmente
  const adicionarEventoManual = async () => {
    if (!novoEvento.nome || !novoEvento.local_nome || !novoEvento.data_evento) {
      alert('Preencha pelo menos: Nome, Local e Data do evento')
      return
    }
    
    setSalvandoEvento(true)
    try {
      const response = await fetch('/api/concorrencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoEvento)
      })
      const data = await response.json()
      
      if (data.success) {
        // Limpar formulário e recarregar eventos
        setNovoEvento({
          nome: '',
          local_nome: '',
          local_endereco: '',
          data_evento: '',
          horario_inicio: '',
          tipo: 'samba',
          impacto: 'medio',
          url_fonte: '',
          notas: ''
        })
        setMostrarFormulario(false)
        await buscarEventosConcorrencia()
      } else {
        alert('Erro ao adicionar evento: ' + data.error)
      }
    } catch (error) {
      console.error('Erro ao adicionar evento:', error)
      alert('Erro ao adicionar evento')
    } finally {
      setSalvandoEvento(false)
    }
  }
  
  // Função para remover evento
  const removerEvento = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este evento?')) return
    
    try {
      const response = await fetch(`/api/concorrencia?id=${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        await buscarEventosConcorrencia()
      }
    } catch (error) {
      console.error('Erro ao remover evento:', error)
    }
  }

  // Buscar eventos ao carregar a página
  useEffect(() => {
    buscarEventosConcorrencia()
  }, [buscarEventosConcorrencia])

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const feriadosOuro = DATAS_2026.filter(f => f.potencial === 'maximo').length
    const copaJogos = DATAS_2026.filter(f => f.tipo === 'copa').length
    const festivais = DATAS_2026.filter(f => f.tipo === 'festival').length
    const feriadoes = FERIADOES_2026.length
    
    return { feriadosOuro, copaJogos, festivais, feriadoes }
  }, [])

  // Filtragem de dados
  const datasFiltradas = useMemo(() => {
    if (!searchTerm) return DATAS_2026
    return DATAS_2026.filter(f => 
      f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.dica.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm])

  // Próximos eventos
  const proximosEventos = useMemo(() => {
    const hoje = new Date('2026-01-01') // Usar data base de 2026
    return DATAS_2026
      .filter(e => new Date(e.data) >= hoje)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
      .slice(0, 8)
  }, [])

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

          {/* TAB: CALENDÁRIO VISUAL */}
          <TabsContent value="calendario" className="space-y-6">
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
          </TabsContent>

          {/* TAB: LISTA DE DATAS */}
          <TabsContent value="lista" className="space-y-6">
            {/* Busca */}
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

            {/* Lista */}
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
          </TabsContent>

          {/* TAB: FERIADÕES */}
          <TabsContent value="feriadoes" className="space-y-6">
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
                      <li className="flex items-center gap-2">☘️ <span>St. Patrick's (Mar)</span></li>
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
          </TabsContent>

          {/* TAB: PLANO DE AÇÃO */}
          <TabsContent value="acoes" className="space-y-6">
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
          </TabsContent>

          {/* TAB: CONCORRÊNCIA BSB */}
          <TabsContent value="concorrencia" className="space-y-6">
            {/* Header */}
            <Card className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-red-800 dark:text-red-300">Monitoramento de Concorrência</h3>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        🤖 O agente busca automaticamente eventos de samba/pagode em Brasília todo dia às 6h.
                        <br />
                        <span className="text-xs">Você também pode adicionar eventos manualmente.</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={buscarEventosConcorrencia}
                      disabled={loadingEventos}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      {loadingEventos ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCcw className="w-4 h-4 mr-2" />
                      )}
                      Atualizar
                    </Button>
                    <Button
                      onClick={() => setMostrarFormulario(!mostrarFormulario)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Evento
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formulário para Adicionar Evento Manual */}
            {mostrarFormulario && (
              <Card className="card-dark border-2 border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Plus className="w-5 h-5 text-red-500" />
                    Adicionar Evento de Concorrência
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Evento *</label>
                      <Input
                        placeholder="Ex: Samba do Fulano"
                        value={novoEvento.nome}
                        onChange={(e) => setNovoEvento({...novoEvento, nome: e.target.value})}
                        className="bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Local *</label>
                      <Input
                        placeholder="Ex: Bar do Zé - Asa Sul"
                        value={novoEvento.local_nome}
                        onChange={(e) => setNovoEvento({...novoEvento, local_nome: e.target.value})}
                        className="bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data *</label>
                      <Input
                        type="date"
                        value={novoEvento.data_evento}
                        onChange={(e) => setNovoEvento({...novoEvento, data_evento: e.target.value})}
                        className="bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Horário</label>
                      <Input
                        type="time"
                        value={novoEvento.horario_inicio}
                        onChange={(e) => setNovoEvento({...novoEvento, horario_inicio: e.target.value})}
                        className="bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                      <select
                        value={novoEvento.tipo}
                        onChange={(e) => setNovoEvento({...novoEvento, tipo: e.target.value})}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="samba">🥁 Samba</option>
                        <option value="pagode">🎤 Pagode</option>
                        <option value="forro">🎻 Forró</option>
                        <option value="sertanejo">🤠 Sertanejo</option>
                        <option value="outro">🎵 Outro</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Impacto Esperado</label>
                      <select
                        value={novoEvento.impacto}
                        onChange={(e) => setNovoEvento({...novoEvento, impacto: e.target.value})}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="alto">🔴 Alto - Vai afetar muito</option>
                        <option value="medio">🟡 Médio - Pode afetar</option>
                        <option value="baixo">🟢 Baixo - Pouco impacto</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Link do Evento (opcional)</label>
                      <Input
                        placeholder="https://sympla.com.br/evento..."
                        value={novoEvento.url_fonte}
                        onChange={(e) => setNovoEvento({...novoEvento, url_fonte: e.target.value})}
                        className="bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
                      <Input
                        placeholder="Ex: Grupo famoso, entrada gratuita, etc."
                        value={novoEvento.notas}
                        onChange={(e) => setNovoEvento({...novoEvento, notas: e.target.value})}
                        className="bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setMostrarFormulario(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={adicionarEventoManual}
                      disabled={salvandoEvento}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {salvandoEvento ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Salvar Evento
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Eventos Identificados pelo Agente */}
            <Card className="card-dark">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Próximos Eventos de Concorrência
                    {loadingEventos && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    {eventosConcorrenciaBD.length} eventos ativos
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eventosConcorrenciaBD.length === 0 ? (
                  <div className="text-center py-8">
                    <Music className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Nenhum evento de concorrência identificado ainda.
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                      Clique em "Executar Agente" para buscar eventos em Sympla, Ingresse e outros sites.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eventosConcorrenciaBD.map((evento) => {
                      const dataEvento = new Date(evento.data_evento + 'T12:00:00')
                      const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dataEvento.getDay()]
                      
                      return (
                        <motion.div
                          key={evento.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`p-4 rounded-lg border flex items-start gap-4 ${
                            evento.impacto === 'alto'
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : evento.impacto === 'medio'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {/* Data */}
                          <div className="text-center min-w-[60px]">
                            <p className={`text-lg font-bold ${
                              evento.impacto === 'alto' ? 'text-red-600 dark:text-red-400' :
                              evento.impacto === 'medio' ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-gray-600 dark:text-gray-400'
                            }`}>
                              {dataEvento.getDate()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][dataEvento.getMonth()]}
                            </p>
                            <p className="text-xs text-gray-400">{diaSemana}</p>
                          </div>

                          {/* Info */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                  <span>
                                    {evento.tipo === 'samba' ? '🥁' :
                                     evento.tipo === 'pagode' ? '🎤' :
                                     evento.tipo === 'forro' ? '🎻' : '🎵'}
                                  </span>
                                  {evento.nome}
                                  {evento.verificado && (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  )}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  📍 {evento.local_nome}
                                  {evento.local_endereco && ` • ${evento.local_endereco}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  evento.impacto === 'alto'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                    : evento.impacto === 'medio'
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {evento.impacto}
                                </span>
                                {evento.url_fonte && (
                                  <a
                                    href={evento.url_fonte}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-blue-500"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                                <button
                                  onClick={() => removerEvento(evento.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remover evento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{evento.tipo}</span>
                              <span>via {evento.fonte}</span>
                              {evento.preco_minimo && (
                                <span>R$ {evento.preco_minimo.toFixed(0)}{evento.preco_maximo && ` - ${evento.preco_maximo.toFixed(0)}`}</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>


            {/* Datas Específicas de Concorrência 2026 */}
            {DATAS_CONCORRENCIA_2026.length > 0 && (
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <CalendarDays className="w-5 h-5 text-red-500" />
                    Datas de Concorrência em 2026
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {DATAS_CONCORRENCIA_2026.map((data, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-center min-w-[60px]">
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">
                            {new Date(data.data + 'T12:00:00').getDate()}
                          </p>
                          <p className="text-xs text-red-500">
                            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][new Date(data.data + 'T12:00:00').getMonth()]}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">{data.nome}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{data.dica}</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full">
                          {data.diaSemana}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </TabsContent>

          {/* TAB: HISTÓRICO 2025 */}
          <TabsContent value="historico" className="space-y-6">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
