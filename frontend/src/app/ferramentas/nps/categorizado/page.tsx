'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar,
  TrendingUp,
  RefreshCw,
  BarChart3,
  MessageSquare,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface NPSMetrica {
  media: number;
  classificacao: 'verde' | 'amarelo' | 'vermelho';
  total: number;
  comentarios: string[];
}

interface NPSDado {
  data?: string;
  semana?: string;
  ano?: number;
  total_respostas: number;
  nps_geral: NPSMetrica;
  nps_ambiente: NPSMetrica;
  nps_atendimento: NPSMetrica;
  nps_limpeza: NPSMetrica;
  nps_musica: NPSMetrica;
  nps_comida: NPSMetrica;
  nps_drink: NPSMetrica;
  nps_preco: NPSMetrica;
  nps_reservas: NPSMetrica;
}

export default function NPSCategorizadoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [tipo, setTipo] = useState<'dia' | 'semana'>('semana');
  const [dados, setDados] = useState<NPSDado[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => {
    const data = new Date();
    data.setMonth(data.getMonth() - 2); // Últimos 2 meses
    return data.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  
  // Modal de comentários
  const [modalComentarios, setModalComentarios] = useState(false);
  const [comentariosSelecionados, setComentariosSelecionados] = useState<{
    categoria: string;
    periodo: string;
    comentarios: string[];
  } | null>(null);

  useEffect(() => {
    setPageTitle('⭐ NPS Categorizado');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    buscarDados();
  }, [tipo, selectedBar]);

  const buscarDados = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar?.id?.toString() || '',
        tipo,
        data_inicio: dataInicio,
        data_fim: dataFim
      });

      const response = await fetch(`/api/nps/agregado?${params}`);
      const result = await response.json();

      if (result.success) {
        setDados(result.data);
      } else {
        toast.error('Erro ao buscar dados');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const getCorClassificacao = (classificacao: string) => {
    switch (classificacao) {
      case 'verde':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'amarelo':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'vermelho':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatData = (data: string) => {
    const d = new Date(data + 'T12:00:00Z');
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const abrirComentarios = (categoria: string, periodo: string, comentarios: string[]) => {
    setComentariosSelecionados({
      categoria,
      periodo,
      comentarios
    });
    setModalComentarios(true);
  };

  const categorias = [
    { key: 'nps_geral', label: 'NPS Geral', icon: '⭐' },
    { key: 'nps_ambiente', label: 'Ambiente', icon: '🏢' },
    { key: 'nps_atendimento', label: 'Atendimento', icon: '👥' },
    { key: 'nps_limpeza', label: 'Limpeza', icon: '🧹' },
    { key: 'nps_musica', label: 'Música', icon: '🎵' },
    { key: 'nps_comida', label: 'Comida', icon: '🍽️' },
    { key: 'nps_drink', label: 'Drink', icon: '🍹' },
    { key: 'nps_preco', label: 'Preço', icon: '💰' },
    { key: 'nps_reservas', label: 'Reservas', icon: '📅' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Filtros */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Período</Label>
                <Tabs value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <TabsList className="grid grid-cols-2 bg-gray-100 dark:bg-gray-700">
                    <TabsTrigger value="dia">Por Dia</TabsTrigger>
                    <TabsTrigger value="semana">Por Semana</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300">Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300">Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={buscarDados}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Dados */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Indicadores de Qualidade - NPS por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-gray-600 dark:text-gray-400">Carregando dados...</p>
              </div>
            ) : dados.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">Nenhum dado encontrado para o período selecionado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 sticky left-0">
                        {tipo === 'dia' ? 'Data' : 'Semana'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700">
                        Respostas
                      </th>
                      {categorias.map(cat => (
                        <th key={cat.key} className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 min-w-[120px]">
                          <div className="flex flex-col items-center">
                            <span className="text-lg mb-1">{cat.icon}</span>
                            <span>{cat.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800">
                          {tipo === 'dia' && item.data ? formatData(item.data) : item.semana}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white font-semibold">
                          {item.total_respostas}
                        </td>
                        {categorias.map(cat => {
                          const metrica = item[cat.key as keyof NPSDado] as NPSMetrica;
                          const periodo = tipo === 'dia' && item.data ? formatData(item.data) : item.semana || '';
                          return (
                            <td key={cat.key} className="px-4 py-3 text-center">
                              {metrica.total > 0 ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge className={`${getCorClassificacao(metrica.classificacao)} font-bold text-base px-3 py-1 cursor-default`}>
                                    {metrica.media.toFixed(1)}
                                  </Badge>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ({metrica.total})
                                  </span>
                                  {metrica.comentarios && metrica.comentarios.length > 0 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => abrirComentarios(cat.label, periodo, metrica.comentarios)}
                                      className="h-6 px-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                    >
                                      <MessageSquare className="w-3 h-3 mr-1" />
                                      {metrica.comentarios.length}
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-600">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legenda */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">4-5</Badge>
                  <span className="text-gray-600 dark:text-gray-400">Excelente</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">2-3</Badge>
                  <span className="text-gray-600 dark:text-gray-400">Regular</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">1</Badge>
                  <span className="text-gray-600 dark:text-gray-400">Ruim</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Comentários */}
        <Dialog open={modalComentarios} onOpenChange={setModalComentarios}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Comentários - {comentariosSelecionados?.categoria}
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                {comentariosSelecionados?.periodo} • {comentariosSelecionados?.comentarios.length || 0} comentário(s)
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 mt-4">
              {comentariosSelecionados?.comentarios.map((comentario, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-900 dark:text-white flex-1">
                      {comentario}
                    </p>
                  </div>
                </div>
              ))}
              
              {(!comentariosSelecionados?.comentarios || comentariosSelecionados.comentarios.length === 0) && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  Nenhum comentário registrado
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

