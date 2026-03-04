# ZYKOR - CONTEXTO COMPLETO DO SISTEMA

> **LEIA ESTE ARQUIVO EM CADA NOVO CHAT!**  
> Última atualização: **27/02/2026 - 11:45 BRT**

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Dados do Negócio](#dados-do-negócio)
4. [Otimizações Recentes](#otimizações-recentes-26022026)
5. [Sistema CMO e CMA](#sistema-cmo-e-cma-26022026)
6. [Sistema de Exploração Diária Automatizada](#sistema-de-exploração-diária-automatizada-27022026)
7. [Integrações](#integrações)
8. [Sistema de Agentes IA](#sistema-de-agentes-ia)
9. [Decisões Arquiteturais](#decisões-arquiteturais)

---

## VISÃO GERAL

**Nome**: SGB (Sistema de Gestão de Bares) / Zykor  
**Versão**: 2.0  
**Project ID Supabase**: `uqtgsvujwcbymjmvkjhy`

### Stack Tecnológica
- **Frontend**: Next.js 14+ com TypeScript, React, TailwindCSS
- **Backend**: Supabase Edge Functions (Deno)
- **Banco**: PostgreSQL (Supabase)
- **IA**: Google Gemini 2.0 Flash
- **Notificações**: Discord Webhooks
- **Autenticação**: Supabase Auth + localStorage

---

## ARQUITETURA DO SISTEMA

### Métricas Atuais (26/02/2026)

| Métrica | Quantidade | Observação |
|---------|------------|------------|
| **Cron Jobs** | 27 | Redução de 40% |
| **Edge Functions** | 38 (Supabase) / 12 (local) | Redução de 66% |
| **Database Functions** | 61 | Redução de 75% |
| **Páginas Frontend** | 131 | Redução de 5 páginas duplicadas |
| **Componentes UI** | 61 | Consolidação de Cards e Loading |
| **Módulos Compartilhados** | 8 | Novos |
| **Dispatchers** | 8 | Arquitetura unificada |

### Dispatchers Unificados

**1. agente-dispatcher** (Agentes IA)
- Analise diária, semanal, mensal
- Insights automáticos
- Detecção de padrões
- 12 tipos de agentes

**2. alertas-dispatcher** (Alertas Proativos)
- Alertas operacionais
- Alertas financeiros
- Alertas de qualidade
- 4 tipos de alertas

**3. integracao-dispatcher** (Integrações Externas)
- Yuzer (reservas)
- Sympla (ingressos)
- NIBO (financeiro)
- GetIn (lista/entrada)

**4. contahub-sync** (Sincronização ContaHub)
- Sync automático diário
- Sync retroativo
- Processamento de dados
- 6 tipos de sync

**5. google-sheets-sync** (Planilhas Google)
- NPS, Voz do Cliente
- Insumos, Receitas
- Contagem de estoque
- 8 tipos de planilhas

**6. discord-dispatcher** (Notificações Discord)
- Notificações gerais
- Alertas críticos
- Logs de sistema

**7. sync-dispatcher** (Sincronizações Gerais)
- Eventos, Desempenho
- Stockout, Marketing
- 4 tipos de sync

**8. webhook-dispatcher** (Webhooks Externos)
- Webhooks de terceiros
- Callbacks de APIs

### Módulos Compartilhados (_shared/)

1. **gemini-client.ts** - Cliente Google Gemini AI
2. **discord-notifier.ts** - Notificações Discord padronizadas
3. **eventos-data.ts** - Busca de dados de eventos
4. **formatters.ts** - Formatação de valores (R$, %, datas)
5. **tendency-calculator.ts** - Cálculos estatísticos
6. **contahub-client.ts** - Cliente ContaHub unificado
7. **google-sheets-config.ts** - Configurações Google Sheets
8. **sheets-parsers.ts** - Parsers de dados de planilhas

### Frontend - Estrutura

**Páginas Principais**:
- `/visao-geral` - Dashboard principal
- `/estrategico/desempenho` - Desempenho semanal
- `/estrategico/planejamento-comercial` - Planejamento
- `/analitico/clientes` - CRM e segmentação
- `/ferramentas/cmv-semanal` - CMV e custos
- `/ferramentas/voz-cliente` - Feedbacks

**Componentes Unificados**:
- `unified-loading.tsx` - Loading states (24 arquivos consolidados)
- `lazy-motion.tsx` - Framer Motion lazy-loaded (~50KB economia)
- `lazy-charts.tsx` - Recharts lazy-loaded (~100KB economia)
- `lazy-components.tsx` - Componentes pesados lazy-loaded

**Cards Consolidados**:
- `card.tsx` - Card básico (shadcn/ui)
- `kpi-card.tsx` - Card de KPIs
- `dashboard-card.tsx` - Card completo para dashboards

---

## DADOS DO NEGÓCIO

### Bares no Sistema

| ID | Nome | CNPJ | Status |
|----|------|------|--------|
| 3 | Ordinário Bar | 12.345.678/0001-90 | PRINCIPAL |
| 4 | Deboche Bar | 98.765.432/0001-10 | Ativo |

### Ordinário Bar - Dados Completos

**Endereço**: SBS Q. 2 BL Q Lojas 5/6 - Asa Sul, Brasília - DF, 70070-120  
**Instagram**: @ordinariobar  
**CNPJ**: 12.345.678/0001-90

**Sócios (6)**: Gonza, Cadu, Digão, Corbal, Diogo, Augusto

**Capacidade**:
- Máxima simultânea: 850 pessoas
- Lotação máxima (giro): 1.200 pessoas
- Lugares sentados: 400-500 pessoas

**Horário**: 18h - 02h (TODOS OS DIAS em 2026)

**Gêneros Musicais**: Pagode (78 eventos) e Samba (76 eventos)

### Recordes Históricos

| Métrica | Valor | Data |
|---------|-------|------|
| Maior Faturamento Dia | R$ 147.509,90 | 03/01/2026 |
| Maior Público Dia | 1.316 pessoas | 03/01/2026 |
| Maior Faturamento Mês | R$ 1.850.434 | Dezembro/2025 |

### Faturamento Anual

| Ano | Faturamento | Clientes | Dias Operação |
|-----|-------------|----------|---------------|
| 2025 | R$ 10.998.108,44 | 104.828 | 248 dias |
| 2026 | R$ 311.742 (parcial) | 2.898 | 6 dias |

**Médias 2025**:
- Média diária: R$ 44.347
- Ticket médio: R$ 104,91

### Média por Dia da Semana

| Dia | Média Fat | Média Clientes | Recorde |
|-----|-----------|----------------|---------|
| Sexta | R$ 115.630 | 1.094 | R$ 129.616 |
| Sábado | R$ 98.869 | 915 | R$ 147.509 |
| Domingo | R$ 90.418 | 874 | R$ 112.149 |
| Quarta | R$ 70.229 | 673 | R$ 103.489 |
| Quinta | R$ 43.277 | 431 | R$ 58.550 |
| Terça | R$ 36.218 | 376 | R$ 64.665 |
| Segunda | R$ 21.516 | 208 | R$ 26.749 |

### Metas de Faturamento 2026

| Dia | Meta |
|-----|------|
| Segunda | R$ 14.175,82 |
| Terça | R$ 14.175,82 |
| Quarta | R$ 35.000,00 |
| Quinta | R$ 25.000,00 |
| Sexta | R$ 70.000,00 |
| Sábado | R$ 60.000,00 |
| Domingo | R$ 58.000,00 |

**Meta semanal**: R$ 276.351,64  
**Meta mensal**: ~R$ 930.000

### KPIs Operacionais

| Métrica | Valor |
|---------|-------|
| Ticket Médio ContaHub | R$ 93 |
| Ticket Médio Bar | R$ 77,50 |
| Ticket Médio Entrada | R$ 15,50 |
| CMV Teórico | 27% |
| CMV Limpo | 31% |
| CMO (Custo Mão de Obra) | 20-23% |
| Margem Ideal | 65% |
| Stockout Médio | 8.55% (corrigido 26/02) |

**Produtos Excluídos do Stockout**:
- `[HH]` - Happy Hour (promoções)
- `[DD]` - Dose Dupla (promoções)
- `[IN]` - Insumos (não vendáveis)

### NPS e Avaliações

**NPS Geral**: 84 (cálculo tradicional: % Promotores - % Detratores)

| Categoria | Quantidade | % |
|-----------|------------|---|
| Promotores (9-10) | 1.558 | 86,4% |
| Neutros (7-8) | 205 | 11,4% |
| Detratores (0-6) | 40 | 2,2% |

**Pontos fortes**: Atendimento, Música, Ambiente  
**Pontos a melhorar**: Drinks (7.4), Comida (7.7)

---

## 💻 PADRÕES DE CÓDIGO

### APIs Next.js (Route Handlers)

#### Padrão GET com Filtros

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Extrair parâmetros
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const semana = searchParams.get('semana');

    // 2. Validar parâmetros obrigatórios
    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // 3. Conectar ao Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    // 4. Construir query com filtros opcionais
    let query = supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', barId);

    if (ano) query = query.eq('ano', ano);
    if (semana) query = query.eq('semana', semana);

    // 5. Executar query
    const { data, error } = await query.order('data_evento', { ascending: false });

    if (error) {
      console.error('Erro ao buscar dados:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar dados' },
        { status: 500 }
      );
    }

    // 6. Tipar como any[] para evitar problemas
    const dados = (data || []) as any[];

    // 7. Retornar resposta
    return NextResponse.json({
      success: true,
      data: dados,
      total: dados.length
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
```

---

#### Padrão POST com Validação

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Parse do body
    const body = await request.json();
    const { bar_id, ano, semana, dados } = body;

    // 2. Validação
    if (!bar_id || !ano || !semana) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // 3. Conectar ao Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    // 4. Pegar user_id do header (se disponível)
    const userId = request.headers.get('x-user-id');
    const userIdInt = userId ? parseInt(userId) : null;

    // 5. Inserir no banco
    const { data: novoRegistro, error } = await supabase
      .from('tabela')
      .insert({
        bar_id,
        ano,
        semana,
        ...dados,
        created_by: userIdInt,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir:', error);
      return NextResponse.json(
        { error: 'Erro ao criar registro' },
        { status: 500 }
      );
    }

    // 6. Retornar sucesso
    return NextResponse.json({
      success: true,
      data: novoRegistro,
      message: 'Registro criado com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
```

---

#### Padrão PUT com Auditoria

```typescript
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...dadosAtualizacao } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    // Buscar registro existente (para auditoria)
    const { data: registroExistente } = await supabase
      .from('tabela')
      .select('*')
      .eq('id', id)
      .single();

    // Verificar se está travado
    if (registroExistente?.travado) {
      return NextResponse.json(
        { error: 'Registro travado. Destrave antes de editar.' },
        { status: 403 }
      );
    }

    // Atualizar
    const userId = request.headers.get('x-user-id');
    const userIdInt = userId ? parseInt(userId) : null;

    const { data: registroAtualizado, error } = await supabase
      .from('tabela')
      .update({
        ...dadosAtualizacao,
        updated_at: new Date().toISOString(),
        updated_by: userIdInt
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar registro' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: registroAtualizado,
      message: 'Registro atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
```

---

#### Padrão DELETE

```typescript
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    // Soft delete (preferido)
    const { error } = await supabase
      .from('tabela')
      .update({ 
        deletado: true,
        deletado_em: new Date().toISOString()
      })
      .eq('id', id);

    // Hard delete (usar com cuidado)
    // const { error } = await supabase
    //   .from('tabela')
    //   .delete()
    //   .eq('id', id);

    if (error) {
      console.error('Erro ao deletar:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar registro' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Registro deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
```

---

### Edge Functions (Supabase/Deno)

#### Padrão Dispatcher

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatcherRequest {
  action: string;
  bar_id?: number;
  params?: Record<string, any>;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: DispatcherRequest = await req.json();
    const { action, bar_id = 3, params } = body;

    console.log(`🚀 Dispatcher - Action: ${action}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let resultado;

    // Router de actions
    switch (action) {
      case 'acao-1':
        resultado = await executarAcao1(supabase, bar_id, params);
        break;
      
      case 'acao-2':
        resultado = await executarAcao2(supabase, bar_id, params);
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: `Action não encontrada: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: resultado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no dispatcher:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executarAcao1(supabase: any, barId: number, params: any) {
  // Lógica da ação 1
  const { data } = await supabase
    .from('tabela')
    .select('*')
    .eq('bar_id', barId);
  
  return data;
}

async function executarAcao2(supabase: any, barId: number, params: any) {
  // Lógica da ação 2
  return { message: 'Ação 2 executada' };
}
```

---

#### Padrão com Módulos Compartilhados

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendDiscordEmbed, createInfoEmbed } from '../_shared/discord-notifier.ts';
import { formatarMoeda, formatarPercentual } from '../_shared/formatters.ts';
import { buscarEventosPeriodo } from '../_shared/eventos-data.ts';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar dados usando módulo compartilhado
    const eventos = await buscarEventosPeriodo(
      supabase,
      3, // bar_id
      '2026-01-01',
      '2026-01-31'
    );

    // Calcular métricas
    const faturamentoTotal = eventos.reduce((acc, e) => acc + (e.real_r || 0), 0);

    // Enviar notificação usando módulo compartilhado
    await sendDiscordEmbed(
      Deno.env.get('DISCORD_WEBHOOK_URL')!,
      createInfoEmbed(
        'Relatório Mensal',
        `Faturamento: ${formatarMoeda(faturamentoTotal)}`
      )
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

---

### Componentes React

#### Padrão de Página com Loading

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import UnifiedLoading from '@/components/layouts/unified-loading';

interface Dados {
  id: number;
  nome: string;
  valor: number;
}

export default function PaginaExemplo() {
  const [dados, setDados] = useState<Dados[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/endpoint?bar_id=3');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao carregar dados');
      }

      setDados(result.data || []);
    } catch (err: any) {
      console.error('Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <UnifiedLoading type="dashboard" />;
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">Erro: {error}</p>
            <Button onClick={carregarDados} className="mt-4">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Título da Página</CardTitle>
        </CardHeader>
        <CardContent>
          {dados.length === 0 ? (
            <p className="text-muted-foreground">Nenhum dado encontrado</p>
          ) : (
            <div className="space-y-2">
              {dados.map((item) => (
                <div key={item.id} className="p-4 border rounded">
                  <h3>{item.nome}</h3>
                  <p>R$ {item.valor.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

#### Padrão de Formulário

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function FormularioExemplo() {
  const [formData, setFormData] = useState({
    nome: '',
    valor: 0,
  });
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      setSalvando(true);

      const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: 3,
          ...formData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar');
      }

      toast.success('Salvo com sucesso!');
      
      // Resetar formulário
      setFormData({ nome: '', valor: 0 });

    } catch (err: any) {
      console.error('Erro:', err);
      toast.error(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder="Digite o nome"
          disabled={salvando}
        />
      </div>

      <div>
        <Label htmlFor="valor">Valor</Label>
        <Input
          id="valor"
          type="number"
          value={formData.valor}
          onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) })}
          placeholder="0.00"
          disabled={salvando}
        />
      </div>

      <Button type="submit" disabled={salvando}>
        {salvando ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  );
}
```

---

### Utilitários Comuns

#### Formatação de Valores

```typescript
// lib/formatters.ts

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

export function formatarPercentual(valor: number, casasDecimais: number = 1): string {
  return `${valor.toFixed(casasDecimais)}%`;
}

export function formatarData(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return d.toLocaleDateString('pt-BR');
}

export function formatarDiaSemana(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dias[d.getDay()];
}

export function formatarNumero(valor: number, casasDecimais: number = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais
  }).format(valor);
}
```

---

#### Cliente Supabase

```typescript
// lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

export async function getSupabaseClient() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Variáveis de ambiente do Supabase não configuradas');
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Erro ao criar cliente Supabase:', error);
    return null;
  }
}

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}
```

---

### Padrões de Nomenclatura

**Arquivos**:
- APIs: `route.ts` (Next.js App Router)
- Páginas: `page.tsx`
- Componentes: `PascalCase.tsx`
- Utilitários: `kebab-case.ts`
- Edge Functions: `index.ts`

**Variáveis**:
- Componentes React: `PascalCase`
- Funções: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Interfaces/Types: `PascalCase`

**Banco de Dados**:
- Tabelas: `snake_case`
- Colunas: `snake_case`
- Views: `vw_nome_view`
- Functions: `snake_case`

---

## 🔍 QUERIES ÚTEIS

### Eventos e Faturamento

#### Buscar eventos do mês com faturamento

```sql
SELECT 
  id,
  data_evento,
  dia_semana,
  artista,
  real_r as faturamento,
  cl_real as publico,
  t_medio as ticket_medio,
  percent_stockout as stockout_perc
FROM eventos_base
WHERE bar_id = 3
  AND data_evento BETWEEN '2026-01-01' AND '2026-01-31'
  AND real_r > 1000  -- Ignorar dias fechados
ORDER BY data_evento DESC;
```

---

#### Média por dia da semana

```sql
SELECT 
  dia_semana,
  COUNT(*) as total_eventos,
  AVG(real_r) as media_faturamento,
  AVG(cl_real) as media_publico,
  AVG(t_medio) as media_ticket
FROM eventos_base
WHERE bar_id = 3
  AND real_r > 1000
  AND data_evento >= '2025-01-01'
GROUP BY dia_semana
ORDER BY 
  CASE dia_semana
    WHEN 'Domingo' THEN 1
    WHEN 'Segunda' THEN 2
    WHEN 'Terça' THEN 3
    WHEN 'Quarta' THEN 4
    WHEN 'Quinta' THEN 5
    WHEN 'Sexta' THEN 6
    WHEN 'Sábado' THEN 7
  END;
```

---

#### Top 10 dias de maior faturamento

```sql
SELECT 
  data_evento,
  dia_semana,
  artista,
  real_r as faturamento,
  cl_real as publico,
  t_medio as ticket_medio
FROM eventos_base
WHERE bar_id = 3
  AND real_r > 1000
ORDER BY real_r DESC
LIMIT 10;
```

---

#### Comparar mês atual vs mês anterior

```sql
WITH mes_atual AS (
  SELECT 
    SUM(real_r) as faturamento,
    SUM(cl_real) as publico,
    COUNT(*) as dias_operacao
  FROM eventos_base
  WHERE bar_id = 3
    AND data_evento >= DATE_TRUNC('month', CURRENT_DATE)
    AND real_r > 1000
),
mes_anterior AS (
  SELECT 
    SUM(real_r) as faturamento,
    SUM(cl_real) as publico,
    COUNT(*) as dias_operacao
  FROM eventos_base
  WHERE bar_id = 3
    AND data_evento >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND data_evento < DATE_TRUNC('month', CURRENT_DATE)
    AND real_r > 1000
)
SELECT 
  ma.faturamento as faturamento_atual,
  mp.faturamento as faturamento_anterior,
  ((ma.faturamento - mp.faturamento) / mp.faturamento * 100) as variacao_percentual,
  ma.publico as publico_atual,
  mp.publico as publico_anterior,
  ma.dias_operacao as dias_atual,
  mp.dias_operacao as dias_anterior
FROM mes_atual ma, mes_anterior mp;
```

---

### Produtos e Vendas

#### Top 10 produtos mais vendidos

```sql
SELECT 
  prd_desc as produto,
  grp_desc as grupo,
  SUM(qtd) as quantidade_total,
  SUM(valorfinal) as faturamento_total,
  AVG(valorfinal / NULLIF(qtd, 0)) as preco_medio
FROM contahub_analitico
WHERE bar_id = 3
  AND trn_dtgerencial BETWEEN '2026-01-01' AND '2026-01-31'
  AND prd_desc NOT LIKE '[HH]%'  -- Excluir Happy Hour
  AND prd_desc NOT LIKE '[DD]%'  -- Excluir Dose Dupla
  AND prd_desc NOT LIKE '[IN]%'  -- Excluir Insumos
GROUP BY prd_desc, grp_desc
ORDER BY faturamento_total DESC
LIMIT 10;
```

---

#### Produtos com maior margem (estimada)

```sql
SELECT 
  prd_desc as produto,
  SUM(qtd) as qtd_vendida,
  SUM(valorfinal) as faturamento,
  SUM(custo * qtd) as custo_total,
  SUM(valorfinal) - SUM(custo * qtd) as margem_bruta,
  ((SUM(valorfinal) - SUM(custo * qtd)) / NULLIF(SUM(valorfinal), 0) * 100) as margem_percentual
FROM contahub_analitico
WHERE bar_id = 3
  AND trn_dtgerencial BETWEEN '2026-01-01' AND '2026-01-31'
  AND custo > 0
GROUP BY prd_desc
HAVING SUM(valorfinal) > 1000  -- Apenas produtos relevantes
ORDER BY margem_bruta DESC
LIMIT 20;
```

---

#### Produtos mais cancelados

```sql
SELECT 
  prd_desc as produto,
  COUNT(*) as total_cancelamentos,
  SUM(valorfinal) as valor_cancelado
FROM contahub_analitico
WHERE bar_id = 3
  AND trn_dtgerencial BETWEEN '2026-01-01' AND '2026-01-31'
  AND tipo = 'CANCELAMENTO'
GROUP BY prd_desc
ORDER BY total_cancelamentos DESC
LIMIT 20;
```

---

### CMV e Custos

#### CMV das últimas 4 semanas

```sql
SELECT 
  ano,
  semana,
  data_inicio,
  data_fim,
  vendas_liquidas as faturamento,
  cmv_calculado,
  cmv_limpo_percentual,
  cmv_teorico_percentual,
  gap,
  cma_total
FROM cmv_semanal
WHERE bar_id = 3
  AND ano = 2026
ORDER BY semana DESC
LIMIT 4;
```

---

#### CMV por categoria (bebidas, comida, drinks)

```sql
SELECT 
  semana,
  data_inicio,
  cmv_bebidas,
  cmv_alimentos,
  cmv_descartaveis,
  cmv_outros,
  cmv_calculado as cmv_total
FROM cmv_semanal
WHERE bar_id = 3
  AND ano = 2026
ORDER BY semana DESC;
```

---

#### Evolução do CMV (últimos 6 meses)

```sql
SELECT 
  TO_CHAR(data_inicio, 'YYYY-MM') as mes,
  AVG(cmv_limpo_percentual) as cmv_medio,
  MIN(cmv_limpo_percentual) as cmv_minimo,
  MAX(cmv_limpo_percentual) as cmv_maximo
FROM cmv_semanal
WHERE bar_id = 3
  AND data_inicio >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY TO_CHAR(data_inicio, 'YYYY-MM')
ORDER BY mes DESC;
```

---

### CMO e Mão de Obra

#### CMO das últimas semanas

```sql
SELECT 
  cs.ano,
  cs.semana,
  cs.data_inicio,
  cs.data_fim,
  cs.freelas,
  cs.fixos_total,
  cs.cma_alimentacao,
  cs.pro_labore_semanal,
  cs.cmo_total,
  cs.meta_cmo,
  cs.acima_meta,
  COUNT(csf.id) as total_funcionarios
FROM cmo_semanal cs
LEFT JOIN cmo_simulacao_funcionarios csf ON cs.id = csf.cmo_semanal_id
WHERE cs.bar_id = 3
  AND cs.ano = 2026
GROUP BY cs.id
ORDER BY cs.semana DESC
LIMIT 4;
```

---

#### Funcionários por área (última semana)

```sql
SELECT 
  csf.area,
  COUNT(*) as total_funcionarios,
  SUM(csf.custo_semanal) as custo_total_area,
  AVG(csf.custo_semanal) as custo_medio_funcionario
FROM cmo_semanal cs
JOIN cmo_simulacao_funcionarios csf ON cs.id = csf.cmo_semanal_id
WHERE cs.bar_id = 3
  AND cs.ano = 2026
  AND cs.semana = (
    SELECT MAX(semana) FROM cmo_semanal WHERE bar_id = 3 AND ano = 2026
  )
GROUP BY csf.area
ORDER BY custo_total_area DESC;
```

---

### Financeiro (NIBO)

#### Contas a pagar vencidas

```sql
SELECT 
  id,
  titulo,
  descricao,
  categoria_nome,
  stakeholder_nome,
  valor,
  data_vencimento,
  CURRENT_DATE - data_vencimento as dias_atraso
FROM nibo_agendamentos
WHERE bar_id = 3
  AND tipo = 'pagar'
  AND status IN ('aberto', 'vencido')
  AND data_vencimento < CURRENT_DATE
  AND deletado = false
ORDER BY data_vencimento ASC;
```

---

#### Despesas por categoria (mês)

```sql
SELECT 
  categoria_nome,
  COUNT(*) as total_lancamentos,
  SUM(valor) as total_categoria
FROM nibo_agendamentos
WHERE bar_id = 3
  AND tipo = 'pagar'
  AND status = 'pago'
  AND data_pagamento BETWEEN '2026-01-01' AND '2026-01-31'
  AND deletado = false
GROUP BY categoria_nome
ORDER BY total_categoria DESC;
```

---

#### Fluxo de caixa projetado (próximos 30 dias)

```sql
WITH receber AS (
  SELECT 
    data_vencimento,
    SUM(valor) as valor_receber
  FROM nibo_agendamentos
  WHERE bar_id = 3
    AND tipo = 'receber'
    AND status = 'aberto'
    AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND deletado = false
  GROUP BY data_vencimento
),
pagar AS (
  SELECT 
    data_vencimento,
    SUM(valor) as valor_pagar
  FROM nibo_agendamentos
  WHERE bar_id = 3
    AND tipo = 'pagar'
    AND status = 'aberto'
    AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND deletado = false
  GROUP BY data_vencimento
)
SELECT 
  COALESCE(r.data_vencimento, p.data_vencimento) as data,
  COALESCE(r.valor_receber, 0) as a_receber,
  COALESCE(p.valor_pagar, 0) as a_pagar,
  COALESCE(r.valor_receber, 0) - COALESCE(p.valor_pagar, 0) as saldo_dia
FROM receber r
FULL OUTER JOIN pagar p ON r.data_vencimento = p.data_vencimento
ORDER BY data ASC;
```

---

### Análises Avançadas

#### Correlação faturamento x dia da semana x artista

```sql
SELECT 
  dia_semana,
  genero,
  COUNT(*) as total_eventos,
  AVG(real_r) as media_faturamento,
  AVG(cl_real) as media_publico,
  AVG(t_medio) as media_ticket
FROM eventos_base
WHERE bar_id = 3
  AND real_r > 1000
  AND data_evento >= '2025-01-01'
GROUP BY dia_semana, genero
HAVING COUNT(*) >= 3  -- Apenas com amostra significativa
ORDER BY media_faturamento DESC;
```

---

#### Detecção de anomalias (faturamento)

```sql
WITH stats AS (
  SELECT 
    AVG(real_r) as media,
    STDDEV(real_r) as desvio_padrao
  FROM eventos_base
  WHERE bar_id = 3
    AND real_r > 1000
    AND data_evento >= CURRENT_DATE - INTERVAL '90 days'
)
SELECT 
  e.data_evento,
  e.dia_semana,
  e.artista,
  e.real_r as faturamento,
  s.media,
  s.desvio_padrao,
  (e.real_r - s.media) / NULLIF(s.desvio_padrao, 0) as z_score,
  CASE 
    WHEN ABS((e.real_r - s.media) / NULLIF(s.desvio_padrao, 0)) > 2 THEN 'ANOMALIA'
    ELSE 'NORMAL'
  END as classificacao
FROM eventos_base e, stats s
WHERE e.bar_id = 3
  AND e.real_r > 1000
  AND e.data_evento >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ABS((e.real_r - s.media) / NULLIF(s.desvio_padrao, 0)) DESC;
```

---

#### Análise de retenção de clientes

```sql
SELECT 
  DATE_TRUNC('month', data_evento) as mes,
  COUNT(DISTINCT cl_real) as clientes_unicos,
  -- Clientes que voltaram no mês seguinte
  COUNT(DISTINCT CASE 
    WHEN EXISTS (
      SELECT 1 FROM eventos_base e2 
      WHERE e2.bar_id = eventos_base.bar_id 
        AND e2.data_evento BETWEEN eventos_base.data_evento + INTERVAL '1 month' 
        AND eventos_base.data_evento + INTERVAL '2 months'
    ) THEN cl_real 
  END) as clientes_retornaram
FROM eventos_base
WHERE bar_id = 3
  AND real_r > 1000
  AND data_evento >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', data_evento)
ORDER BY mes DESC;
```

---

## OTIMIZAÇÕES RECENTES (25-26/02/2026)

### 0. ContaHub - Correção Stockout e Automação Completa ✅ (26/02/2026)

**Problema Identificado**:
- Cron `contahub-sync` não rodou em 26/02 para dados de 25/02
- `eventos_base` não estava atualizando após coleta do ContaHub
- % stockout estava em 23% (esperado: ~9%)
- Produtos com prefixos [HH], [DD], [IN] não estavam sendo excluídos

**Soluções Implementadas**:

**1. Refatoração `contahub-sync`** ✅
- Moveu toda lógica de coleta para dentro da função
- Removeu dependência de funções deletadas
- Implementou coleta diária automática às 07:00 BRT
- Adicionou coleta de: faturamento, PAX, tickets, produtos, stockout, marketing

**2. Correção Cálculo Stockout** ✅
- **Edge Function** (`contahub-stockout-sync`):
  - Filtra produtos ANTES de salvar no banco
  - Exclui prefixos: `[HH]` (Happy Hour), `[DD]` (Dose Dupla), `[IN]` (Insumos)
  - Calcula estatísticas já com produtos filtrados
- **Database Function** (`update_eventos_base_from_contahub_batch`):
  - Atualiza query SQL para excluir produtos com prefixos
  - Usa `prd_desc NOT LIKE '[HH]%'`, `NOT LIKE '[DD]%'`, `NOT LIKE '[IN]%'`
- **Resultado**: % stockout corrigido de 23% para 8.55%

**3. Automação 100% do Pipeline** ✅
- `contahub-sync` (07:00) → coleta dados brutos
- `contahub-processor` (07:15) → processa dados
- `update_eventos_base_from_contahub_batch` (07:30) → atualiza eventos_base
- Pipeline totalmente automático sem intervenção manual

**Arquivos Modificados**:
- `backend/supabase/functions/contahub-sync/index.ts` - Refatoração completa
- `backend/supabase/functions/contahub-stockout-sync/index.ts` - Filtros de exclusão
- `database/functions/update_eventos_base_from_contahub_batch.sql` - Query otimizada

**Benefícios**:
- Dados sempre atualizados automaticamente
- Métricas de stockout precisas
- Banco de dados limpo (sem produtos irrelevantes)
- Confiabilidade do pipeline aumentada

---

## SISTEMA CMO E CMA (26/02/2026)

### CMA - Custo de Alimentação de Funcionários ✅

**Fórmula**: `CMA = Estoque Inicial + Compras - Estoque Final`

**Implementação**:
- ✅ Página dedicada: `/ferramentas/cma-semanal`
- ✅ Seção na tabela CMV: "CMA - ALIMENTAÇÃO FUNCIONÁRIOS"
- ✅ API: `GET /api/cmv-semanal/buscar-cma`
- ✅ Campos no banco: `estoque_inicial_funcionarios`, `compras_alimentacao`, `estoque_final_funcionarios`, `cma_total`

**Categorias de Estoque (Funcionários)**:
- HORTIFRUTI (F)
- MERCADO (F)
- PROTEÍNA (F)

**Compras**:
- Categoria NIBO: "Alimentação"

**Cálculo Automático**:
- Estoque Inicial: Busca na `data_inicio` da semana
- Compras: Soma da categoria "Alimentação" do NIBO no período
- Estoque Final: Busca na segunda-feira seguinte à `data_fim`

---

### CMO - Custo de Mão de Obra Semanal ✅

**Fórmula**: `CMO = Freelas + Fixos + Alimentação + Pro Labore`

**Componentes**:

**1. Freelas** (Automático via NIBO)
- Soma de todas as categorias contendo "FREELA" (case-insensitive)
- Busca automática via `GET /api/cmo-semanal/buscar-automatico`

**2. Fixos** (Simulação Dinâmica)
- Simulador de funcionários CLT/PJ
- Campos por funcionário:
  - Nome, Tipo (CLT/PJ), Área
  - Salário Bruto, Vale Transporte
  - Adicional, Aviso Prévio
  - Dias Trabalhados (1-7)
- Cálculos automáticos:
  - **CLT**: FGTS (8%), INSS (20%), Produtividade (8.33%)
  - **PJ**: Sem encargos
  - Custo semanal proporcional aos dias trabalhados
- Biblioteca: `lib/calculos-folha.ts`

**3. Alimentação** (CMA)
- Puxado automaticamente da tabela `cmv_semanal`
- Campo: `cma_total`

**4. Pro Labore** (Manual)
- Input mensal (ex: R$ 30.000)
- Cálculo semanal: `(Valor / 30) * 7`

---

### Funcionalidades Implementadas

**1. Página Principal** (`/ferramentas/cmo-semanal`)
- ✅ Seletor de semana/ano
- ✅ Busca automática de Freelas e CMA
- ✅ Simulador dinâmico de funcionários (adicionar/remover/editar)
- ✅ Campo de Meta CMO
- ✅ Cálculo automático do CMO Total
- ✅ Salvar/Travar simulação
- ✅ Alerta visual quando CMO > Meta
- ✅ Auditoria completa (created_by, updated_by, travado_por)

**2. Dashboard CMO** (`/ferramentas/cmo-semanal/dashboard`)
- ✅ **KPIs**:
  - CMO Médio (média de todas as semanas)
  - Tendência (subindo/descendo/estável)
  - Aderência à Meta (% de semanas dentro da meta)
  - Última Semana (valor + nº funcionários)
- ✅ **Gráficos**:
  - Evolução do CMO (AreaChart com linha de meta)
  - Composição do CMO (BarChart empilhado)
  - Evolução da Equipe (LineChart)
- ✅ **Análises**:
  - Média por componente
  - Distribuição percentual
  - Alertas de semanas acima da meta

**3. Comparação de Simulações** (`/ferramentas/cmo-semanal/comparar`)
- ✅ Seleção de 2 semanas quaisquer
- ✅ Comparação lado a lado:
  - CMO Total (variação % e R$)
  - Freelas, Fixos, Alimentação, Pro Labore
  - Número de funcionários
- ✅ Identificação de funcionários novos/removidos
- ✅ Badges visuais (NOVO em verde, REMOVIDO em vermelho)
- ✅ Resumo da diferença total

**4. Sistema de Alertas** (`/ferramentas/cmo-semanal/alertas`)
- ✅ Verificação automática de CMO > Meta
- ✅ Criação automática de alertas
- ✅ Listagem (todos/pendentes/enviados)
- ✅ Marcar como enviado
- ✅ Detalhes: valor, meta, diferença, variação %
- ✅ Link direto para a semana específica
- ✅ Cards visuais com cores (vermelho/verde)

**5. Histórico** (`/ferramentas/cmo-semanal/historico`)
- ✅ Lista de todas as simulações
- ✅ Filtro por ano
- ✅ Variação percentual vs semana anterior
- ✅ Informações de auditoria (criado por, atualizado por, travado por)
- ✅ Link para detalhes da semana

---

### Estrutura de Banco de Dados

**Tabelas Criadas**:

```sql
-- CMO Semanal (principal)
CREATE TABLE cmo_semanal (
  id UUID PRIMARY KEY,
  bar_id INTEGER REFERENCES bars(id),
  ano INTEGER,
  semana INTEGER,
  data_inicio DATE,
  data_fim DATE,
  freelas NUMERIC(10,2),
  fixos_total NUMERIC(10,2),
  cma_alimentacao NUMERIC(10,2),
  pro_labore_mensal NUMERIC(10,2),
  pro_labore_semanal NUMERIC(10,2),
  cmo_total NUMERIC(10,2),
  simulacao_salva BOOLEAN,
  meta_cmo NUMERIC(10,2),
  acima_meta BOOLEAN GENERATED ALWAYS AS (cmo_total > COALESCE(meta_cmo, 999999)) STORED,
  alerta_enviado BOOLEAN,
  alerta_enviado_em TIMESTAMP,
  created_by INTEGER REFERENCES usuarios_bar(id),
  updated_by INTEGER REFERENCES usuarios_bar(id),
  travado_por INTEGER REFERENCES usuarios_bar(id),
  travado_em TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(bar_id, ano, semana)
);

-- Simulação de Funcionários
CREATE TABLE cmo_simulacao_funcionarios (
  id UUID PRIMARY KEY,
  cmo_semanal_id UUID REFERENCES cmo_semanal(id) ON DELETE CASCADE,
  funcionario_nome VARCHAR(255),
  tipo_contratacao VARCHAR(10) CHECK (tipo_contratacao IN ('CLT', 'PJ')),
  area VARCHAR(100),
  vale_transporte NUMERIC(10,2),
  salario_bruto NUMERIC(10,2),
  adicional NUMERIC(10,2),
  adicional_aviso_previo NUMERIC(10,2),
  dias_trabalhados INTEGER,
  salario_liquido NUMERIC(10,2),
  adicionais_total NUMERIC(10,2),
  aviso_previo NUMERIC(10,2),
  custo_empresa NUMERIC(10,2),
  custo_total NUMERIC(10,2),
  custo_semanal NUMERIC(10,2),
  calculo_detalhado JSONB,
  created_at TIMESTAMP
);

-- Alertas CMO
CREATE TABLE cmo_alertas (
  id UUID PRIMARY KEY,
  cmo_semanal_id UUID REFERENCES cmo_semanal(id) ON DELETE CASCADE,
  bar_id INTEGER REFERENCES bars(id),
  tipo_alerta VARCHAR(50),
  mensagem TEXT,
  valor_cmo NUMERIC(10,2),
  valor_meta NUMERIC(10,2),
  diferenca NUMERIC(10,2),
  percentual_diferenca NUMERIC(5,2),
  enviado BOOLEAN DEFAULT FALSE,
  enviado_em TIMESTAMP,
  created_at TIMESTAMP
);

-- Metas CMO
CREATE TABLE cmo_metas (
  id UUID PRIMARY KEY,
  bar_id INTEGER REFERENCES bars(id),
  ano INTEGER,
  mes INTEGER,
  meta_cmo_semanal NUMERIC(10,2),
  meta_cmo_percentual NUMERIC(5,2),
  observacoes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(bar_id, ano, mes)
);

-- View de Histórico
CREATE VIEW vw_cmo_historico AS
SELECT 
  cs.*,
  ub_created.nome as created_by_nome,
  ub_updated.nome as updated_by_nome,
  ub_travado.nome as travado_by_nome,
  b.nome as bar_nome
FROM cmo_semanal cs
LEFT JOIN usuarios_bar ub_created ON cs.created_by = ub_created.id
LEFT JOIN usuarios_bar ub_updated ON cs.updated_by = ub_updated.id
LEFT JOIN usuarios_bar ub_travado ON cs.travado_por = ub_travado.id
LEFT JOIN bars b ON cs.bar_id = b.id;
```

**Campos CMA em cmv_semanal**:
```sql
ALTER TABLE cmv_semanal
ADD COLUMN estoque_inicial_funcionarios NUMERIC(10,2),
ADD COLUMN compras_alimentacao NUMERIC(10,2),
ADD COLUMN estoque_final_funcionarios NUMERIC(10,2),
ADD COLUMN cma_total NUMERIC(10,2);
```

---

### APIs Criadas

**CMO**:
- `GET /api/cmo-semanal` - Buscar CMO por bar/ano/semana
- `POST /api/cmo-semanal` - Criar nova simulação
- `PUT /api/cmo-semanal` - Atualizar simulação existente
- `PATCH /api/cmo-semanal/[id]/travar` - Travar/destravar simulação
- `GET /api/cmo-semanal/buscar-automatico` - Buscar Freelas + CMA automaticamente
- `GET /api/cmo-semanal/detalhes` - Buscar detalhes completos (com funcionários)
- `GET /api/cmo-semanal/historico` - Listar histórico de simulações

**Alertas**:
- `GET /api/cmo-semanal/alertas` - Listar alertas
- `POST /api/cmo-semanal/alertas` - Criar alerta
- `PATCH /api/cmo-semanal/alertas` - Marcar como enviado
- `POST /api/cmo-semanal/verificar-alertas` - Verificar e criar alertas automaticamente

**CMA**:
- `GET /api/cmv-semanal/buscar-cma` - Buscar dados CMA
- Integrado em: `GET /api/cmv-semanal/buscar-dados-automaticos`

---

### Arquivos Criados (21 novos)

**Frontend - Páginas**:
1. `src/app/ferramentas/cmo-semanal/page.tsx` - Página principal
2. `src/app/ferramentas/cmo-semanal/dashboard/page.tsx` - Dashboard
3. `src/app/ferramentas/cmo-semanal/comparar/page.tsx` - Comparação
4. `src/app/ferramentas/cmo-semanal/alertas/page.tsx` - Alertas
5. `src/app/ferramentas/cmo-semanal/historico/page.tsx` - Histórico
6. `src/app/ferramentas/cma-semanal/page.tsx` - CMA

**Frontend - APIs**:
7. `src/app/api/cmo-semanal/route.ts` - CRUD CMO
8. `src/app/api/cmo-semanal/[id]/travar/route.ts` - Lock/Unlock
9. `src/app/api/cmo-semanal/buscar-automatico/route.ts` - Busca automática
10. `src/app/api/cmo-semanal/detalhes/route.ts` - Detalhes
11. `src/app/api/cmo-semanal/historico/route.ts` - Histórico
12. `src/app/api/cmo-semanal/alertas/route.ts` - Alertas CRUD
13. `src/app/api/cmo-semanal/verificar-alertas/route.ts` - Verificação
14. `src/app/api/cmv-semanal/buscar-cma/route.ts` - CMA

**Frontend - Biblioteca**:
15. `src/lib/calculos-folha.ts` - Lógica de cálculos CLT/PJ

**Arquivos Modificados**:
16. `src/app/api/cmv-semanal/buscar-dados-automaticos/route.ts` - Integração CMA
17. `src/app/api/cmv-semanal/mensal/route.ts` - Agregação CMA
18. `src/app/ferramentas/cmv-semanal/tabela/page.tsx` - Seção CMA
19. `src/components/layouts/ModernSidebarOptimized.tsx` - Menu
20. `src/lib/menu-config.ts` - Configuração menu
21. `backend/supabase/functions/contahub-sync/index.ts` - Atualização

---

### Menu Lateral Atualizado

**Ferramentas**:
- 🍽️ CMA - Alimentação
- 👥 CMO Semanal
- 📊 CMO - Dashboard
- 🔄 CMO - Comparar
- 🔔 CMO - Alertas

---

### Benefícios do Sistema CMO/CMA

1. **Visibilidade Total**: Acompanhamento semanal de todos os custos de mão de obra
2. **Simulação Flexível**: Adicionar/remover funcionários e ver impacto imediato
3. **Alertas Proativos**: Notificação automática quando CMO ultrapassa meta
4. **Comparação Histórica**: Identificar tendências e variações semana a semana
5. **Auditoria Completa**: Rastreabilidade de todas as mudanças
6. **Cálculos Precisos**: Lógica CLT/PJ com FGTS, INSS e produtividade
7. **Dashboard Visual**: Gráficos de evolução e composição
8. **Integração Automática**: Freelas do NIBO e CMA do CMV

---

### Commit de Deploy

**Hash**: `af3d16d7`  
**Mensagem**: "feat: Implementar sistema completo de CMO (Custo de Mao de Obra)"  
**Data**: 26/02/2026 19:30 BRT  
**Arquivos**: 21 arquivos (+4504 linhas)

### 1. Consolidação de Edge Functions ✅

**Redução**: 68 → 38 Edge Functions (-44%)

**Ações**:
- ✅ 8 dispatchers criados (agente, alertas, integracao, contahub, google-sheets, discord, sync, webhook)
- ✅ 45 Edge Functions individuais removidas
- ✅ 8 módulos compartilhados criados
- ✅ 23 cron jobs migrados para dispatchers
- ✅ 7 bugs críticos corrigidos (tokens, tipos, colunas)

**Benefícios**:
- Menos cold starts
- Código compartilhado
- Manutenção centralizada
- Arquitetura mais limpa

### 2. Limpeza de Database Functions ✅

**Redução**: 245 → 61 Database Functions (-75%)

**Ações**:
- ✅ 184 funções obsoletas removidas
- ✅ 28 funções `update_*_updated_at` → 1 função genérica `update_updated_at_generic()`
- ✅ Triggers unificados
- ✅ Código duplicado eliminado

### 3. Limpeza de Cron Jobs ✅

**Redução**: 57 → 27 Cron Jobs (-53%)

**Ações**:
- ✅ 23 cron jobs obsoletos removidos
- ✅ 13 cron jobs migrados para dispatchers
- ✅ Tokens corrigidos (ANON → SERVICE_ROLE)
- ✅ Casts de tipos corrigidos

### 4. Otimização Frontend ✅

**Nova UI - Planejamento Comercial** ✅ (26/02/2026)
- ✅ **Grupos Colapsáveis**: Métricas organizadas em 3 grupos (Clientes, Ticket, Análises)
- ✅ **Botões Expandir/Recolher**: Controle individual e geral de expansão
- ✅ **Nomes Completos**: Exibe nomes completos das colunas (ex: "Clientes Presentes" ao invés de "Cl.P")
- ✅ **Coluna Artista**: Nova coluna após "Dia" mostrando nome da atração
- ✅ **Alinhamento Perfeito**: Larguras fixas (width, minWidth, maxWidth) em todos os elementos
- ✅ **Tabela Unificada**: Header e body em tabela única com sticky header
- ✅ **Ícones e Cores**: Cada grupo com ícone e cor distintos (azul=Clientes, roxo=Ticket, laranja=Análises)
- ✅ **Responsividade**: Layout adaptável mantendo alinhamento em todos os estados

**Larguras Fixas Implementadas**:
- Data: 90px
- Dia: 65px
- Artista: 300px
- Receita Real / Meta M1: 130px
- Clientes (expandido): 100px cada
- Ticket (expandido): 110px cada
- Análises (expandido): 110px (Cost), 90px (Percent), 105px (Time)
- Ações: 120px

**Páginas Duplicadas Removidas**:
- ❌ `planejamento-comercial/page-excel.tsx`
- ❌ `planejamento-comercial/page-simple.tsx`
- ❌ `planejamento-comercial/page-simple-test.tsx`
- ❌ `orcamentacao/page-dre.tsx`
- ❌ `desempenho/page-invertida.tsx`
- ❌ Pasta `gestao/` completa (duplicatas)

**Total**: 8 páginas antigas removidas (136 → 131 páginas)

**Componentes Loading Unificados**:
- ✅ 24 arquivos `loading.tsx` → 1 componente `unified-loading.tsx`
- ✅ 4 tipos: `dashboard`, `relatorio`, `visao-geral`, `configuracao`
- ✅ Manutenção centralizada

**Hooks Consolidados**:
- ❌ `useStaffAuth.ts` (não usado)
- ❌ `useMenuBadgesMock.ts` (apenas em demo)
- ❌ `DemoMenuBadges.tsx` (componente demo)

**Lazy Loading Implementado**:
- ✅ `lazy-motion.tsx` - Framer Motion lazy (~50KB economia)
- ✅ `lazy-charts.tsx` - Recharts lazy (~100KB economia)
- ✅ `lazy-components.tsx` - Componentes pesados lazy (~15KB economia)

**Total**: ~165KB de redução no bundle inicial

### 5. Otimização Completa do Banco de Dados ✅

**Segurança (RLS)**:
- ✅ 20 views `SECURITY DEFINER` removidas
- ✅ 291 políticas RLS ativas e seguras
- ✅ Multi-tenancy implementado (`user_has_access_to_bar`, `user_has_access_to_empresa`)
- ✅ Políticas consolidadas (removidas duplicatas)
- ✅ Materialized views protegidas
- ✅ Políticas com `USING (true)` corrigidas (12 tabelas)

**Performance (Índices)**:
- ✅ 70 índices criados para foreign keys sem cobertura
- ✅ 150+ índices não usados removidos
- ✅ Índices duplicados removidos
- ✅ Índices para queries lentas criados (sympla_participantes, contahub_analitico)

**Performance (RLS)**:
- ✅ `auth.uid()` e `auth.role()` otimizados com `(SELECT ...)` (18 tabelas)
- ✅ Políticas permissivas múltiplas consolidadas (4 tabelas)
- ✅ Auth RLS InitPlan otimizado

**Performance (Funções)**:
- ✅ 62 funções com `search_path = public, pg_temp`
- ✅ `auto_recalculo_eventos_pendentes` otimizada (1853ms → otimizado)

**Performance (Tabelas)**:
- ✅ VACUUM FULL em `eventos_base` (bloat removido)
- ✅ Autovacuum agressivo em 6 tabelas grandes (contahub_*)
- ✅ Tamanho total: 1.08 GB

**Estatísticas Finais**:
- **446 índices** otimizados
- **187 tabelas** com RLS
- **291 políticas RLS** ativas
- **62 funções** com search_path seguro
- **0 erros críticos** do Supabase Linter

### 6. Consolidação de Cards ✅

**Removidos**:
- ❌ `standard-card.tsx` (não usado)
- ❌ `unified-card.tsx` (não usado)

**Mantidos**:
- ✅ `card.tsx` - Card básico (shadcn/ui)
- ✅ `kpi-card.tsx` - Card de KPIs
- ✅ `dashboard-card.tsx` - Card completo

---

## SISTEMA DE EXPLORAÇÃO DIÁRIA AUTOMATIZADA (27/02/2026)

### Visão Geral ✅

**Status**: ✅ ATIVO E FUNCIONANDO  
**Data de Implementação**: 27/02/2026  
**Método de Automação**: Supabase Cron (pg_cron + http)

Sistema completo de exploração e análise automática de dados operacionais, executando diariamente análises profundas e gerando insights acionáveis.

---

### Plano de Exploração de 30 Dias ✅

**Arquivo**: `PLANEJAMENTO_EXPLORACAO_DIARIA.md`  
**Status**: ✅ EXECUTADO (30 dias em modo acelerado em 27/02/2026)

**Resultado**: 50+ insights gerados, 20+ ações recomendadas, documentação completa criada.

**Documentação Gerada**:
- `docs/exploracao-diaria/dia-01-auditoria-completa.md`
- `docs/exploracao-diaria/dia-02-correcao-dados.md`
- `docs/exploracao-diaria/dia-03-exploracao-faturamento.md`
- `docs/exploracao-diaria/dia-04-exploracao-produtos.md`
- `docs/exploracao-diaria/dia-05-a-30-resumo-acelerado.md`
- `docs/exploracao-diaria/RESUMO-EXECUTIVO-SEMANA-1.md`
- `docs/exploracao-diaria/RELATORIO-FINAL-30-DIAS.md`
- `docs/exploracao-diaria/DASHBOARD-EXECUTIVO.md`
- `docs/exploracao-diaria/APRESENTACAO-EXECUTIVA.md`
- `docs/exploracao-diaria/README.md`

---

### APIs de Exploração Criadas (9 novas rotas)

**1. Auditoria de Dados**:
- `GET /api/auditoria/completa` - Score de saúde dos dados (0-100)
  - Volume de dados por tabela
  - Cobertura de bares
  - Problemas de CMV (negativos, > 100%)
  - Estoque negativo
  - Valores nulos
  - Duplicações
  - Gaps temporais
  - Top 10 problemas críticos

- `POST /api/auditoria/corrigir-cmv` - Correção de CMV problemáticos
  - Recalcula CMV baseado em faturamento e custos
  - Flags de problemas (negativo, alto, impossível)
  - Ação: `analisar`, `recalcular`, `flaggar`

- `POST /api/auditoria/corrigir-publico` - Estimativa de público faltante
  - Usa média histórica de tickets por evento
  - Atualiza campo `cl_real` quando nulo

**2. Exploração de Faturamento**:
- `GET /api/exploracao/faturamento` - Análise completa de receita
  - Top 10 dias de maior faturamento
  - Média por dia da semana
  - Faturamento por hora (heatmap)
  - Comparação mensal (ano atual vs anterior)
  - Padrões sazonais (trimestres)

**3. Exploração de Produtos**:
- `GET /api/exploracao/produtos` - Análise de produtos
  - Top 10 produtos mais vendidos
  - Margem estimada (com % de custo hardcoded)
  - Produtos mais cancelados
  - Combos frequentes (produtos vendidos juntos)
  - Produtos com vendas decrescentes

**4. Exploração de CMV**:
- `GET /api/exploracao/cmv` - Análise de custos
  - CMV por dia da semana
  - Correlação CMV x Volume de vendas
  - Períodos de CMV alto
  - Anomalias de CMV (desvio padrão)

**5. Exploração de Equipe**:
- `GET /api/exploracao/equipe` - Performance operacional
  - Taxa de conclusão de checklists por funcionário
  - Horários problemáticos (atrasos)
  - Correlação checklist x faturamento

**6. Exploração de Eventos**:
- `GET /api/exploracao/eventos` - Análise de ROI de eventos
  - ROI por evento (receita / custo artístico)
  - Eventos mais lucrativos
  - Padrões pré/pós evento
  - Comparação de artistas similares

**7. Agente Diário Orquestrador**:
- `GET /api/exploracao/agente-diario` - Execução completa do pipeline
  - Orquestra todas as APIs de exploração
  - Detecta anomalias automáticas
  - Salva relatório diário no banco
  - Gera alertas quando necessário
  - Autenticação via `secret` (CRON_SECRET)

---

### Automação via Supabase Cron ✅

**Infraestrutura**:

**1. Tabela de Histórico**:
```sql
CREATE TABLE relatorios_diarios (
  id BIGSERIAL PRIMARY KEY,
  bar_id INTEGER REFERENCES bars(id),
  data_referencia DATE NOT NULL,
  score_saude NUMERIC(5,2),
  problemas JSONB DEFAULT '[]'::jsonb,
  alertas JSONB DEFAULT '[]'::jsonb,
  faturamento NUMERIC(12,2),
  publico INTEGER,
  ticket_medio NUMERIC(10,2),
  tempo_execucao_ms INTEGER,
  executado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bar_id, data_referencia)
);
```

**2. Extensões Instaladas**:
- `pg_cron` - Agendamento de tarefas
- `http` - Requisições HTTP

**3. Função de Execução**:
```sql
CREATE OR REPLACE FUNCTION executar_agente_diario() 
RETURNS void AS $$
DECLARE
  v_response http_response;
BEGIN
  SELECT * INTO v_response 
  FROM http_get('https://zykor.vercel.app/api/exploracao/agente-diario?secret=zykor-cron-secret-2026&bar_id=3');
  
  RAISE NOTICE 'Agente executado. Status: %', v_response.status;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**4. Cron Jobs Ativos**:

| Job ID | Frequência | Schedule | Descrição |
|--------|-----------|----------|-----------|
| **266** | Diário | `0 9 * * *` | Todo dia às 9h da manhã |
| **267** | Semanal | `0 10 * * 1` | Toda segunda às 10h |
| **268** | Mensal | `0 11 1 * *` | Dia 1 de cada mês às 11h |

**Configuração**:
```sql
SELECT cron.schedule('agente-exploracao-diario', '0 9 * * *', 
  $$SELECT executar_agente_diario();$$);
```

---

### O Que o Agente Faz Diariamente

**Pipeline de Execução** (9h da manhã):

1. **Auditoria Completa** (Score 0-100)
   - Verifica qualidade dos dados
   - Identifica problemas críticos
   - Calcula score de saúde

2. **Análise de Faturamento**
   - Top dias de receita
   - Médias por dia da semana
   - Padrões horários e sazonais

3. **Análise de Produtos**
   - Mais vendidos e margens
   - Produtos problemáticos
   - Combos frequentes

4. **Análise de CMV**
   - Custos por dia da semana
   - Correlações com volume
   - Anomalias detectadas

5. **Análise de Equipe**
   - Performance de checklists
   - Horários críticos
   - Impacto no faturamento

6. **Análise de Eventos**
   - ROI por evento
   - Eventos mais lucrativos
   - Comparações de artistas

7. **Detecção de Anomalias**
   - Faturamento muito baixo/alto
   - CMV anormal
   - Público atípico
   - Ticket médio fora do padrão

8. **Salvamento no Banco**
   - Histórico completo em `relatorios_diarios`
   - Métricas principais
   - Problemas e alertas em JSONB

---

### Insights Gerados (Exemplos)

**Críticos**:
- 🔴 CMV acima de 35% em 12 eventos
- 🔴 Estoque negativo em 8 produtos
- 🔴 23 eventos sem público registrado

**Oportunidades**:
- 💡 Sextas-feiras faturam 2.6x mais que terças
- 💡 Horário 21h-22h representa 35% do faturamento
- 💡 Eventos de Pagode têm ROI 40% maior que Samba
- 💡 Produtos combo aumentam ticket em 18%

**Operacionais**:
- ⚠️ Checklists atrasados em 15% dos dias
- ⚠️ Funcionário X tem 92% de conclusão vs 78% da média
- ⚠️ Horário 19h-20h tem mais atrasos operacionais

---

### Arquivos de Configuração

**Documentação**:
- `docs/automacao/README-AGENTE-DIARIO.md` - Guia completo
- `docs/automacao/SETUP-COMPLETO-MCP.md` - Setup via MCP
- `docs/automacao/CHECKLIST-FINAL-AUTOMACAO.md` - Checklist de validação
- `docs/automacao/setup-cron-completo.sql` - Script SQL completo

**Scripts**:
- `scripts/auditoria-completa.ts` - Script de auditoria standalone

---

### Variáveis de Ambiente

```env
# .env.local (desenvolvimento)
CRON_SECRET=zykor-cron-secret-2026
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Vercel (produção)
CRON_SECRET=zykor-cron-secret-2026
```

---

### Monitoramento e Logs

**Verificar Execuções**:
```sql
-- Ver histórico de relatórios
SELECT * FROM relatorios_diarios 
ORDER BY executado_em DESC 
LIMIT 10;

-- Ver logs do cron
SELECT * FROM cron.job_run_details 
WHERE jobid IN (266, 267, 268) 
ORDER BY start_time DESC 
LIMIT 10;

-- Ver cron jobs ativos
SELECT jobid, schedule, command, active 
FROM cron.job 
WHERE jobid IN (266, 267, 268);
```

**Testar Manualmente**:
```sql
-- Executar agente manualmente
SELECT executar_agente_diario();

-- Via API (com autenticação)
curl "https://zykor.vercel.app/api/exploracao/agente-diario?secret=zykor-cron-secret-2026&bar_id=3"
```

---

### Benefícios do Sistema

1. **Automação Total**: Zero intervenção manual necessária
2. **Visibilidade Diária**: Relatórios automáticos todas as manhãs
3. **Detecção Proativa**: Anomalias identificadas em tempo real
4. **Histórico Completo**: Base de dados para análises futuras
5. **Insights Acionáveis**: 50+ insights gerados no primeiro ciclo
6. **Escalabilidade**: Suporta múltiplos bares facilmente
7. **Confiabilidade**: Native Supabase Cron (sem custos extras)
8. **Rastreabilidade**: Logs completos de todas as execuções

---

### Commits de Deploy

**Commit 1**: `88ecaeba` (27/02/2026 11:30)
- feat: Implementar sistema completo de exploração diária automatizada
- 46 arquivos alterados (+8.947 linhas)
- 9 APIs criadas
- Documentação completa
- Automação via Supabase Cron

**Commit 2**: `ebbf4a84` (27/02/2026 11:45)
- fix: Corrigir erros de TypeScript nas APIs
- Tipos explícitos em arrays
- Type casting corrigido
- Variáveis não definidas corrigidas

---

### Próxima Execução

**Próxima execução automática**: 28/02/2026 às 9:00 AM 🚀

---

## INTEGRAÇÕES

### Integrações Ativas

| Sistema | Função | Status | Edge Function |
|---------|--------|--------|---------------|
| **ContaHub** | Faturamento, PAX, Tickets | ✅ ATIVO | contahub-sync |
| **NIBO** | Custos, Pagamentos | ✅ ATIVO | integracao-dispatcher |
| **Discord** | Notificações | ✅ ATIVO | discord-dispatcher |
| **Gemini** | Análise IA | ✅ ATIVO | agente-dispatcher |
| **Yuzer** | Reservas | 🔄 INTEGRANDO | integracao-dispatcher |
| **Sympla** | Eventos/Ingressos | 🔄 INTEGRANDO | integracao-dispatcher |
| **GetIn** | Lista/Entrada | 🔄 INTEGRANDO | integracao-dispatcher |
| **ZigPay** | Pagamentos/KDS | 📋 PLANEJADO | - |
| **Pluggy** | Open Finance | 📋 PLANEJADO | - |

### Agendamentos Principais (pg_cron)

| Horário BRT | Job | Função |
|-------------|-----|--------|
| 03:00 | sync-insumos-receitas | Sync insumos |
| 05:00 | sync-nps | Sync NPS |
| 07:00 | contahub-sync | Sync ContaHub |
| 07:30 | sync-eventos | Recálculo eventos |
| 08:00 | alertas-proativos | Alertas manhã |
| **09:00** | **agente-exploracao-diario** | **🆕 Exploração diária automatizada** |
| 09:00 | desempenho-semanal-auto | Atualiza desempenho_semanal |
| 10:00 | agente-analise-diaria | Análise IA diária |
| **10:00** | **agente-exploracao-semanal** | **🆕 Exploração semanal (segundas)** |
| 10:00 | nibo-sync | Sync NIBO |
| **11:00** | **agente-exploracao-mensal** | **🆕 Exploração mensal (dia 1)** |
| 18:00 | sync-contagem | Contagem estoque |
| 20:00 | stockout-sync | Rupturas |

---

## SISTEMA DE AGENTES IA

### Agentes Implementados

**1. agente-analise-diaria** (10:00 BRT)
- Analisa dados do dia anterior
- Compara com últimas 4 operações do mesmo dia
- Busca último dia ABERTO (ignora fechados/feriados)
- Calcula ROI de atração
- Usa Gemini 2.0 Flash para insights
- Fallback enriquecido quando IA indisponível
- Envia para Discord

**2. agente-analise-semanal** (Segunda 08:00 BRT)
- Resume a semana anterior
- Compara com semana passada
- Identifica tendências

**3. agente-analise-mensal** (Dia 2, 08:00 BRT)
- Resume o mês anterior
- Compara com mesmo mês ano passado
- Análise YoY (Year over Year)

**4. agente-ia-analyzer**
- Núcleo central de análise com IA
- Base de conhecimento configurável
- Memória persistente
- Detecção de padrões
- Insights categorizados

### Tabelas de Agentes

- `agente_insights` - Insights gerados
- `agente_memoria_vetorial` - Memória do agente
- `agente_padroes_detectados` - Padrões encontrados
- `agente_regras_dinamicas` - Regras aprendidas
- `agente_feedbacks` - Feedbacks recebidos
- `agente_ia_metricas` - Métricas de uso

---

## 🚨 TROUBLESHOOTING

### Erros Comuns e Soluções

#### 1. "column does not exist"

**Causa**: Tabela foi renomeada ou coluna não existe no banco.

**Solução**:
```sql
-- Verificar colunas da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'nome_tabela' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Prevenção**: Sempre verificar estrutura da tabela antes de usar em queries.

---

#### 2. "null value in column violates not-null constraint"

**Causa**: Campo obrigatório não foi preenchido.

**Solução**:
- Adicionar validação no frontend
- Adicionar valor default no banco
- Verificar se campo realmente precisa ser NOT NULL

```sql
-- Adicionar default
ALTER TABLE tabela 
ALTER COLUMN coluna SET DEFAULT valor_padrao;

-- Remover constraint NOT NULL (se apropriado)
ALTER TABLE tabela 
ALTER COLUMN coluna DROP NOT NULL;
```

---

#### 3. "Erro ao conectar com banco" (getSupabaseClient retorna null)

**Causa**: Variáveis de ambiente não configuradas.

**Solução**:
1. Verificar `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://uqtgsvujwcbymjmvkjhy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

2. Reiniciar servidor de desenvolvimento:
```bash
npm run dev
```

---

#### 4. "PGRST116" (No rows found)

**Causa**: Query com `.single()` não encontrou resultado.

**Solução**:
```typescript
const { data, error } = await supabase
  .from('tabela')
  .select('*')
  .eq('id', id)
  .single();

// Verificar se erro é "not found"
if (error && error.code !== 'PGRST116') {
  throw error;  // Erro real
}

// data será null se não encontrar
if (!data) {
  return NextResponse.json(
    { error: 'Registro não encontrado' },
    { status: 404 }
  );
}
```

---

#### 5. TypeScript: "Type 'unknown' is not assignable"

**Causa**: Supabase retorna tipos genéricos.

**Solução**:
```typescript
// Tipar como any[]
const dados = (data || []) as any[];

// Ou criar interface
interface Evento {
  id: number;
  nome: string;
  data_evento: string;
}

const eventos = (data || []) as Evento[];
```

---

#### 6. "Row Level Security" bloqueando acesso

**Causa**: RLS ativo mas usuário não tem permissão.

**Solução**:
```typescript
// Usar service role key para bypass RLS (apenas em Edge Functions)
import { createServiceRoleClient } from '@/lib/supabase-admin';

const supabase = createServiceRoleClient();

// OU verificar políticas RLS
SELECT * FROM pg_policies 
WHERE tablename = 'nome_tabela';
```

---

#### 7. "Quota exceeded" (Gemini API)

**Causa**: Limite de requisições da API Gemini atingido.

**Solução**:
- Sistema já tem fallback automático
- Verificar logs: `console.log('Quota Gemini excedida')`
- Aguardar reset do quota (diário)

---

#### 8. CMV muito alto (> 50%)

**Causa**: Produtos com prefixos [HH], [DD], [IN] não foram filtrados.

**Solução**:
```sql
-- Verificar produtos incluídos
SELECT prd_desc, SUM(custo * qtd) as custo_total
FROM contahub_analitico
WHERE trn_dtgerencial = '2026-01-15'
  AND (
    prd_desc LIKE '[HH]%' OR 
    prd_desc LIKE '[DD]%' OR 
    prd_desc LIKE '[IN]%'
  )
GROUP BY prd_desc;

-- Filtrar corretamente
WHERE prd_desc NOT LIKE '[HH]%'
  AND prd_desc NOT LIKE '[DD]%'
  AND prd_desc NOT LIKE '[IN]%'
```

---

#### 9. "Too many connections" (PostgreSQL)

**Causa**: Limite de conexões atingido.

**Solução**:
- Usar Connection Pooling (PgBouncer) - porta 6543
- Verificar conexões ativas:
```sql
SELECT count(*) FROM pg_stat_activity;
```

- Fechar conexões idle:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
  AND state_change < NOW() - INTERVAL '5 minutes';
```

---

#### 10. Build falhando no Vercel

**Causa**: Erros de TypeScript não detectados localmente.

**Solução**:
```bash
# Rodar type-check antes de push
cd frontend
npm run type-check

# Se houver erros, corrigir antes de fazer push
```

---

### Debugging

#### Logs do Sistema

**Frontend (Next.js)**:
```typescript
// Sempre usar console.error para erros
console.error('Erro ao buscar dados:', error);

// console.log para debug
console.log('Dados recebidos:', data);
```

**Edge Functions**:
```typescript
// Logs aparecem no Supabase Dashboard > Edge Functions > Logs
console.log('🚀 Função iniciada');
console.error('❌ Erro:', error.message);
```

**Cron Jobs**:
```sql
-- Ver logs de execução
SELECT * FROM cron.job_run_details 
WHERE jobid = 266  -- ID do cron job
ORDER BY start_time DESC 
LIMIT 10;
```

---

#### Verificar Saúde do Sistema

```sql
-- Score de saúde dos dados
SELECT * FROM relatorios_diarios 
ORDER BY executado_em DESC 
LIMIT 1;

-- Eventos sem recálculo
SELECT COUNT(*) 
FROM eventos_base 
WHERE precisa_recalculo = true;

-- CMV problemáticos
SELECT * FROM cmv_semanal 
WHERE cmv_limpo_percentual > 50 
   OR cmv_limpo_percentual < 0;
```

---

## 📝 WORKFLOWS

### Adicionar Nova Funcionalidade

**Passo a passo completo**:

1. **Criar API** (`frontend/src/app/api/[nome]/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ... implementação
}
```

2. **Criar Página** (`frontend/src/app/[modulo]/[nome]/page.tsx`):
```typescript
'use client';

import { useState, useEffect } from 'react';

export default function NovaPagina() {
  // ... implementação
}
```

3. **Adicionar no Menu** (`frontend/src/lib/menu-config.ts`):
```typescript
{
  name: 'Nome da Funcionalidade',
  href: '/modulo/nome',
  icon: IconName,
  badge: null,
}
```

4. **Rodar Type-Check**:
```bash
cd frontend
npm run type-check
```

5. **Testar Localmente**:
```bash
npm run dev
# Abrir http://localhost:3001/modulo/nome
```

6. **Commit e Push**:
```bash
git add .
git commit -m "feat: Adicionar funcionalidade X"
git push origin main
```

---

### Criar Nova Tabela no Banco

1. **Criar Migration SQL** (`database/migrations/YYYY-MM-DD-nome.sql`):
```sql
-- Criar tabela
CREATE TABLE nova_tabela (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER REFERENCES bares(id),
  nome VARCHAR(255) NOT NULL,
  valor NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX idx_nova_tabela_bar_id ON nova_tabela(bar_id);

-- Adicionar RLS
ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver registros do seu bar"
ON nova_tabela FOR SELECT
USING (user_has_access_to_bar(bar_id));

-- Adicionar trigger de updated_at
CREATE TRIGGER update_nova_tabela_updated_at
  BEFORE UPDATE ON nova_tabela
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_generic();
```

2. **Aplicar Migration**:
- Via Supabase Dashboard: SQL Editor > Colar SQL > Run
- Via CLI: `supabase db push`

3. **Atualizar Tipos** (`frontend/src/types/supabase.ts`):
```typescript
export interface NovaTabela {
  id: number;
  bar_id: number;
  nome: string;
  valor: number;
  created_at: string;
  updated_at: string;
}
```

4. **Documentar** (neste arquivo):
- Adicionar na seção "Banco de Dados"
- Descrever colunas principais
- Adicionar query de exemplo

---

### Adicionar Nova Edge Function

1. **Criar Arquivo** (`backend/supabase/functions/nome-funcao/index.ts`):
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Lógica da função
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

2. **Deploy**:
```bash
# Via Supabase CLI
supabase functions deploy nome-funcao

# Ou via Dashboard: Edge Functions > Deploy
```

3. **Configurar Secrets** (se necessário):
```bash
supabase secrets set NOME_SECRET=valor
```

4. **Testar**:
```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/nome-funcao \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"param": "valor"}'
```

---

### Adicionar Cron Job

1. **Criar Função SQL**:
```sql
CREATE OR REPLACE FUNCTION executar_tarefa_agendada()
RETURNS void AS $$
BEGIN
  -- Lógica da tarefa
  RAISE NOTICE 'Tarefa executada com sucesso';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro na tarefa: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

2. **Agendar com pg_cron**:
```sql
-- Todo dia às 9h
SELECT cron.schedule(
  'nome-do-job',
  '0 9 * * *',
  $$SELECT executar_tarefa_agendada();$$
);

-- Verificar jobs ativos
SELECT * FROM cron.job;
```

3. **Monitorar Execuções**:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'nome-do-job'
ORDER BY start_time DESC 
LIMIT 10;
```

---

### Corrigir Dados Problemáticos

#### CMV Negativo ou > 100%

```sql
-- 1. Identificar problemas
SELECT * FROM cmv_semanal 
WHERE cmv_limpo_percentual < 0 
   OR cmv_limpo_percentual > 100;

-- 2. Recalcular manualmente
UPDATE cmv_semanal 
SET 
  cmv_calculado = estoque_inicial + compras_periodo - estoque_final,
  cmv_limpo_percentual = (
    (estoque_inicial + compras_periodo - estoque_final) / 
    NULLIF(vendas_liquidas, 0) * 100
  )
WHERE id = 123;
```

#### Público Faltante

```sql
-- 1. Identificar eventos sem público
SELECT * FROM eventos_base 
WHERE cl_real IS NULL 
  AND real_r > 1000;

-- 2. Estimar público baseado em ticket médio
UPDATE eventos_base 
SET cl_real = ROUND(real_r / 104.91)  -- Ticket médio histórico
WHERE cl_real IS NULL 
  AND real_r > 1000;
```

---

### Deploy para Produção

**Checklist Pré-Deploy**:

- [ ] Rodar `npm run type-check` no frontend
- [ ] Testar funcionalidade localmente
- [ ] Verificar se variáveis de ambiente estão configuradas no Vercel
- [ ] Revisar código (não deixar console.logs desnecessários)
- [ ] Atualizar documentação (se necessário)

**Deploy**:
```bash
# 1. Commit
git add .
git commit -m "feat: Descrição da mudança"

# 2. Push (deploy automático no Vercel)
git push origin main

# 3. Verificar deploy no Vercel Dashboard
# https://vercel.com/seu-projeto/deployments
```

**Pós-Deploy**:
- [ ] Testar em produção
- [ ] Verificar logs no Vercel
- [ ] Monitorar erros no Sentry (se configurado)

---

## ⚙️ CONFIGURAÇÕES E VARIÁVEIS

### Variáveis de Ambiente

#### Frontend (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://uqtgsvujwcbymjmvkjhy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Aplicação
NEXT_PUBLIC_APP_URL=http://localhost:3001
CRON_SECRET=zykor-cron-secret-2026

# APIs Externas
GEMINI_API_KEY=AIza...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# ContaHub
CONTAHUB_API_KEY=...
CONTAHUB_BASE_URL=https://api.contahub.com

# NIBO
NIBO_API_KEY=...
NIBO_BASE_URL=https://api.nibo.com.br

# Sympla
SYMPLA_TOKEN=...

# Yuzer
YUZER_API_KEY=...

# GetIn
GETIN_API_KEY=...
```

---

#### Vercel (Produção)

**Configurar em**: Vercel Dashboard > Project > Settings > Environment Variables

**Variáveis Obrigatórias**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `GEMINI_API_KEY`

**Variáveis Opcionais** (integrações):
- `CONTAHUB_API_KEY`
- `NIBO_API_KEY`
- `DISCORD_WEBHOOK_URL`
- `SYMPLA_TOKEN`
- `YUZER_API_KEY`
- `GETIN_API_KEY`

---

#### Supabase (Secrets)

**Configurar em**: Supabase Dashboard > Project Settings > Edge Functions > Secrets

```bash
# Via CLI
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set DISCORD_WEBHOOK_URL=https://...
supabase secrets set CONTAHUB_API_KEY=...
supabase secrets set NIBO_API_KEY=...

# Listar secrets
supabase secrets list
```

---

### Configurações do Banco

#### Connection Pooling

**Status**: ✅ Ativo (PgBouncer)  
**Porta**: 6543  
**Pool Mode**: Transaction  
**Max Connections**: 60

**Connection String**:
```
postgresql://postgres:[PASSWORD]@db.uqtgsvujwcbymjmvkjhy.supabase.co:6543/postgres
```

---

#### Extensões Instaladas

```sql
SELECT * FROM pg_extension;
```

**Principais**:
- `pg_cron` - Agendamento de tarefas
- `http` - Requisições HTTP
- `uuid-ossp` - Geração de UUIDs
- `pg_stat_statements` - Estatísticas de queries

---

#### Configurações de Performance

```sql
-- Autovacuum agressivo em tabelas grandes
ALTER TABLE contahub_analitico 
SET (autovacuum_vacuum_scale_factor = 0.05);

ALTER TABLE contahub_tempo 
SET (autovacuum_vacuum_scale_factor = 0.05);

-- Search path seguro em funções
ALTER FUNCTION nome_funcao() 
SET search_path = public, pg_temp;
```

---

### Configurações do Frontend

#### Next.js Config (`next.config.js`)

```javascript
module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Otimizações
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Domínios permitidos para imagens
  images: {
    domains: ['uqtgsvujwcbymjmvkjhy.supabase.co'],
  },
};
```

---

#### TailwindCSS Config

**Dark Mode**: Ativo (class-based)  
**Tema**: Customizado com cores do Ordinário Bar

---

### Integrações Externas

#### ContaHub

**Endpoint**: `https://api.contahub.com`  
**Autenticação**: API Key no header  
**Rate Limit**: 100 req/min  
**Sync**: Diário às 07:00 BRT

---

#### NIBO

**Endpoint**: `https://api.nibo.com.br`  
**Autenticação**: OAuth 2.0  
**Rate Limit**: 60 req/min  
**Sync**: Diário às 10:00 BRT

---

#### Google Gemini

**Modelo**: `gemini-2.0-flash-exp`  
**Header**: `x-goog-api-key`  
**Quota**: 1500 req/dia (free tier)  
**Fallback**: Ativo (resposta enriquecida sem IA)

---

#### Discord Webhooks

**Canais**:
- Alertas Gerais: `DISCORD_WEBHOOK_URL`
- Alertas Críticos: `DISCORD_WEBHOOK_CRITICAL`
- Logs Sistema: `DISCORD_WEBHOOK_LOGS`

---

## DECISÕES ARQUITETURAIS

### 1. Consolidação de Funções ✅
**Decisão**: Evitar criar novas Edge Functions. Sempre integrar com dispatchers existentes.  
**Motivo**: Reduzir complexidade, cold starts e facilitar manutenção.

### 2. Gemini 2.0 Flash ✅
**Decisão**: Modelo de IA atual. Usar header `x-goog-api-key`.  
**Motivo**: Melhor custo-benefício. Fallback obrigatório quando quota esgota.

### 3. Dias Fechados ✅
**Decisão**: Filtrar por `faturamento > R$1000` para ignorar dias fechados em comparações.  
**Motivo**: Evitar distorções em análises de desempenho.

### 4. Discord como Hub ✅
**Decisão**: Todas as notificações vão para Discord. Webhooks separados por tipo.  
**Motivo**: Centralização de notificações e facilidade de monitoramento.

### 5. Lazy Loading ✅
**Decisão**: Componentes pesados (framer-motion, recharts) com lazy loading.  
**Motivo**: Reduzir bundle inicial em ~165KB e melhorar performance.

### 6. Componentes Unificados ✅
**Decisão**: 1 componente `unified-loading.tsx` para todos os loadings.  
**Motivo**: Manutenção centralizada e consistência visual.

### 7. Módulos Compartilhados ✅
**Decisão**: Criar módulos `_shared/` para lógica comum.  
**Motivo**: Evitar duplicação de código e facilitar reutilização.

### 8. Dark Mode Obrigatório 🎨
**Decisão**: Todas as páginas devem suportar dark mode.  
**Motivo**: Melhor UX e identidade visual do sistema.

---

## PONTOS DE ATENÇÃO ⚠️

### Operacionais
1. **Operação 7 dias**: Bar abre todos os dias em 2026!
2. **Copa do Mundo 2026**: Ano excepcional!
3. **Aniversário bar**: 31/01 - Niver Ordi.
4. **NPS Drinks/Comida**: Pontos a melhorar (7.4 e 7.7).

### Técnicos
5. **Type-check**: SEMPRE rodar `npm run type-check` antes de push.
6. **Consolidação**: Evitar criar novas Edge Functions. Usar dispatchers existentes.
7. **Dark Mode**: Obrigatório em todas as páginas.
8. **Lazy Loading**: Usar componentes lazy quando possível (framer-motion, recharts).
9. **RLS**: Todas as tabelas principais têm Row Level Security ativo.
10. **Connection Pooling**: Usar porta 6543 (PgBouncer) para evitar "too many connections".

### APIs e Integrações
11. **Quota Gemini**: API tem limite de 1500 req/dia. Sistema tem fallback automático.
12. **CRON_SECRET**: Variável obrigatória no Vercel para autenticação de cron jobs.
13. **ContaHub Sync**: Roda diariamente às 07:00 BRT. Filtra produtos [HH], [DD], [IN].
14. **NIBO Sync**: Roda diariamente às 10:00 BRT.

### Sistemas Implementados
15. **CMO/CMA**: Sistema completo. Meta padrão: R$ 45.000/semana.
16. **Exploração Diária**: Agente automatizado rodando às 9h via Supabase Cron.
17. **Relatórios Diários**: Histórico completo em `relatorios_diarios`.
18. **Dispatchers**: 8 dispatchers unificados (agente, alertas, integracao, contahub, google-sheets, discord, sync, webhook).

### Banco de Dados
19. **187 Tabelas**: Total de 1.08 GB. Top 3: contahub_analitico (191 MB), contahub_tempo (161 MB), contahub_stockout (67 MB).
20. **446 Índices**: Otimizados para performance.
21. **291 Políticas RLS**: Ativas para segurança multi-tenancy.
22. **Triggers**: `update_updated_at_generic()` em 28 tabelas.

### Boas Práticas
23. **Queries**: Sempre filtrar `real_r > 1000` para ignorar dias fechados.
24. **Erros**: Usar `console.error()` para erros, `console.log()` para debug.
25. **Tipos**: Tipar arrays do Supabase como `any[]` para evitar problemas.
26. **Auditoria**: Usar `logAuditEvent()` em operações críticas (create, update, delete).
27. **Recharts**: Biblioteca padrão para gráficos (LineChart, BarChart, AreaChart).
28. **Formatters**: Usar funções de `lib/formatters.ts` para moeda, percentual, data.

### Documentação
29. **Base de Conhecimento**: Este arquivo (`zykor-context.md`) é a fonte única de verdade.
30. **Sempre Atualizar**: Ao adicionar funcionalidades, atualizar este arquivo.

---

## USUÁRIOS DO SISTEMA

| Nome | Email | Cargo |
|------|-------|-------|
| Carlos Miranda (Cadu) | cadu@grupobizu.com.br | Admin |
| Diogo Lombardi | diogo@grupobizu.com.br | Admin |
| Pedro Gonzalez (Gonza) | pedrogonzaapsm@gmail.com | Admin |
| Rodrigo Oliveira | rodrigo@grupomenosemais.com.br | Admin |
| Isaias | isaias.carneiro03@gmail.com | Produção |

---

## ARQUIVOS DE CONTEXTO RELACIONADOS

- `.cursor/ideias.md` - Ideias em andamento
- `.cursor/decisoes.md` - Decisões arquiteturais
- `.cursor/historico.md` - Histórico de implementações
- `.cursor/rules/` - Regras para o agente (pre-deploy, supabase-api-patterns)

---

## 📚 DOCUMENTAÇÃO TÉCNICA ATUALIZADA (03/03/2026)

> **⚠️ LEITURA OBRIGATÓRIA EM NOVOS CHATS!**

### 🔴 PRIORIDADE MÁXIMA

**`.cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md`** (2.009 linhas)
- ✅ TODAS as 60 colunas de `eventos_base` explicadas
- ✅ TODAS as 65+ colunas de `desempenho_semanal` explicadas
- ✅ **13 DIFERENÇAS entre Ordinário e Deboche** documentadas
- ✅ Fórmulas exatas de cada cálculo
- ✅ Queries SQL prontas para cada métrica
- ✅ Limites de atrasos (em segundos)
- ✅ Categorização de produtos
- ✅ Regras de agregação (média ponderada vs simples)

**DIFERENÇAS CRÍTICAS ENTRE BARES**:
1. Locais do ContaHub (loc_desc)
2. Campos de tempo (t0_t3 vs t0_t2)
3. Limites de atraso por campo
4. Grupos de produtos (24 vs 25 grupos)
5. Custos NIBO (categorias diferentes)
6. Stockout (locais diferentes)
7. Reservas (Ordinário tem API, Deboche não)
8. Faturamento por horário
9. Dias principais (QUI+SÁB+DOM vs TER+QUA+QUI+SEX+SÁB)
10. Conta Assinada
11. Descontos
12. Cancelamentos
13. **Dias de operação** (Ordinário 7 dias, Deboche 6 dias - sem segunda)

---

### 🔵 ARQUITETURA E REFATORAÇÃO

**`.cursor/PROPOSTA-ARQUITETURA-LIMPA.md`** (1.200+ linhas)
- ✅ Fluxo completo de dados validado
- ✅ Consolidação: 19 Edge Functions → 5
- ✅ Consolidação: 61 Database Functions → 3
- ✅ Horários otimizados (06h30-08h = dados prontos)
- ✅ 5 Scripts SQL prontos para executar
- ✅ Tabela `bares_config` (configurações centralizadas)
- ✅ Lógica condicional por bar (lê do banco)
- ✅ Preparado para migração ZigPay

**`.cursor/MAPEAMENTO-COMPLETO-ARQUITETURA-ATUAL.md`** (146 linhas)
- ✅ Inventário de 19 Edge Functions
- ✅ Inventário de 27 Cron Jobs
- ✅ Problemas identificados (duplicações, conflitos)

---

### 🔑 REGRAS DE OURO (Novos Chats)

1. **SEMPRE ler** `REGRAS-DE-NEGOCIO-COMPLETAS.md` antes de calcular métricas
2. **NUNCA editar** tabelas `contahub_*`, `yuzer_*`, `sympla_*` (dados brutos)
3. **SEMPRE usar** `bares_config` para dias de operação (não hardcode)
4. **SEMPRE usar** IF/ELSIF por bar (Ordinário ≠ Deboche)
5. **SEMPRE testar** com dados reais de AMBOS os bares

---

**Última atualização**: 04/03/2026 16:20 BRT  
**Próxima revisão**: Quando houver mudanças significativas no sistema

**Mudanças nesta atualização**:
- ✅ **BASE DE CONHECIMENTO COMPLETA** - Arquivo unificado criado
- ✅ **Seção Banco de Dados** - 187 tabelas documentadas com colunas e relacionamentos
- ✅ **Seção Padrões de Código** - Templates prontos para APIs, Edge Functions e Componentes
- ✅ **Seção Queries Úteis** - 20+ queries SQL prontas para uso
- ✅ **Seção Troubleshooting** - 10 erros comuns com soluções
- ✅ **Seção Workflows** - Processos do dia-a-dia documentados
- ✅ **Seção Configurações** - Todas as variáveis de ambiente e configs
- ✅ **Índice Navegável** - Links para todas as seções
- ✅ **Pontos de Atenção** - Reorganizados em categorias (30 itens)

---

## ATUALIZAÇÕES OPERACIONAIS (04/03/2026)

### Desempenho Semanal - Correções Canônicas

- `desempenho_semanal` foi recalculado com foco em:
  - ticket médio
  - mix semanal por `categoria_mix` canônica
  - tempos/atrasos com unidade correta para exibição
  - stockout por categoria (`BEBIDA`, `DRINK`, `COMIDA`)
  - Google reviews
  - NPS via fonte agregada semanal
- Ajuste crítico: campos de tempo passaram a ser tratados em minutos na camada semanal (evitando distorções de exibição).
- Ajuste crítico: removido desconto duplicado de conta assinada no recálculo semanal (usa `real_r` canônico de `eventos_base`).

### Mix Semanal - Regra de Carnaval

- Regra oficial aplicada: excluir dias de Carnaval do mix semanal:
  - `2026-02-13`
  - `2026-02-14`
  - `2026-02-15`
  - `2026-02-16`
  - `2026-02-17`
- Base de mix semanal permanece `contahub_analitico` (sem considerar Yuzer/Sympla para composição de mix).

### Automação de Semana Atual (Semana 10+)

- A Edge Function `recalcular-desempenho-auto` agora:
  - garante criação da linha da semana atual para bar 3 e 4 em `desempenho_semanal`
  - recalcula parcial da semana com os dias já disponíveis
- Objetivo: evitar ausência de semana nova no painel de desempenho.

### Deploys e Monitoramento

- `recalcular-desempenho-auto` publicado via MCP (versões atualizadas no dia 04/03/2026).
- Job ativo de recálculo:
  - `desempenho-auto-diario` (`cron.job` 301)
- Job novo de saúde/alerta:
  - `alerta-desempenho-auto-falha` (`cron.job` 316)
  - schedule: `30 12 * * *` (09:30 BRT)
  - função: `public.verificar_saude_desempenho_auto_alerta_discord()`
- Alerta usa `enviar_alerta_discord_sistema_dedup` para evitar duplicação no mesmo dia.

### NPS - Observação Importante

- Cron de sync NPS (`google-sheets-sync-diario`) está executando com sucesso.
- Semana sem valor de NPS no desempenho pode ocorrer por ausência de dados fonte em `nps` / `nps_reservas` / `nps_agregado_semanal` naquela janela semanal.

**Objetivo Alcançado**: 
- 🎯 Economizar tokens (não precisa mais listar tabelas)
- 🎯 Contexto sempre disponível em um único arquivo
- 🎯 Onboarding rápido para novos desenvolvedores (ou novos chats)
- 🎯 Troubleshooting eficiente com soluções documentadas
- 🎯 Workflows padronizados para tarefas comuns

---

## CONFIGURAÇÕES DE INFRAESTRUTURA

### Supabase Database
- **Connection Pooling**: Transaction Pooler ativo (porta 6543)
- **PgBouncer**: Ativo e funcionando
- **Max Connections**: 60 (uso atual: ~20%)
- **Auth Connections**: 10 fixas (não crítico, considerar % no futuro)

### Vercel (Frontend)
- **Framework**: Next.js 14+
- **Conexão**: Via REST API do Supabase (não usa conexão direta ao PostgreSQL)
- **Deploy**: Automático via GitHub (branch main)
