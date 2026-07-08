'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePageTitle } from '@/contexts/PageTitleContext';
import {
  agora,
  formatarData,
  formatarDataHora,
  formatarHora,
  formatarTempoRelativo,
  timestampBrasilia,
  dataHojeBrasil,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
  inicioSemana,
  fimSemana,
  debugTimezone,
  isHorarioComercial,
  isHorarioRelatorioMatinal,
} from '@/lib/timezone';
import { Clock, MapPin, Monitor, Database, Server, Globe } from 'lucide-react';

interface TimezoneInfo {
  timezone: string;
  offset: number;
  isDST: boolean;
  currentTime: string;
  serverTime: string;
  difference: number;
}

export default function TimezoneDebugPage() {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [supabaseTime, setSupabaseTime] = useState<string>('');
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('🌐 Timezone Debug');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Atualizar tempo a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(agora());
      setTimezoneInfo(debugTimezone() as TimezoneInfo);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Carregar timezone info inicial
  useEffect(() => {
    setTimezoneInfo(debugTimezone() as TimezoneInfo);
    testarSupabaseTimezone();
  }, []);

  const testarSupabaseTimezone = async () => {
    try {
      const response = await fetch('/api/configuracoes/timezone/test');
      if (response.ok) {
        const data = await response.json();
        setSupabaseTime(data.timestamp);
      }
    } catch (error) {
      console.error('Erro ao testar Supabase timezone:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6" />
        </h1>
        <p className="text-muted-foreground">
          Verificação de timezone em todos os componentes do sistema
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatarHora(currentTime)}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatarData(currentTime)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Timezone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">America/Sao_Paulo</div>
            <div className="text-sm text-muted-foreground">UTC-3</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant={isHorarioComercial() ? 'default' : 'secondary'}>
                {isHorarioComercial() ? 'Horário Comercial' : 'Fora do Horário'}
              </Badge>
              <Badge
                variant={
                  isHorarioRelatorioMatinal() ? 'destructive' : 'outline'
                }
              >
                {isHorarioRelatorioMatinal()
                  ? 'Hora do Relatório'
                  : 'Hora Normal'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frontend Timezone Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Frontend (Next.js)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <strong>Agora (Brasil):</strong>
                <div className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                  {formatarDataHora(currentTime)}
                </div>
              </div>

              <div>
                <strong>Timestamp ISO:</strong>
                <div className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                  {timestampBrasilia()}
                </div>
              </div>

              <div>
                <strong>Período Atual:</strong>
                <div className="space-y-1 mt-1">
                  <div className="text-sm">Hoje: {dataHojeBrasil()}</div>
                  <div className="text-sm">
                    Início do Mês: {primeiroDiaDoMes()}
                  </div>
                  <div className="text-sm">Fim do Mês: {ultimoDiaDoMes()}</div>
                  <div className="text-sm">
                    Início da Semana: {inicioSemana()}
                  </div>
                  <div className="text-sm">Fim da Semana: {fimSemana()}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backend/Database Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backend/Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <strong>Supabase Timezone:</strong>
                <div className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                  {supabaseTime || 'Carregando...'}
                </div>
              </div>

              <div>
                <strong>Comparação UTC vs Brasil:</strong>
                {timezoneInfo && (
                  <div className="space-y-1 mt-1">
                    <div className="text-sm">UTC: {(timezoneInfo as any).utc}</div>
                    <div className="text-sm">Brasil: {(timezoneInfo as any).brasil}</div>
                    <div className="text-sm">
                      Offset: {(timezoneInfo as any).offset_horas}h
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={testarSupabaseTimezone} size="sm">
                Testar Supabase Timezone
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exemplos de Formatação */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Formatação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Data Atual</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>formatarData():</strong> {formatarData(currentTime)}
                </div>
                <div>
                  <strong>formatarDataHora():</strong>{' '}
                  {formatarDataHora(currentTime)}
                </div>
                <div>
                  <strong>formatarHora():</strong> {formatarHora(currentTime)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Tempo Relativo</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Há 1 hora:</strong>{' '}
                  {formatarTempoRelativo(
                    new Date(Date.now() - 60 * 60 * 1000).toISOString()
                  )}
                </div>
                <div>
                  <strong>Há 30 min:</strong>{' '}
                  {formatarTempoRelativo(
                    new Date(Date.now() - 30 * 60 * 1000).toISOString()
                  )}
                </div>
                <div>
                  <strong>Há 5 min:</strong>{' '}
                  {formatarTempoRelativo(
                    new Date(Date.now() - 5 * 60 * 1000).toISOString()
                  )}
                </div>
                <div>
                  <strong>Agora:</strong>{' '}
                  {formatarTempoRelativo(new Date().toISOString())}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Debug Info */}
      {timezoneInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Raw (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
              {JSON.stringify(timezoneInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
