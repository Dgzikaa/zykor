'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Calendar } from 'lucide-react';

interface Evento {
  evento_sympla_id: string;
  nome_evento: string;
  data_inicio: string;
  total_participantes: number;
}

export default function SymplaCheckinsPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const carregarEventos = useCallback(async () => {
    try {
      // Eventos fixos do Carnaval 2026
      const eventosCarnaval: Evento[] = [
        {
          evento_sympla_id: 's322f32',
          nome_evento: '13.02(Sex)| Abre Alas com Samba da Tia Zélia & Convidados | Carna Vira-Lata | Ordinário Bar & Música',
          data_inicio: '2026-02-13T18:00:00-03:00',
          total_participantes: 0
        },
        {
          evento_sympla_id: 's322f39',
          nome_evento: '14.02(Sáb)|Barato Total - A festa da música brasileira| Carna Vira-Lata | Ordinário Bar',
          data_inicio: '2026-02-14T18:00:00-03:00',
          total_participantes: 0
        },
        {
          evento_sympla_id: 's322f46',
          nome_evento: '15.02(Dom)|Doze por Oito & Convidados | Bloco pressão alta | Carna Vira-Lata | Ordinário Bar',
          data_inicio: '2026-02-15T18:00:00-03:00',
          total_participantes: 0
        },
        {
          evento_sympla_id: 's322f4f',
          nome_evento: '16.02(Seg)|Macetada Pagodão & Nãnan Matos - Noite do pagodão baiano| Carna Vira-Lata | Ordinário Bar',
          data_inicio: '2026-02-16T18:00:00-03:00',
          total_participantes: 0
        },
        {
          evento_sympla_id: 's322f58',
          nome_evento: '17.02(Ter)|Bloco do MSN - DJ Umiranda, Israel Paixão + Convidados | Ordinário Bar',
          data_inicio: '2026-02-17T18:00:00-03:00',
          total_participantes: 0
        }
      ];
      
      setEventos(eventosCarnaval);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
    } finally {
      setLoadingEventos(false);
    }
  }, []);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Por favor, selecione um arquivo CSV');
        return;
      }
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !eventoSelecionado) {
      setError('Selecione um evento e um arquivo CSV');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('evento_sympla_id', eventoSelecionado);
      formData.append('bar_id', '3'); // Ordinário

      const response = await fetch('/api/integracoes/sympla/import-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar CSV');
      }

      setResult(data);
      setFile(null);
      setEventoSelecionado('');
      
      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Recarregar eventos para atualizar contadores
      await carregarEventos();

    } catch (err: any) {
      setError(err.message || 'Erro ao importar CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar Checkins - Sympla
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Importe CSVs do Sympla para atualizar dados de check-in dos participantes
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            {/* Instruções */}
            <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-300">
                <strong>Como usar:</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>Selecione o evento abaixo</li>
                  <li>Exporte o CSV do Sympla (Relatórios → Participantes)</li>
                  <li>Faça upload do arquivo</li>
                  <li>Os checkins serão atualizados automaticamente</li>
                </ol>
              </AlertDescription>
            </Alert>

            {/* Lista de Eventos */}
            {loadingEventos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando eventos...</span>
              </div>
            ) : (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Eventos Recentes
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {eventos.map((evento) => (
                    <div
                      key={evento.evento_sympla_id}
                      onClick={() => setEventoSelecionado(evento.evento_sympla_id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        eventoSelecionado === evento.evento_sympla_id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {evento.nome_evento}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(evento.data_inicio).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Participantes</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {evento.total_participantes}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulário de Upload */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="csv-file" className="text-gray-900 dark:text-white">
                  Arquivo CSV *
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    required
                  />
                  {file && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !file || !eventoSelecionado}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar CSV
                  </>
                )}
              </Button>
            </form>

            {/* Erro */}
            {error && (
              <Alert className="mt-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-300">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Resultado */}
            {result && (
              <Alert className="mt-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-300">
                  <strong>Importação concluída!</strong>
                  <div className="mt-2 space-y-1">
                    <p>✅ Total de linhas: {result.stats?.total_linhas}</p>
                    <p>✅ Participantes inseridos: {result.stats?.total_inseridos}</p>
                    <p>✅ Com checkin: {result.stats?.com_checkin}</p>
                    <p>✅ Sem checkin: {result.stats?.sem_checkin}</p>
                    {result.stats?.erros > 0 && (
                      <p className="text-red-700 dark:text-red-400">
                        ❌ Erros: {result.stats.erros}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
