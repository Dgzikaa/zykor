'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DebugTempo {
  data: string
  nome: string
  telefone: string
  valor_periodo: number
  valor_pagamento?: number
  tempo_calculado?: number
  tempo_formatado?: string
  tipo_match?: string
  hr_lancamento?: string
  hr_transacao?: string
}

export default function DebugTemposEstadia() {
  const [loading, setLoading] = useState(false)
  const [dados, setDados] = useState<DebugTempo[]>([])
  const [clienteFiltro, setClienteFiltro] = useState('Laura Galvão')

  const buscarDados = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/tempos-estadia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cliente: clienteFiltro
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setDados(data.dados || [])
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔍 Debug - Tempos de Estadia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-2">Cliente:</label>
                <input
                  type="text"
                  value={clienteFiltro}
                  onChange={(e) => setClienteFiltro(e.target.value)}
                  className="border rounded px-3 py-2 w-64"
                  placeholder="Nome do cliente..."
                />
              </div>
              <Button onClick={buscarDados} disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar Dados'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {dados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Resultados para &quot;{clienteFiltro}&quot; ({dados.length} registros)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dados.map((item, index) => (
                  <div key={index} className="border rounded p-4 bg-gray-50 dark:bg-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <strong>Data:</strong> {item.data}<br/>
                        <strong>Nome:</strong> {item.nome}<br/>
                        <strong>Telefone:</strong> {item.telefone}
                      </div>
                      <div>
                        <strong>Valor Período:</strong> R$ {item.valor_periodo?.toFixed(2)}<br/>
                        <strong>Valor Pagamento:</strong> {item.valor_pagamento ? `R$ ${item.valor_pagamento.toFixed(2)}` : 'N/A'}<br/>
                        <strong>Tipo Match:</strong> 
                        <Badge variant={item.tipo_match === 'NOME_VALOR' ? 'default' : 'secondary'} className="ml-2">
                          {item.tipo_match || 'N/A'}
                        </Badge>
                      </div>
                      <div>
                        <strong>Hr Lançamento:</strong> {item.hr_lancamento || 'N/A'}<br/>
                        <strong>Hr Transação:</strong> {item.hr_transacao || 'N/A'}<br/>
                        <strong>Tempo:</strong> 
                        <Badge variant="outline" className="ml-2">
                          {item.tempo_formatado || 'N/A'}
                        </Badge>
                      </div>
                    </div>
                    
                    <details className="mt-4">
                      <summary className="cursor-pointer font-medium">Ver JSON completo</summary>
                      <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
