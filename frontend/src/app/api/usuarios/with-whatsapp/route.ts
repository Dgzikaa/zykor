import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient();

// GET - Listar funcionários com WhatsApp cadastrado
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('bar_id');
    const includeWithout = searchParams.get('include_without') === 'true';

    let query = supabase
      .from('usuarios_bar')
      .select('id, nome, email, celular, ativo, cargo, departamento')
      .eq('ativo', true);

    if (barId) {
      query = query.eq('bar_id', barId);
    }

    const { data: usuarios, error } = await query;

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar usuários' },
        { status: 500 }
      );
    }

    // Filtrar e categorizar usuários
    const usuariosComWhatsApp =
      usuarios?.filter(u => u.celular && u.celular.length === 11) || [];

    const usuariosSemWhatsApp =
      usuarios?.filter(u => !u.celular || u.celular.length !== 11) || [];

    // Validar números de WhatsApp
    const usuariosValidados = usuariosComWhatsApp.map(usuario => {
      const numero = usuario.celular;
      const isValid =
        numero &&
        numero.length === 11 &&
        parseInt(numero.substring(0, 2)) >= 11 &&
        parseInt(numero.substring(0, 2)) <= 99 &&
        numero[2] === '9';

      return {
        ...usuario,
        whatsapp_valido: isValid,
        numero_formatado: numero
          ? `+55 (${numero.substring(0, 2)}) ${numero.substring(2, 7)}-${numero.substring(7)}`
          : null,
      };
    });

    const response: Record<string, any> = {
      success: true,
      com_whatsapp: usuariosValidados,
      total_com_whatsapp: usuariosValidados.length,
      total_whatsapp_valido: usuariosValidados.filter(u => u.whatsapp_valido)
        .length,
    };

    if (includeWithout) {
      response.sem_whatsapp = usuariosSemWhatsApp;
      response.total_sem_whatsapp = usuariosSemWhatsApp.length;
    }

    response.total_usuarios = usuarios?.length || 0;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao buscar usuários com WhatsApp:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}

// POST - Atualizar múltiplos usuários (para operações em lote)
export async function POST(req: NextRequest) {
  try {
    const { operacao, usuarios } = await req.json();

    if (operacao === 'validar_whatsapp') {
      // Validar números WhatsApp em lote
      const resultados: any[] = [];

      for (const usuario of usuarios) {
        const numero = usuario.celular?.replace(/\D/g, '');

        if (!numero || numero.length !== 11) {
          resultados.push({
            id: usuario.id,
            valido: false,
            erro: 'Número inválido',
          });
          continue;
        }

        try {
          // Aqui você poderia fazer uma validação real via API
          // Por enquanto, apenas validação de formato
          const isValid =
            parseInt(numero.substring(0, 2)) >= 11 &&
            parseInt(numero.substring(0, 2)) <= 99 &&
            numero[2] === '9';

          resultados.push({
            id: usuario.id,
            valido: isValid,
            numero: numero,
          });
        } catch {
          resultados.push({
            id: usuario.id,
            valido: false,
            erro: 'Erro na validação',
          });
        }
      }

      return NextResponse.json({
        success: true,
        resultados,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Operação não suportada' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro na operação em lote:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
