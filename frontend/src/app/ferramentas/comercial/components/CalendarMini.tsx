'use client'

import { DataImportante, MESES, DIAS_SEMANA } from '../data/constants'

interface CalendarioMesProps {
  mes: number
  ano: number
  datasImportantes: DataImportante[]
}

export function CalendarioMes({ mes, ano, datasImportantes }: CalendarioMesProps) {
  const primeiroDia = new Date(ano, mes, 1)
  const ultimoDia = new Date(ano, mes + 1, 0)
  const diasNoMes = ultimoDia.getDate()
  const diaSemanaInicio = primeiroDia.getDay()
  
  const dias: (number | null)[] = []
  
  for (let i = 0; i < diaSemanaInicio; i++) {
    dias.push(null)
  }
  
  for (let i = 1; i <= diasNoMes; i++) {
    dias.push(i)
  }
  
  const getEventoDia = (dia: number) => {
    const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return datasImportantes.find(d => d.data === dataStr)
  }
  
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
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map(dia => (
          <div key={dia} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
            {dia}
          </div>
        ))}
      </div>
      
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
