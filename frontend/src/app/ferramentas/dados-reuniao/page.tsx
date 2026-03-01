'use client';

import { useState, useEffect } from 'react';
import { useBar } from '@/hooks/useBar';
import { 
  Copy, 
  Check, 
  Download, 
  RefreshCw,
  Calendar,
  Users,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DadosSemana {
  semana: number;
  periodo: string;
  dataInicio: string;
  dataFim: string;
  percNovos: string;
  clientesAtivos: string;
  clientesAtendidos: string;
  faturamento: string;
  ticketMedio: string;
  cmv: string;
  cmo: string;
  nps: string;
  felicidade: string;
}

export default function DadosReuniaoPage() {
  const { bar } = useBar();
  const [dados, setDados] = useState<DadosSemana[]>([]);
  const [textoParaCopiar, setTextoParaCopiar] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [numSemanas, setNumSemanas] = useState(12);

  const fetchDados = async () => {
    if (!bar?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/relatorios/dados-reuniao?bar_id=${bar.id}&semanas=${numSemanas}`);
      const result = await response.json();
      
      if (result.success) {
        setDados(result.data);
        setTextoParaCopiar(result.textoParaCopiar);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bar?.id) {
      fetchDados();
    }
  }, [bar?.id, numSemanas]);

  const copiarParaClipboard = async () => {
    try {
      await navigator.clipboard.writeText(textoParaCopiar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  const exportarCSV = () => {
    const blob = new Blob([textoParaCopiar], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dados_reuniao_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                Dados para Reunião
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Dados semanais prontos para copiar e colar na planilha
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={numSemanas}
                onChange={(e) => setNumSemanas(Number(e.target.value))}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value={4}>Últimas 4 semanas</option>
                <option value={8}>Últimas 8 semanas</option>
                <option value={12}>Últimas 12 semanas</option>
                <option value={24}>Últimas 24 semanas</option>
                <option value={52}>Últimas 52 semanas</option>
              </select>

              <Button
                onClick={fetchDados}
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={copiarParaClipboard}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {copiado ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Tudo para Planilha
                </>
              )}
            </Button>

            <Button
              onClick={exportarCSV}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            💡 Clique em &quot;Copiar Tudo&quot; e cole diretamente no Excel/Google Sheets (Ctrl+V)
          </p>
        </div>

        {/* Cards de Resumo */}
        {dados.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                <Users className="w-4 h-4" />
                Última % Novos
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {dados[dados.length - 1]?.percNovos || '-'}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Clientes Ativos
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {dados[dados.length - 1]?.clientesAtivos || '-'}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                Ticket Médio
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {dados[dados.length - 1]?.ticketMedio || '-'}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Semanas
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {dados.length}
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Dados */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Sem</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Período</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">% Novos</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Ativos</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Atendidos</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Faturamento</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">TM</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">CMV</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">CMO</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">NPS</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">😊</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Carregando dados...
                    </td>
                  </tr>
                ) : dados.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nenhum dado encontrado
                    </td>
                  </tr>
                ) : (
                  dados.map((semana, index) => (
                    <tr 
                      key={semana.semana}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        index === dados.length - 1 ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {semana.semana}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {semana.periodo}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white font-medium">
                        {semana.percNovos}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white font-medium">
                        {semana.clientesAtivos}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {semana.clientesAtendidos}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                        {semana.faturamento}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                        {semana.ticketMedio}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {semana.cmv}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {semana.cmo}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {semana.nps}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {semana.felicidade}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            📋 Como usar:
          </h3>
          <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>1. Clique em <strong>&quot;Copiar Tudo para Planilha&quot;</strong></li>
            <li>2. Abra sua planilha do Excel ou Google Sheets</li>
            <li>3. Selecione a célula onde quer colar e pressione <strong>Ctrl+V</strong></li>
            <li>4. Os dados serão colados em colunas separadas automaticamente!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

