'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  LargeModal,
  ModalField,
  ModalFormGrid,
  ModalSection,
} from '@/components/ui/large-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Plus,
  Trash2,
  RefreshCcw,
  Calculator,
  CheckCircle,
  AlertCircle,
  Edit,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  TrendingDown,
  Info,
  Sparkles,
  BarChart3,
  Table,
  CloudDownload
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface CMVSemanal {
  id?: number;
  bar_id: number;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  
  // Vendas
  vendas_brutas: number;
  vendas_liquidas: number;
  faturamento_bruto?: number; // alias/variante de vendas_brutas (usado no cálculo CMV Real %)
  
  // Estoque e Compras
  estoque_inicial: number;
  compras_periodo: number;
  estoque_final: number;
  
  // Consumos
  consumo_socios: number;
  consumo_beneficios: number;
  consumo_adm: number;
  consumo_rh: number;
  consumo_artista: number;
  outros_ajustes: number;
  ajuste_bonificacoes: number;
  
  // Cálculos
  cmv_real: number;
  cmv_percentual?: number; // CMV Real % = CMV R$ / Faturamento Bruto × 100
  faturamento_cmvivel: number;
  cmv_limpo_percentual: number;
  cmv_teorico_percentual: number;
  gap: number;
  
  // Estoque Final Detalhado
  estoque_final_cozinha: number;
  estoque_final_bebidas: number;
  estoque_final_drinks: number;
  
  // Compras Detalhadas
  compras_custo_comida: number;
  compras_custo_bebidas: number;
  compras_custo_outros: number;
  compras_custo_drinks: number;
  
  // Contas Especiais
  total_consumo_socios: number;
  mesa_beneficios_cliente: number;
  mesa_banda_dj: number;
  chegadeira: number;
  mesa_adm_casa: number;
  mesa_rh: number;
  
  // Categorias (legado)
  cmv_bebidas: number;
  cmv_alimentos: number;
  cmv_descartaveis: number;
  cmv_outros: number;
  
  // Metadados
  status: 'rascunho' | 'fechado' | 'auditado';
  responsavel?: string;
  observacoes?: string;
}

export default function CMVSemanalPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [criterioDataCompras, setCriterioDataCompras] = useState<'competencia' | 'criacao'>('competencia');
  const [sincronizando, setSincronizando] = useState(false);
  const [cmvs, setCmvs] = useState<CMVSemanal[]>([]);
  const [cmvsTotais, setCmvsTotais] = useState(0); // Total de CMVs antes do filtro
  const [anoFiltro, setAnoFiltro] = useState(() => new Date().getFullYear());
  const [statusFiltro, setStatusFiltro] = useState('TODOS');
  const [fatorCmv, setFatorCmv] = useState(0.35); // Fator de CMV para consumos (carregado do banco)
  
  // Modal de adicionar/editar
  const [modalAberto, setModalAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<CMVSemanal | null>(null);
  const [formData, setFormData] = useState<Partial<CMVSemanal>>({
    vendas_brutas: 0,
    vendas_liquidas: 0,
    estoque_inicial: 0,
    compras_periodo: 0,
    estoque_final: 0,
    consumo_socios: 0,
    consumo_beneficios: 0,
    consumo_adm: 0,
    consumo_rh: 0,
    consumo_artista: 0,
    outros_ajustes: 0,
    ajuste_bonificacoes: 0,
    cmv_real: 0,
    faturamento_cmvivel: 0,
    cmv_limpo_percentual: 0,
    cmv_teorico_percentual: 0,
    gap: 0,
    estoque_final_cozinha: 0,
    estoque_final_bebidas: 0,
    estoque_final_drinks: 0,
    compras_custo_comida: 0,
    compras_custo_bebidas: 0,
    compras_custo_outros: 0,
    compras_custo_drinks: 0,
    total_consumo_socios: 0,
    mesa_beneficios_cliente: 0,
    mesa_banda_dj: 0,
    chegadeira: 0,
    mesa_adm_casa: 0,
    mesa_rh: 0,
    cmv_bebidas: 0,
    cmv_alimentos: 0,
    cmv_descartaveis: 0,
    cmv_outros: 0,
    status: 'rascunho'
  });

  // Função para calcular número da semana
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  };

  // Calcular todos os valores automaticamente
  const calcularValoresAutomaticos = useCallback(() => {
    setFormData(prev => {
      const dados = { ...prev };
      
      // 1. Calcular consumos baseados nas contas especiais
      // Consumo Sócios = Total Consumo Sócios * fatorCmv
      dados.consumo_socios = (dados.total_consumo_socios || 0) * fatorCmv;
      
      // Consumo Benefícios = (Mesa Benefícios Cliente + Chegadeira) * 0.33
      dados.consumo_beneficios = ((dados.mesa_beneficios_cliente || 0) + (dados.chegadeira || 0)) * 0.33;
      
      // Consumo ADM = Mesa ADM/Casa * fatorCmv
      dados.consumo_adm = (dados.mesa_adm_casa || 0) * fatorCmv;
      
      // Consumo Artista = Mesa da Banda/DJ * fatorCmv
      dados.consumo_artista = (dados.mesa_banda_dj || 0) * fatorCmv;
      
      // 2. Calcular estoque final total
      dados.estoque_final = (dados.estoque_final_cozinha || 0) + 
                            (dados.estoque_final_bebidas || 0) + 
                            (dados.estoque_final_drinks || 0);
      
      // 3. Calcular compras do período total
      dados.compras_periodo = (dados.compras_custo_comida || 0) + 
                              (dados.compras_custo_bebidas || 0) + 
                              (dados.compras_custo_outros || 0) + 
                              (dados.compras_custo_drinks || 0);
      
      // 4. Calcular CMV Real
      // CMV Real = (Estoque Inicial + Compras - Estoque Final) - 
      //            (Consumo Sócios + Consumo Benefícios + Consumo ADM + Consumo RH + Consumo Artista + Outros Ajustes) +
      //            Ajuste Bonificações (bonificações aumentam o CMV - descontos recebidos)
      const cmvBruto = (dados.estoque_inicial || 0) + 
                       (dados.compras_periodo || 0) - 
                       (dados.estoque_final || 0);
      
      const totalConsumos = (dados.consumo_socios || 0) + 
                            (dados.consumo_beneficios || 0) + 
                            (dados.consumo_adm || 0) + 
                            (dados.consumo_rh || 0) + 
                            (dados.consumo_artista || 0) + 
                            (dados.outros_ajustes || 0);
      
      dados.cmv_real = cmvBruto - totalConsumos + (dados.ajuste_bonificacoes || 0);
      
      // 5. Calcular CMV Limpo (%) e CMV Real (%)
      // CMV Limpo = (CMV Real / Faturamento CMVível) * 100
      if ((dados.faturamento_cmvivel || 0) > 0) {
        dados.cmv_limpo_percentual = ((dados.cmv_real || 0) / (dados.faturamento_cmvivel || 1)) * 100;
      }
      // CMV Real % = CMV R$ / Faturamento Bruto × 100 (nunca copiar teórico)
      const fatBruto = dados.vendas_brutas || dados.faturamento_bruto || 0;
      dados.cmv_percentual = fatBruto > 0 ? ((dados.cmv_real || 0) / fatBruto) * 100 : 0;
      
      // 6. Calcular GAP
      // GAP = CMV Limpo - CMV Teórico
      dados.gap = (dados.cmv_limpo_percentual || 0) - (dados.cmv_teorico_percentual || 0);
      
      return dados;
    });
  }, [fatorCmv]);

  // Sincronizar tudo: Conta Azul + CMV (FUNÇÃO UNIFICADA)
  const sincronizarTudo = async () => {
    if (!selectedBar) {
      toast({
        title: "Bar não selecionado",
        description: "Selecione um bar para sincronizar os dados",
        variant: "destructive"
      });
      return;
    }

    setSincronizando(true);

    try {
      console.log('🔄 Iniciando sincronização completa...');

      // Processar CMV de TODAS as semanas (Conta Azul + ContaHub → Banco)
      console.log('📊 Processando CMV de todas as semanas...');
      const cmvResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cmv-semanal-auto`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ 
            bar_id: selectedBar.id,
            todas_semanas: true
          })
        }
      );
      
      if (!cmvResponse.ok) {
        const errorData = await cmvResponse.json().catch(() => ({}));
        console.warn('⚠️ Erro ao processar CMV:', errorData);
        throw new Error(errorData.error || 'Erro ao processar CMV');
      }
      
      const resultado = await cmvResponse.json();
      console.log('✅ CMV processado:', resultado.message);

      toast({
        title: "✅ Dados Atualizados",
        description: resultado.message || "Conta Azul + ContaHub sincronizados com sucesso"
      });

      carregarCMVs();

    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast({
        title: "Erro ao sincronizar",
        description: error instanceof Error ? error.message : "Falha na sincronização",
        variant: "destructive"
      });
    } finally {
      setSincronizando(false);
    }
  };

  // Processar semana atual automaticamente
  const processarSemanaAtual = async () => {
    if (!selectedBar) {
      toast({
        title: "Bar não selecionado",
        description: "Selecione um bar para processar o CMV",
        variant: "destructive"
      });
      return;
    }

    setCalculando(true);

    try {
      console.log('🤖 Processando CMV da semana atual automaticamente...');

      // Chamar a Edge Function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cmv-semanal-auto`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao processar CMV automático');
      }

      const resultado = await response.json();

      if (resultado.success) {
        toast({
          title: "✅ CMV Processado",
          description: "CMV da semana atual foi processado automaticamente",
        });

        // Recarregar lista
        carregarCMVs();
      } else {
        throw new Error(resultado.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error('Erro ao processar CMV automático:', error);
      toast({
        title: "Erro ao processar CMV",
        description: error instanceof Error ? error.message : "Não foi possível processar automaticamente",
        variant: "destructive"
      });
    } finally {
      setCalculando(false);
    }
  };

  // Buscar dados automáticos de APIs externas
  const buscarDadosAutomaticos = async () => {
    if (!selectedBar || !formData.data_inicio || !formData.data_fim) {
      toast({
        title: "Dados insuficientes",
        description: "Defina as datas da semana primeiro",
        variant: "destructive"
      });
      return;
    }

    setCalculando(true);

    try {
      console.log('🔍 Buscando dados automáticos...');

      const response = await fetch('/api/cmv-semanal/buscar-dados-automaticos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-selected-bar-id': String(selectedBar?.id || '')
        },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim,
          criterio_data: criterioDataCompras
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar dados automáticos');
      }

      const resultado = await response.json();

      if (resultado.success && resultado.data) {
        // Atualizar formData com os dados recebidos
        setFormData(prev => ({
          ...prev,
          ...resultado.data
        }));

        // Calcular valores automaticamente após carregar dados
        setTimeout(() => calcularValoresAutomaticos(), 100);

        toast({
          title: "✅ Dados carregados",
          description: "Dados automáticos foram carregados com sucesso",
        });

        console.log('✅ Dados automáticos carregados:', resultado.data);
      } else {
        throw new Error(resultado.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error('Erro ao buscar dados automáticos:', error);
      toast({
        title: "Erro ao buscar dados",
        description: error instanceof Error ? error.message : "Não foi possível carregar dados automáticos",
        variant: "destructive"
      });
    } finally {
      setCalculando(false);
    }
  };

  // Carregar dados
  const carregarCMVs = useCallback(async () => {
    if (!selectedBar || !user) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar.id.toString(),
        ano: anoFiltro.toString()
      });

      if (statusFiltro !== 'TODOS') {
        params.append('status', statusFiltro);
      }

      const response = await fetch(`/api/cmv-semanal?${params}`, {
        headers: {
          'x-selected-bar-id': String(selectedBar?.id || '')
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar CMVs');

      const data = await response.json();
      const todosOsCmvs = data.data || [];
      
      // Filtrar apenas CMVs com dados (não zerados)
      const cmvsComDados = todosOsCmvs.filter((cmv: CMVSemanal) => 
        cmv.faturamento_cmvivel > 0 || cmv.cmv_real > 0 || cmv.vendas_brutas > 0
      );
      
      setCmvsTotais(todosOsCmvs.length);
      setCmvs(cmvsComDados);

    } catch (error) {
      console.error('Erro ao carregar CMVs:', error);
      toast({
        title: "Erro ao carregar CMVs",
        description: "Não foi possível carregar os dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBar, user, anoFiltro, statusFiltro, toast]);

  // Abrir modal para adicionar
  const abrirModalAdicionar = () => {
    const hoje = new Date();
    const semanaAtual = getWeekNumber(hoje);
    
    // Calcular data de início e fim da semana
    const primeiroDiaSemana = new Date(hoje);
    primeiroDiaSemana.setDate(hoje.getDate() - hoje.getDay());
    
    const ultimoDiaSemana = new Date(primeiroDiaSemana);
    ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6);

    // Buscar estoque final da semana anterior como estoque inicial
    const semanaAnterior = cmvs.find(cmv => cmv.ano === anoFiltro && cmv.semana === (semanaAtual - 1));

    setItemEditando(null);
    setFormData({
      ano: anoFiltro,
      semana: semanaAtual,
      data_inicio: primeiroDiaSemana.toISOString().split('T')[0],
      data_fim: ultimoDiaSemana.toISOString().split('T')[0],
      vendas_brutas: 0,
      vendas_liquidas: 0,
      estoque_inicial: semanaAnterior?.estoque_final || 0, // Usar estoque final da semana anterior
      compras_periodo: 0,
      estoque_final: 0,
      consumo_socios: 0,
      consumo_beneficios: 0,
      consumo_adm: 0,
      consumo_rh: 0,
      consumo_artista: 0,
      outros_ajustes: 0,
      ajuste_bonificacoes: 0,
      cmv_real: 0,
      faturamento_cmvivel: 0,
      cmv_limpo_percentual: 0,
      cmv_teorico_percentual: 0,
      gap: 0,
      estoque_final_cozinha: 0,
      estoque_final_bebidas: 0,
      estoque_final_drinks: 0,
      compras_custo_comida: 0,
      compras_custo_bebidas: 0,
      compras_custo_outros: 0,
      compras_custo_drinks: 0,
      total_consumo_socios: 0,
      mesa_beneficios_cliente: 0,
      mesa_banda_dj: 0,
      chegadeira: 0,
      mesa_adm_casa: 0,
      mesa_rh: 0,
      cmv_bebidas: 0,
      cmv_alimentos: 0,
      cmv_descartaveis: 0,
      cmv_outros: 0,
      status: 'rascunho',
      responsavel: user?.nome || ''
    });
    setModalAberto(true);
  };

  // Abrir modal para editar
  const abrirModalEditar = (item: CMVSemanal) => {
    setItemEditando(item);
    setFormData(item);
    setModalAberto(true);
  };

  // Salvar item
  const salvarItem = async () => {
    if (!selectedBar || !formData.ano || !formData.semana) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha ano, semana e datas",
        variant: "destructive"
      });
      return;
    }

    setSalvando(true);

    try {
      // Calcular valores finais antes de salvar
      const dadosCalculados = { ...formData };
      
      // 1. Calcular consumos baseados nas contas especiais
      dadosCalculados.consumo_socios = (dadosCalculados.total_consumo_socios || 0) * fatorCmv;
      dadosCalculados.consumo_beneficios = ((dadosCalculados.mesa_beneficios_cliente || 0) + (dadosCalculados.chegadeira || 0)) * 0.33;
      dadosCalculados.consumo_adm = (dadosCalculados.mesa_adm_casa || 0) * fatorCmv;
      dadosCalculados.consumo_artista = (dadosCalculados.mesa_banda_dj || 0) * fatorCmv;
      
      // 2. Calcular estoque final total
      dadosCalculados.estoque_final = (dadosCalculados.estoque_final_cozinha || 0) + 
                                      (dadosCalculados.estoque_final_bebidas || 0) + 
                                      (dadosCalculados.estoque_final_drinks || 0);
      
      // 3. Calcular compras do período total
      dadosCalculados.compras_periodo = (dadosCalculados.compras_custo_comida || 0) + 
                                        (dadosCalculados.compras_custo_bebidas || 0) + 
                                        (dadosCalculados.compras_custo_outros || 0) + 
                                        (dadosCalculados.compras_custo_drinks || 0);
      
      // 4. Calcular CMV Real
      const cmvBruto = (dadosCalculados.estoque_inicial || 0) + 
                       (dadosCalculados.compras_periodo || 0) - 
                       (dadosCalculados.estoque_final || 0);
      
      const totalConsumos = (dadosCalculados.consumo_socios || 0) + 
                            (dadosCalculados.consumo_beneficios || 0) + 
                            (dadosCalculados.consumo_adm || 0) + 
                            (dadosCalculados.consumo_rh || 0) + 
                            (dadosCalculados.consumo_artista || 0) + 
                            (dadosCalculados.outros_ajustes || 0);
      
      dadosCalculados.cmv_real = cmvBruto - totalConsumos + (dadosCalculados.ajuste_bonificacoes || 0);
      
      // 5. Calcular CMV Limpo (%) e CMV Real (%)
      if ((dadosCalculados.faturamento_cmvivel || 0) > 0) {
        dadosCalculados.cmv_limpo_percentual = ((dadosCalculados.cmv_real || 0) / (dadosCalculados.faturamento_cmvivel || 1)) * 100;
      }
      const fatBruto = dadosCalculados.vendas_brutas || dadosCalculados.faturamento_bruto || 0;
      dadosCalculados.cmv_percentual = fatBruto > 0 ? ((dadosCalculados.cmv_real || 0) / fatBruto) * 100 : 0;
      
      // 6. Calcular GAP
      dadosCalculados.gap = (dadosCalculados.cmv_limpo_percentual || 0) - (dadosCalculados.cmv_teorico_percentual || 0);

      const registro = {
        ...dadosCalculados,
        bar_id: selectedBar.id,
        responsavel: user?.nome || ''
      };

      const response = await fetch('/api/cmv-semanal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-selected-bar-id': String(selectedBar?.id || '')
        },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          registro
        })
      });

      if (!response.ok) throw new Error('Erro ao salvar');

      toast({
        title: "✅ Sucesso",
        description: "CMV salvo com sucesso"
      });

      setModalAberto(false);
      carregarCMVs();

    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o CMV",
        variant: "destructive"
      });
    } finally {
      setSalvando(false);
    }
  };

  // Excluir item
  const excluirItem = async (id: number) => {
    if (!confirm('Deseja realmente excluir este CMV?')) return;

    try {
      const response = await fetch(`/api/cmv-semanal?id=${id}`, {
        method: 'DELETE',
        headers: {
          'x-selected-bar-id': String(selectedBar?.id || '')
        }
      });

      if (!response.ok) throw new Error('Erro ao excluir');

      toast({
        title: "Sucesso",
        description: "CMV excluído com sucesso"
      });

      carregarCMVs();

    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o CMV",
        variant: "destructive"
      });
    }
  };

  // Atualizar status
  const atualizarStatus = async (id: number, novoStatus: string) => {
    try {
      const response = await fetch('/api/cmv-semanal', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-selected-bar-id': String(selectedBar?.id || '')
        },
        body: JSON.stringify({ id, status: novoStatus })
      });

      if (!response.ok) throw new Error('Erro ao atualizar status');

      toast({
        title: "Status atualizado",
        description: "Status do CMV foi atualizado"
      });

      carregarCMVs();

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    setPageTitle('📊 CMV Semanal');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Carregar fator CMV do banco de regras do bar
  useEffect(() => {
    const carregarFatorCmv = async () => {
      if (!selectedBar?.id) return;
      try {
        const response = await fetch(`/api/config/bar/${selectedBar.id}/regras`);
        if (response.ok) {
          const regras = await response.json();
          if (regras.cmv_fator_consumo) {
            setFatorCmv(regras.cmv_fator_consumo);
          }
        }
      } catch (error) {
        console.warn('Usando fator CMV padrão (0.35):', error);
      }
    };
    carregarFatorCmv();
  }, [selectedBar?.id]);

  useEffect(() => {
    if (selectedBar && user) {
      carregarCMVs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBar, user, anoFiltro, statusFiltro]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState
          title="Carregando CMVs..."
          subtitle="Processando dados de custo de mercadoria vendida"
          icon={<Calculator className="w-4 h-4" />}
        />
      </div>
    );
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  const formatarPercentual = (valor: number) => {
    return `${(valor || 0).toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 py-4 max-w-[98vw]">
        {/* Filtros e Ações */}
        <Card className="card-dark mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <TrendingUp className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Botões de Ação */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Link href="/ferramentas/cmv-semanal/tabela">
                <Button 
                  variant="outline" 
                  className="border-gray-300 dark:border-gray-600"
                  leftIcon={<Table className="h-4 w-4" />}
                >
                  Visualização Tabela
                </Button>
              </Link>
              <Link href="/ferramentas/cmv-semanal/visualizar">
                <Button 
                  variant="outline" 
                  className="border-gray-300 dark:border-gray-600"
                  leftIcon={<BarChart3 className="h-4 w-4" />}
                >
                  Dashboard
                </Button>
              </Link>
              <Button
                onClick={sincronizarTudo}
                disabled={sincronizando}
                variant="outline"
                leftIcon={sincronizando ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              >
                {sincronizando ? 'Atualizando...' : 'Atualizar Dados'}
              </Button>
              <Button
                onClick={processarSemanaAtual}
                disabled={calculando}
                variant="outline"
                leftIcon={calculando ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              >
                {calculando ? 'Processando...' : 'Processar Semana Atual'}
              </Button>
              <Button
                onClick={abrirModalAdicionar}
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Adicionar CMV
              </Button>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Ano</Label>
                <Select value={anoFiltro.toString()} onValueChange={(value) => setAnoFiltro(parseInt(value))}>
                  <SelectTrigger className="select-dark w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="modal-select-content">
                    {[2024, 2025, 2026].map((ano) => (
                      <SelectItem key={ano} value={ano.toString()} className="modal-select-item">
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Status</Label>
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="select-dark w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="modal-select-content">
                    <SelectItem value="TODOS" className="modal-select-item">Todos</SelectItem>
                    <SelectItem value="rascunho" className="modal-select-item">Rascunho</SelectItem>
                    <SelectItem value="fechado" className="modal-select-item">Fechado</SelectItem>
                    <SelectItem value="auditado" className="modal-select-item">Auditado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={carregarCMVs}
                variant="outline"
                className="btn-outline-dark mt-6"
                leftIcon={<RefreshCcw className="h-4 w-4" />}
              >
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Aviso sobre filtro automático */}
        {cmvs.length === 0 && (
          <Card className="card-dark mb-6 border-border bg-muted/40">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    Nenhum CMV com dados encontrado
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Não há registros de CMV com dados preenchidos para o ano selecionado. 
                    Use o botão <strong>&quot;Atualizar Dados&quot;</strong> para sincronizar dados do Conta Azul e ContaHub, 
                    ou <strong>&quot;Processar Semana Atual&quot;</strong> para calcular o CMV da semana corrente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela de CMVs */}
        <Card className="card-dark">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                CMVs Registrados ({cmvs.length})
              </div>
              {cmvsTotais > cmvs.length && (
                <Badge variant="outline" className="text-xs">
                  {cmvsTotais - cmvs.length} sem dados ocultos
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Semana</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Período</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Fat. CMVível</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">CMV Real</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">CMV Limpo %</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Gap</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cmvs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <Package className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                          Nenhum CMV encontrado
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                          Adicione CMVs para começar o controle
                        </p>
                      </td>
                    </tr>
                  ) : (
                    cmvs.map((cmv) => (
                      <tr
                        key={cmv.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                          {cmv.ano} - S{cmv.semana}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(cmv.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                          {new Date(cmv.data_fim).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          {formatarMoeda(cmv.faturamento_cmvivel)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          {formatarMoeda(cmv.cmv_real || 0)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={`${
                              (cmv.cmv_limpo_percentual || 0) <= 33
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                                : (cmv.cmv_limpo_percentual || 0) <= 40
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300'
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'
                            }`}
                          >
                            {formatarPercentual(cmv.cmv_limpo_percentual || 0)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={`${
                              (cmv.gap || 0) < 0
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300'
                                : (cmv.gap || 0) >= 0 && (cmv.gap || 0) <= 5
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'
                            }`}
                          >
                            {formatarPercentual(cmv.gap || 0)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={`cursor-pointer ${
                              cmv.status === 'auditado'
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                                : cmv.status === 'fechado'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300'
                            }`}
                            onClick={() => {
                              const proximoStatus =
                                cmv.status === 'rascunho'
                                  ? 'fechado'
                                  : cmv.status === 'fechado'
                                  ? 'auditado'
                                  : 'rascunho';
                              atualizarStatus(cmv.id!, proximoStatus);
                            }}
                          >
                            {cmv.status === 'auditado' && <CheckCircle className="h-3 w-3 mr-1 inline" />}
                            {cmv.status === 'fechado' && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                            {cmv.status.charAt(0).toUpperCase() + cmv.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirModalEditar(cmv)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => excluirItem(cmv.id!)}
                              className="h-8 w-8 p-0"
                              disabled={cmv.status === 'auditado'}
                            >
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal Adicionar/Editar */}
        <LargeModal
          open={modalAberto}
          onOpenChange={setModalAberto}
          title={itemEditando ? 'Editar CMV Semanal' : 'Adicionar CMV Semanal'}
          description="Preencha os dados do CMV da semana. Os cálculos serão feitos automaticamente."
          size="3xl"
          onSave={salvarItem}
          saveText="Salvar CMV"
          loading={salvando}
        >
          {/* Botão de calcular automaticamente */}
          <div className="mb-6 p-4 bg-muted/40 rounded-lg border border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-semibold text-foreground">
                    Preencher Dados Automaticamente
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Buscar dados de consumo dos sócios, compras do Conta Azul, faturamento do ContaHub e estoques automaticamente.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Compras Conta Azul por:</Label>
                  <Select value={criterioDataCompras} onValueChange={(v: 'competencia' | 'criacao') => setCriterioDataCompras(v)}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="competencia">Competência (data_competencia)</SelectItem>
                      <SelectItem value="criacao">Data de Criação (criado_em)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={buscarDadosAutomaticos}
                disabled={calculando || !formData.data_inicio || !formData.data_fim}
                className="btn-primary-dark whitespace-nowrap"
              >
                {calculando ? (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Buscar Dados
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Seção 1: Identificação da Semana */}
          <ModalSection title="📅 Identificação da Semana">
            <ModalFormGrid columns={4}>
              <ModalField label="Ano" required>
                <Input
                  type="number"
                  value={formData.ano || ''}
                  onChange={(e) => setFormData({ ...formData, ano: parseInt(e.target.value) })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Semana" required>
                <Input
                  type="number"
                  min="1"
                  max="53"
                  value={formData.semana || ''}
                  onChange={(e) => setFormData({ ...formData, semana: parseInt(e.target.value) })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Data Início" required>
                <Input
                  type="date"
                  value={formData.data_inicio || ''}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Data Fim" required>
                <Input
                  type="date"
                  value={formData.data_fim || ''}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  className="input-dark"
                />
              </ModalField>
            </ModalFormGrid>
          </ModalSection>

          {/* Seção 2: Estoque Final Detalhado */}
          <ModalSection 
            title="📦 Estoque Final (por tipo)" 
            description="Soma de estoque flutuante + fechado de cada área"
          >
            <ModalFormGrid columns={3}>
              <ModalField label="Cozinha" description="Insumos da cozinha">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.estoque_final_cozinha || 0}
                  onChange={(e) => setFormData({ ...formData, estoque_final_cozinha: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Bebidas + Tabacaria" description="Insumos do salão">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.estoque_final_bebidas || 0}
                  onChange={(e) => setFormData({ ...formData, estoque_final_bebidas: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Drinks" description="Insumos de drinks">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.estoque_final_drinks || 0}
                  onChange={(e) => setFormData({ ...formData, estoque_final_drinks: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
            </ModalFormGrid>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Estoque Final Total: {formatarMoeda(formData.estoque_final || 0)}
              </p>
            </div>
          </ModalSection>

          {/* Seção 3: Compras do Período */}
          <ModalSection 
            title="🛒 Compras do Período (Conta Azul)" 
            description="Compras por categoria vindas do Conta Azul"
          >
            <ModalFormGrid columns={4}>
              <ModalField label="Custo Comida">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.compras_custo_comida || 0}
                  onChange={(e) => setFormData({ ...formData, compras_custo_comida: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Custo Bebidas">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.compras_custo_bebidas || 0}
                  onChange={(e) => setFormData({ ...formData, compras_custo_bebidas: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Custo Outros">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.compras_custo_outros || 0}
                  onChange={(e) => setFormData({ ...formData, compras_custo_outros: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Custo Drinks">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.compras_custo_drinks || 0}
                  onChange={(e) => setFormData({ ...formData, compras_custo_drinks: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
            </ModalFormGrid>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Compras Total: {formatarMoeda(formData.compras_periodo || 0)}
              </p>
            </div>
          </ModalSection>

          {/* Seção 4: Contas Especiais para Consumos */}
          <ModalSection 
            title="👥 Contas Especiais (Consumos Internos)" 
            description="Valores das mesas/contas que entram no cálculo de consumo"
          >
            <ModalFormGrid columns={3}>
              <ModalField label="Total Consumo Sócios" description={`x-corbal, etc. × ${fatorCmv}`}>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_consumo_socios || 0}
                  onChange={(e) => setFormData({ ...formData, total_consumo_socios: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Mesa Benefícios Cliente" description="Parte do cálculo × 0.33 (benefícios)">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.mesa_beneficios_cliente || 0}
                  onChange={(e) => setFormData({ ...formData, mesa_beneficios_cliente: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Mesa Banda/DJ" description={`× ${fatorCmv}`}>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.mesa_banda_dj || 0}
                  onChange={(e) => setFormData({ ...formData, mesa_banda_dj: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Chegadeira" description="Parte do cálculo × 0.33">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.chegadeira || 0}
                  onChange={(e) => setFormData({ ...formData, chegadeira: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Mesa ADM/Casa" description={`× ${fatorCmv}`}>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.mesa_adm_casa || 0}
                  onChange={(e) => setFormData({ ...formData, mesa_adm_casa: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Mesa RH" description="Sem multiplicador">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.mesa_rh || 0}
                  onChange={(e) => setFormData({ ...formData, mesa_rh: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
            </ModalFormGrid>
          </ModalSection>

          {/* Seção 5: Consumos Calculados */}
          <ModalSection 
            title="🍽️ Consumos Calculados" 
            description="Valores calculados automaticamente baseados nas contas especiais"
            collapsible
            defaultOpen={false}
          >
            <ModalFormGrid columns={3}>
              <ModalField label="Consumo Sócios">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.consumo_socios || 0}
                  readOnly
                  className="input-dark bg-gray-100 dark:bg-gray-600"
                />
              </ModalField>
              <ModalField label="Consumo Benefícios">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.consumo_beneficios || 0}
                  readOnly
                  className="input-dark bg-gray-100 dark:bg-gray-600"
                />
              </ModalField>
              <ModalField label="Consumo ADM">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.consumo_adm || 0}
                  readOnly
                  className="input-dark bg-gray-100 dark:bg-gray-600"
                />
              </ModalField>
              <ModalField label="Consumo RH">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.consumo_rh || 0}
                  onChange={(e) => setFormData({ ...formData, consumo_rh: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Consumo Artista">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.consumo_artista || 0}
                  readOnly
                  className="input-dark bg-gray-100 dark:bg-gray-600"
                />
              </ModalField>
            </ModalFormGrid>
          </ModalSection>

          {/* Seção 6: Estoque e Ajustes */}
          <ModalSection 
            title="⚖️ Estoque Inicial e Ajustes" 
            description="Estoque inicial (vem da semana anterior) e ajustes manuais"
          >
            <ModalFormGrid columns={3}>
              <ModalField label="Estoque Inicial" description="Automático da semana anterior">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.estoque_inicial || 0}
                  onChange={(e) => setFormData({ ...formData, estoque_inicial: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Outros Ajustes" description="Ajustes manuais">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.outros_ajustes || 0}
                  onChange={(e) => setFormData({ ...formData, outros_ajustes: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField label="Ajuste Bonificações" description="Bonificações recebidas">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.ajuste_bonificacoes || 0}
                  onChange={(e) => setFormData({ ...formData, ajuste_bonificacoes: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
            </ModalFormGrid>
          </ModalSection>

          {/* Seção 7: Faturamento e Metas */}
          <ModalSection 
            title="💰 Faturamento e Metas" 
            description="Faturamento CMVível e CMV teórico esperado"
          >
            <ModalFormGrid columns={2}>
              <ModalField 
                label="Faturamento CMVível" 
                description="Faturamento - Comissões (vr_repique)"
              >
                <Input
                  type="number"
                  step="0.01"
                  value={formData.faturamento_cmvivel || 0}
                  onChange={(e) => setFormData({ ...formData, faturamento_cmvivel: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
              <ModalField 
                label="CMV Teórico (%)" 
                description="Meta/esperado de CMV"
              >
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cmv_teorico_percentual || 0}
                  onChange={(e) => setFormData({ ...formData, cmv_teorico_percentual: parseFloat(e.target.value) || 0 })}
                  className="input-dark"
                />
              </ModalField>
            </ModalFormGrid>
          </ModalSection>

          {/* Seção 8: Resultado do CMV */}
          <div className="p-6 bg-muted/40 rounded-lg border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="h-6 w-6 text-muted-foreground" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Resultado do CMV Semanal
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">CMV Real</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatarMoeda(formData.cmv_real || 0)}
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">CMV Limpo</p>
                <p className={`text-xl font-bold ${
                  (formData.cmv_limpo_percentual || 0) <= 33
                    ? 'text-green-600 dark:text-green-400'
                    : (formData.cmv_limpo_percentual || 0) <= 40
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatarPercentual(formData.cmv_limpo_percentual || 0)}
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">CMV Teórico</p>
                <p className="text-xl font-bold text-foreground">
                  {formatarPercentual(formData.cmv_teorico_percentual || 0)}
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Gap</p>
                <p className={`text-xl font-bold ${
                  (formData.gap || 0) < 0
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : (formData.gap || 0) >= 0 && (formData.gap || 0) <= 5
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatarPercentual(formData.gap || 0)}
                </p>
              </div>
            </div>

            {/* Explicação da fórmula */}
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p><strong>CMV Real =</strong> (Estoque Inicial + Compras - Estoque Final) - (Consumos) - Bonificações</p>
                  <p><strong>CMV Limpo =</strong> (CMV Real / Faturamento CMVível) × 100</p>
                  <p><strong>Gap =</strong> CMV Limpo - CMV Teórico</p>
                </div>
              </div>
            </div>
          </div>

          {/* Observações */}
          <ModalSection title="📝 Observações" description="Anotações e comentários adicionais">
            <ModalField label="Observações" fullWidth>
              <Textarea
                value={formData.observacoes || ''}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais sobre esta semana..."
                className="textarea-dark min-h-[100px]"
                rows={4}
              />
            </ModalField>
          </ModalSection>
        </LargeModal>
      </div>
    </div>
  );
}
