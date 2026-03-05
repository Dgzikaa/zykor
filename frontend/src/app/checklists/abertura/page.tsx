'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Clock, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useBar } from '@/contexts/BarContext';

interface Checklist {
  id: number;
  nome: string;
  descricao: string;
  tipo: 'abertura' | 'fechamento' | 'operacao';
  prioridade: 'alta' | 'media' | 'baixa';
  concluido: boolean;
  tempo_estimado?: number;
}

export default function ChecklistAberturaPage() {
  const router = useRouter();
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<Checklist[]>([]);

  useEffect(() => {
    carregarChecklists();
  }, [selectedBar]);

  const carregarChecklists = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/checklists?tipo=abertura&bar_id=${selectedBar?.id}`);
      if (response.ok) {
        const data = await response.json();
        setChecklists(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const progresso = checklists.length > 0 
    ? Math.round((checklists.filter(c => c.concluido).length / checklists.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando checklists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Checklist de Abertura
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedBar?.nome || 'Carregando...'}
              </p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progresso do dia
              </span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                {progresso}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500 rounded-full"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{checklists.filter(c => c.concluido).length} de {checklists.length} concluídos</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {checklists.reduce((acc, c) => acc + (c.tempo_estimado || 0), 0)} min
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Checklists */}
        {checklists.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum checklist configurado
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Configure os checklists de abertura nas configurações
            </p>
            <button
              onClick={() => router.push('/extras/checklists')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Ir para Configurações
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {checklists.map((checklist) => (
              <button
                key={checklist.id}
                onClick={() => router.push(`/checklists/${checklist.id}`)}
                className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                    checklist.concluido
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 dark:border-gray-600 group-hover:border-green-500'
                  }`}>
                    {checklist.concluido && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold mb-1 ${
                      checklist.concluido
                        ? 'text-gray-500 dark:text-gray-500 line-through'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {checklist.nome}
                    </h3>
                    {checklist.descricao && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {checklist.descricao}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {checklist.tempo_estimado && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {checklist.tempo_estimado} min
                        </span>
                      )}
                      {checklist.prioridade && (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          checklist.prioridade === 'alta'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : checklist.prioridade === 'media'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                        }`}>
                          {checklist.prioridade}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Seta */}
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

