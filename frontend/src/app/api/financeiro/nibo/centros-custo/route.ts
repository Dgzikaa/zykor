import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configuração NIBO
const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');

    // Validar bar_id - OBRIGATÓRIO para separar dados por bar
    if (!barId) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório',
        centrosCusto: [],
        total: 0
      }, { status: 400 });
    }

    console.log(`[NIBO-CENTROS-CUSTO] Buscando centros de custo para bar_id=${barId}`);

    // Primeiro, buscar credenciais do NIBO para este bar
    const { data: credencial, error: credError } = await supabase
      .from('api_credentials')
      .select('api_token, empresa_id')
      .eq('sistema', 'nibo')
      .eq('bar_id', parseInt(barId))
      .eq('ativo', true)
      .single();

    if (credError || !credencial?.api_token) {
      console.log('[NIBO-CENTROS-CUSTO] Credenciais não encontradas, retornando centros de custo do banco');
      
      // Fallback: buscar centros de custo únicos da tabela nibo_agendamentos
      const { data: centrosAgendamentos, error: centrosError } = await supabase
        .from('nibo_agendamentos')
        .select('centro_custo_id, centro_custo_nome')
        .not('centro_custo_id', 'is', null)
        .not('centro_custo_id', 'eq', '');

      if (centrosError) {
        console.error('Erro ao buscar centros de custo dos agendamentos:', centrosError);
        return NextResponse.json(
          { success: false, error: 'Erro ao buscar centros de custo' },
          { status: 500 }
        );
      }

      // Remover duplicados e formatar
      const centrosUnicos = new Map<string, { id: string; nome: string }>();
      centrosAgendamentos?.forEach((item) => {
        if (item.centro_custo_id && !centrosUnicos.has(item.centro_custo_id)) {
          centrosUnicos.set(item.centro_custo_id, {
            id: item.centro_custo_id,
            nome: item.centro_custo_nome || `Centro ${item.centro_custo_id.substring(0, 8)}`
          });
        }
      });

      const centrosCusto = Array.from(centrosUnicos.values());

      return NextResponse.json({
        success: true,
        centrosCusto,
        total: centrosCusto.length,
        source: 'database'
      });
    }

    // Buscar centros de custo diretamente da API do NIBO
    try {
      const niboUrl = `${NIBO_BASE_URL}/costcenters?apitoken=${credencial.api_token}`;
      
      const niboResponse = await fetch(niboUrl, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'apitoken': credencial.api_token
        }
      });

      if (!niboResponse.ok) {
        throw new Error(`NIBO API Error: ${niboResponse.status}`);
      }

      const niboData = await niboResponse.json();
      
      // Formatar resposta do NIBO
      const centrosCusto = (niboData.items || niboData || []).map((item: any) => ({
        id: item.id || item.costCenterId,
        nibo_id: item.id || item.costCenterId,
        nome: item.name || item.description || 'Sem nome',
        codigo: item.code || null,
        ativo: item.isActive !== false,
        bar_id: parseInt(barId)
      }));

      console.log(`[NIBO-CENTROS-CUSTO] ${centrosCusto.length} centros de custo encontrados via API NIBO`);

      // Salvar/atualizar centros de custo na tabela local para cache
      for (const centro of centrosCusto) {
        const niboIdStr = String(centro.nibo_id || '').trim();
        
        if (!niboIdStr) {
          console.warn(`[NIBO-CENTROS-CUSTO] Centro sem nibo_id: ${centro.nome}`);
          continue;
        }

        // Verificar se já existe
        const { data: existente } = await supabase
          .from('nibo_centros_custo')
          .select('id')
          .eq('nibo_id', niboIdStr)
          .eq('bar_id', parseInt(barId))
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('nibo_centros_custo')
            .update({
              nome: centro.nome,
              codigo: centro.codigo,
              ativo: centro.ativo,
              atualizado_em: new Date().toISOString()
            })
            .eq('id', existente.id);

          if (updateError) {
            console.warn(`[NIBO-CENTROS-CUSTO] Erro ao atualizar centro ${centro.nome}:`, updateError);
          }
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('nibo_centros_custo')
            .insert({
              nibo_id: niboIdStr,
              bar_id: parseInt(barId),
              nome: centro.nome,
              codigo: centro.codigo,
              ativo: centro.ativo,
              criado_em: new Date().toISOString(),
              atualizado_em: new Date().toISOString()
            });

          if (insertError) {
            console.warn(`[NIBO-CENTROS-CUSTO] Erro ao inserir centro ${centro.nome}:`, insertError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        centrosCusto,
        total: centrosCusto.length,
        source: 'nibo_api'
      });

    } catch (niboError) {
      console.error('[NIBO-CENTROS-CUSTO] Erro na API NIBO:', niboError);
      
      // Fallback: buscar do banco local
      const { data: centrosLocais } = await supabase
        .from('nibo_centros_custo')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .eq('ativo', true)
        .order('nome');

      if (centrosLocais && centrosLocais.length > 0) {
        return NextResponse.json({
          success: true,
          centrosCusto: centrosLocais.map(c => ({
            id: c.nibo_id || c.id,
            nibo_id: c.nibo_id,
            nome: c.nome,
            codigo: c.codigo,
            ativo: c.ativo,
            bar_id: c.bar_id
          })),
          total: centrosLocais.length,
          source: 'database_cache'
        });
      }

      return NextResponse.json({
        success: true,
        centrosCusto: [],
        total: 0,
        source: 'empty',
        aviso: 'Não foi possível buscar centros de custo da API NIBO e não há cache local'
      });
    }

  } catch (error) {
    console.error('[NIBO-CENTROS-CUSTO] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar centros de custo' },
      { status: 500 }
    );
  }
}
