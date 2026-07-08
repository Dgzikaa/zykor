'use client';

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Lightbulb,
  Calendar,
  Clock,
  Users,
  Ticket,
  TrendingUp,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface Recomendacao {
  tipo: string;
  titulo: string;
  descricao: string;
  confianca: number;
  razao: string;
  acao_sugerida: string;
}

interface ClienteRecomendacoes {
  telefone: string;
  nome: string;
  total_visitas: number;
  segmento: string;
  recomendacoes: Recomendacao[];
}

export default function RecomendacoesPage() {
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('💡 Recomendações');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const [telefone, setTelefone] = useState('');
  const [cliente, setCliente] = useState<ClienteRecomendacoes | null>(null);
  const [loading, setLoading] = useState(false);

  const buscarRecomendacoes = async () => {
    if (!telefone) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/crm/recomendacoes?telefone=${telefone}`);
      const result = await response.json();

      if (result.success) {
        setCliente(result.data);
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao buscar recomendações');
    } finally {
      setLoading(false);
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'dia': return <Calendar className="w-5 h-5" />;
      case 'horario': return <Clock className="w-5 h-5" />;
      case 'evento': return <Sparkles className="w-5 h-5" />;
      case 'grupo': return <Users className="w-5 h-5" />;
      case 'cupom': return <Ticket className="w-5 h-5" />;
      case 'produto': return <TrendingUp className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getConfiancaBadge = (confianca: number) => {
    if (confianca >= 90) return <Badge className="bg-green-600">🎯 {confianca}% Confiança</Badge>;
    if (confianca >= 75) return <Badge className="bg-blue-600">✓ {confianca}% Confiança</Badge>;
    if (confianca >= 60) return <Badge className="bg-yellow-600">~ {confianca}% Confiança</Badge>;
    return <Badge className="bg-gray-600">{confianca}% Confiança</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-400">
            IA que recomenda eventos, produtos e ações personalizadas para cada cliente
          </p>
        </div>

        {/* Busca */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && buscarRecomendacoes()}
                  placeholder="Digite o telefone do cliente (apenas números)..."
                  className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
              <Button
                onClick={buscarRecomendacoes}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Buscando...' : 'Buscar Recomendações'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultado */}
        {cliente && (
          <>
            {/* Header do Cliente */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800 mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      {cliente.nome}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{cliente.telefone}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {cliente.total_visitas}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Visitas</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Badge className="bg-purple-600 text-white">
                    Segmento: {cliente.segmento}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Recomendações */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Lightbulb className="w-6 h-6 text-yellow-500" />
                  Recomendações de IA ({cliente.recomendacoes.length})
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Ordenadas por nível de confiança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cliente.recomendacoes.map((rec, index) => (
                    <Card
                      key={index}
                      className={`border-2 ${
                        rec.titulo.includes('URGENTE') || rec.titulo.includes('🚨')
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                          : rec.confianca >= 90
                          ? 'border-green-200 dark:border-green-800'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Ícone */}
                          <div className={`p-3 rounded-lg ${
                            rec.titulo.includes('URGENTE')
                              ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                              : rec.confianca >= 90
                              ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                              : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          }`}>
                            {getTipoIcon(rec.tipo)}
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {rec.titulo}
                              </h3>
                              {getConfiancaBadge(rec.confianca)}
                            </div>

                            <p className="text-gray-700 dark:text-gray-300 mb-3">
                              {rec.descricao}
                            </p>

                            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mb-3">
                              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                RAZÃO:
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {rec.razao}
                              </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                AÇÃO SUGERIDA:
                              </div>
                              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                {rec.acao_sugerida}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Estado vazio */}
        {!cliente && !loading && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-12 text-center">
              <Lightbulb className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Digite o telefone de um cliente para ver recomendações personalizadas
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

