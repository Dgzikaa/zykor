'use client'

import { Timer } from 'lucide-react'

interface LoadingStateProps {
  title?: string
  subtitle?: string
  icon?: React.ReactNode
}

export function LoadingState({ 
  title = "Carregando análise...", 
  subtitle = "Processando dados",
  icon 
}: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          {/* Círculo de fundo */}
          <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
          {/* Círculo animado */}
          <div 
            className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full"
            style={{
              animation: 'spin 1s linear infinite'
            }}
          ></div>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          {icon || <Timer className="w-4 h-4" />}
          <span>Aguarde...</span>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
