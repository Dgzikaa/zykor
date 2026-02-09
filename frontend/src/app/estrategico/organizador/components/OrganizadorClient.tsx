'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  ChevronLeft, 
  Calendar, 
  Target,
  Trash2,
  Edit,
  Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBar } from '@/contexts/BarContext';
import { Organizador } from '../services/organizador-service';
import { apiCall } from '@/lib/api-client';

interface OrganizadorClientProps {
  initialData: Organizador[];
  barId: number;
  barNome: string;
}

export function OrganizadorClient({ initialData, barId, barNome }: OrganizadorClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { selectedBar } = useBar();
  
  const [organizadores, setOrganizadores] = useState<Organizador[]>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOrganizadores(initialData);
  }, [initialData]);

  const carregarOrganizadores = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizador?bar_id=${barId}`);
      const data = await response.json();
      if (data.organizadores) {
        setOrganizadores(data.organizadores);
      }
    } catch (error) {
      console.error('Erro ao carregar organizadores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarNovo = () => {
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;
    let trimestreAtual = 1;
    if (mesAtual >= 1 && mesAtual <= 3) trimestreAtual = 1;
    else if (mesAtual >= 4 && mesAtual <= 6) trimestreAtual = 2;
    else if (mesAtual >= 7 && mesAtual <= 9) trimestreAtual = 3;
    else trimestreAtual = 4;
    
    router.push(`/estrategico/organizador/novo?ano=${anoAtual}&trimestre=${trimestreAtual}`);
  };

  const handleEditar = (id: number) => {
    router.push(`/estrategico/organizador/${id}`);
  };

  const handleDuplicar = async (org: Organizador) => {
    try {
      const response = await fetch(`/api/organizador?bar_id=${barId}&id=${org.id}`);
      const data = await response.json();
      
      if (data.organizador) {
        const novoTrimestre = org.trimestre === 4 ? 1 : (org.trimestre || 1) + 1;
        const novoAno = org.trimestre === 4 ? org.ano + 1 : org.ano;
        
        const createResponse = await fetch('/api/organizador', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data.organizador,
            id: undefined,
            ano: novoAno,
            trimestre: novoTrimestre,
            okrs: data.okrs?.map((o: any) => ({ ...o, id: undefined })) || []
          })
        });

        if (createResponse.ok) {
          toast({
            title: 'Sucesso!',
            description: `Organizador duplicado para ${novoTrimestre}º Tri ${novoAno}`
          });
          carregarOrganizadores();
        }
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível duplicar o organizador',
        variant: 'destructive'
      });
    }
  };

  const handleDeletar = async (id: number, nome: string) => {
    const confirmado = window.confirm(`Tem certeza que deseja excluir "${nome}"?\n\nEsta ação não pode ser desfeita.`);
    
    if (!confirmado) return;
    
    try {
      const response = await fetch(`/api/organizador?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Sucesso!',
          description: 'Organizador removido'
        });
        carregarOrganizadores();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o organizador',
        variant: 'destructive'
      });
    }
  };

  const getNomePeriodo = (org: Organizador) => {
    if (org.tipo === 'anual' || !org.trimestre) {
      return `Visão Anual ${org.ano}`;
    }
    return `${org.trimestre}º Trimestre ${org.ano}`;
  };

  const getCorTrimestre = (trimestre: number | null) => {
    if (!trimestre) return 'bg-blue-500';
    const cores: Record<number, string> = {
      1: 'bg-cyan-500',
      2: 'bg-green-500',
      3: 'bg-yellow-500',
      4: 'bg-orange-500'
    };
    return cores[trimestre] || 'bg-gray-500';
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/estrategico')}
            className="text-gray-600 dark:text-gray-400"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Organizador de Visão
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Planejamento estratégico anual e trimestral • {barNome}
            </p>
          </div>
        </div>
        
        <Button onClick={handleCriarNovo} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Novo Organizador
        </Button>
      </div>

      {/* Lista de Organizadores */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-white dark:bg-gray-800 h-40 animate-pulse" />
          ))}
        </div>
      ) : organizadores.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum organizador criado
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Crie seu primeiro Organizador de Visão para começar o planejamento estratégico
            </p>
            <Button onClick={handleCriarNovo} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Organizador
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizadores.map((org) => (
            <Card 
              key={org.id} 
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow group overflow-hidden"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => handleEditar(org.id)}
                  >
                    <div className={`w-3 h-3 rounded-full ${getCorTrimestre(org.trimestre)}`} />
                    <CardTitle className="text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {getNomePeriodo(org)}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => handleEditar(org.id)} title="Editar"><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicar(org)} title="Duplicar"><Copy className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletar(org.id, getNomePeriodo(org))} className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent onClick={() => handleEditar(org.id)} className="cursor-pointer">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 h-10">
                  {org.missao || 'Missão não definida'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Atualizado em {new Date(org.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
