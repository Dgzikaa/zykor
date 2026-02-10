'use client';

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Star, 
  TrendingUp, 
  MessageSquare, 
  RefreshCcw, 
  Users, 
  ThumbsUp, 
  ThumbsDown,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Clock,
  Filter,
  Utensils,
  Coffee,
  Music
} from 'lucide-react';

interface GoogleReview {
  id: number;
  review_id: string;
  reviewer_name: string;
  reviewer_photo_url: string;
  reviewer_number_of_reviews: number;
  is_local_guide: boolean;
  stars: number;
  text: string;
  text_translated: string;
  publish_at: string;
  published_at_date: string;
  likes_count: number;
  rating_food: number | null;
  rating_service: number | null;
  rating_atmosphere: number | null;
  review_context: Record<string, unknown> | null;
  response_from_owner_text: string | null;
  response_from_owner_date: string | null;
  review_url: string | null;
  city: string | null;
  place_title: string;
  place_total_score: number;
  place_reviews_count: number;
}

interface Stats {
  total: number;
  mediaEstrelas: number;
  distribuicao: Record<number, number>;
  categorias: {
    comida: number | null;
    servico: number | null;
    ambiente: number | null;
  };
  textos: {
    comTexto: number;
    semTexto: number;
    percentualComTexto: number;
  };
  respostas: {
    respondidas: number;
    naoRespondidas: number;
    percentualRespondidas: number;
  };
  evolucaoMensal: Array<{
    mes: string;
    mesFormatado: string;
    total: number;
    media: number;
  }>;
}

export default function GoogleReviewsPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroEstrelas, setFiltroEstrelas] = useState('todas');
  
  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  useEffect(() => {
    setPageTitle('Google Reviews - Avaliações');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (selectedBar?.id) {
      carregarDados();
    }
  }, [selectedBar?.id]);

  useEffect(() => {
    if (selectedBar?.id) {
      carregarReviews();
    }
  }, [selectedBar?.id, dataInicio, dataFim, filtroEstrelas, paginaAtual]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      await Promise.all([carregarStats(), carregarReviews()]);
    } finally {
      setLoading(false);
    }
  };

  const carregarStats = async () => {
    try {
      const response = await fetch(`/api/google-reviews/stats?bar_id=${selectedBar?.id}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  };

  const carregarReviews = async () => {
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar?.id?.toString() || '3',
        limite: itensPorPagina.toString(),
        offset: ((paginaAtual - 1) * itensPorPagina).toString(),
      });

      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);
      if (filtroEstrelas !== 'todas') params.append('estrelas', filtroEstrelas);

      const response = await fetch(`/api/google-reviews?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setReviews(data.data);
        setTotalReviews(data.total);
      }
    } catch (error) {
      console.error('Erro ao carregar reviews:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as avaliações',
        variant: 'destructive',
      });
    }
  };

  const renderEstrelas = (nota: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i <= nota ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
          />
        ))}
      </div>
    );
  };

  const getCorNota = (nota: number) => {
    if (nota >= 4) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (nota >= 3) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  const formatarData = (data: string) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPaginas = Math.ceil(totalReviews / itensPorPagina);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header com Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total de Avaliações</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.total?.toLocaleString() || '-'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Média de Estrelas</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats?.mediaEstrelas?.toFixed(2) || '-'}
                    </p>
                    <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Com Comentário</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.textos?.percentualComTexto || 0}%
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {stats?.textos?.comTexto?.toLocaleString() || 0} de {stats?.total?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Respondidas</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.respostas?.percentualRespondidas || 0}%
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {stats?.respostas?.respondidas?.toLocaleString() || 0} respostas
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <ThumbsUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reviews" className="space-y-4">
          <TabsList className="bg-gray-200 dark:bg-gray-700">
            <TabsTrigger value="reviews" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
              <MessageSquare className="w-4 h-4 mr-2" />
              Avaliações
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              Análise
            </TabsTrigger>
          </TabsList>

          {/* Tab de Avaliações */}
          <TabsContent value="reviews" className="space-y-4">
            {/* Filtros */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white text-base">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Data Início</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => { setDataInicio(e.target.value); setPaginaAtual(1); }}
                      className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Data Fim</Label>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={(e) => { setDataFim(e.target.value); setPaginaAtual(1); }}
                      className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Estrelas</Label>
                    <Select value={filtroEstrelas} onValueChange={(v) => { setFiltroEstrelas(v); setPaginaAtual(1); }}>
                      <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        <SelectItem value="5">5 estrelas</SelectItem>
                        <SelectItem value="4">4 estrelas</SelectItem>
                        <SelectItem value="3">3 estrelas</SelectItem>
                        <SelectItem value="2">2 estrelas</SelectItem>
                        <SelectItem value="1">1 estrela</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={carregarDados}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Reviews */}
            <div className="space-y-4">
              {loading ? (
                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="p-8 text-center">
                    <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">Carregando avaliações...</p>
                  </CardContent>
                </Card>
              ) : reviews.length === 0 ? (
                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">Nenhuma avaliação encontrada</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {reviews.map((review) => (
                    <Card key={review.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {review.reviewer_photo_url ? (
                              <img
                                src={review.reviewer_photo_url}
                                alt={review.reviewer_name}
                                className="h-12 w-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <Users className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            {/* Header do review */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {review.reviewer_name}
                                  </span>
                                  {review.is_local_guide && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                      Local Guide
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  <span>{review.reviewer_number_of_reviews} avaliações</span>
                                  {review.city && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {review.city}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getCorNota(review.stars)}>
                                  {review.stars} <Star className="h-3 w-3 ml-0.5 fill-current" />
                                </Badge>
                                {review.review_url && (
                                  <a
                                    href={review.review_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-blue-600"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Estrelas e Data */}
                            <div className="flex items-center gap-3 mb-2">
                              {renderEstrelas(review.stars)}
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {review.publish_at || formatarData(review.published_at_date)}
                              </span>
                            </div>

                            {/* Ratings detalhados */}
                            {(review.rating_food || review.rating_service || review.rating_atmosphere) && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {review.rating_food && (
                                  <Badge variant="outline" className="text-xs">
                                    <Utensils className="h-3 w-3 mr-1" />
                                    Comida: {review.rating_food}
                                  </Badge>
                                )}
                                {review.rating_service && (
                                  <Badge variant="outline" className="text-xs">
                                    <Coffee className="h-3 w-3 mr-1" />
                                    Serviço: {review.rating_service}
                                  </Badge>
                                )}
                                {review.rating_atmosphere && (
                                  <Badge variant="outline" className="text-xs">
                                    <Music className="h-3 w-3 mr-1" />
                                    Ambiente: {review.rating_atmosphere}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Texto do review */}
                            {review.text && (
                              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                                {review.text}
                              </p>
                            )}

                            {/* Texto traduzido (se diferente) */}
                            {review.text_translated && review.text_translated !== review.text && (
                              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 mb-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tradução:</p>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                  {review.text_translated}
                                </p>
                              </div>
                            )}

                            {/* Likes */}
                            {review.likes_count > 0 && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                <ThumbsUp className="h-3 w-3" />
                                {review.likes_count} pessoas acharam útil
                              </div>
                            )}

                            {/* Resposta do proprietário */}
                            {review.response_from_owner_text && (
                              <div className="mt-3 pl-4 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                    Resposta do proprietário
                                  </Badge>
                                  {review.response_from_owner_date && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatarData(review.response_from_owner_date)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {review.response_from_owner_text}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Paginação */}
                  {totalPaginas > 1 && (
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Mostrando {((paginaAtual - 1) * itensPorPagina) + 1} a {Math.min(paginaAtual * itensPorPagina, totalReviews)} de {totalReviews.toLocaleString()} avaliações
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                              disabled={paginaAtual === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Anterior
                            </Button>
                            <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                              {paginaAtual} / {totalPaginas}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                              disabled={paginaAtual === totalPaginas}
                            >
                              Próxima
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Tab de Análise */}
          <TabsContent value="analytics" className="space-y-4">
            {/* Distribuição por Estrelas */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Star className="h-5 w-5 text-yellow-400" />
                  Distribuição por Estrelas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((estrela) => {
                    const count = stats?.distribuicao?.[estrela] || 0;
                    const percentual = stats?.total ? Math.round((count / stats.total) * 100) : 0;
                    
                    return (
                      <div key={estrela} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-16">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{estrela}</span>
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        </div>
                        <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              estrela >= 4 ? 'bg-green-500' : estrela === 3 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {count.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({percentual}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Médias por Categoria */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Utensils className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Comida</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats?.categorias?.comida?.toFixed(1) || '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Coffee className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Serviço</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats?.categorias?.servico?.toFixed(1) || '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Music className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Ambiente</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats?.categorias?.ambiente?.toFixed(1) || '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Evolução Mensal */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Calendar className="h-5 w-5" />
                  Evolução Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-2 text-gray-700 dark:text-gray-300">Mês</th>
                        <th className="text-center p-2 text-gray-700 dark:text-gray-300">Avaliações</th>
                        <th className="text-center p-2 text-gray-700 dark:text-gray-300">Média</th>
                        <th className="text-left p-2 text-gray-700 dark:text-gray-300">Tendência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.evolucaoMensal?.map((mes, index) => (
                        <tr key={mes.mes} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="p-2 text-gray-900 dark:text-white font-medium">
                            {mes.mesFormatado}
                          </td>
                          <td className="p-2 text-center text-gray-900 dark:text-white">
                            {mes.total}
                          </td>
                          <td className="p-2 text-center">
                            {mes.media > 0 ? (
                              <Badge className={getCorNota(mes.media)}>
                                {mes.media.toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ 
                                  width: `${stats?.evolucaoMensal ? (mes.total / Math.max(...stats.evolucaoMensal.map(m => m.total))) * 100 : 0}%` 
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
