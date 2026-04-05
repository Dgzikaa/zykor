import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { realizarPagamentoPixInter } from '@/lib/inter/pixPayment';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Função para obter credenciais do Inter do banco
async function getInterCredentials(barId: number = 3, credentialId?: number) {
  let query = supabase
    .from('api_credentials')
    .select('*')
    .eq('bar_id', barId)
    .in('sistema', ['inter', 'banco_inter'])
    .eq('ativo', true);

  if (credentialId) {
    query = query.eq('id', credentialId);
  } else {
    query = query.order('id', { ascending: true }).limit(1);
  }

  const { data: credenciais, error } = await query;

  const credencial = credenciais?.[0];
  if (error || !credencial) {
    console.error('[INTER-PIX] Erro ao buscar credenciais:', error);
    return null;
  }

  return credencial;
}

async function loadCredentialCertificates(configuracoes: any): Promise<{ cert: Buffer; key: Buffer } | null> {
  const certFile =
    configuracoes?.cert_file ||
    configuracoes?.cert_path ||
    configuracoes?.certificate_file ||
    null;
  const keyFile =
    configuracoes?.key_file ||
    configuracoes?.key_path ||
    configuracoes?.private_key_file ||
    null;

  if (!certFile || !keyFile) {
    return null;
  }

  const { data: certBlob, error: certError } = await supabase.storage.from('inter').download(certFile);
  if (certError || !certBlob) {
    throw new Error(`Não foi possível baixar certificado no bucket inter: ${certFile}`);
  }

  const { data: keyBlob, error: keyError } = await supabase.storage.from('inter').download(keyFile);
  if (keyError || !keyBlob) {
    throw new Error(`Não foi possível baixar chave privada no bucket inter: ${keyFile}`);
  }

  const cert = Buffer.from(await certBlob.arrayBuffer());
  const key = Buffer.from(await keyBlob.arrayBuffer());
  return { cert, key };
}

// Funções de validação de chave PIX
function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11 || cpf === cpf[0].repeat(11)) return false;
  
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  const d1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (parseInt(cpf[9]) !== d1) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  const d2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return parseInt(cpf[10]) === d2;
}

function validarCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || cnpj === cnpj[0].repeat(14)) return false;
  
  const pesos1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(cnpj[i]) * pesos1[i];
  const d1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (parseInt(cnpj[12]) !== d1) return false;
  
  const pesos2 = [6, ...pesos1];
  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(cnpj[i]) * pesos2[i];
  const d2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return parseInt(cnpj[13]) === d2;
}

function identificarTipoChave(chave: string): { tipo: string; chaveFormatada: string } | null {
  if (!chave) return null;
  
  const chaveClean = chave.trim();
  
  // Email
  if (chaveClean.includes('@') && /^[\w.-]+@[\w.-]+\.\w{2,4}$/.test(chaveClean)) {
    return { tipo: 'EMAIL', chaveFormatada: chaveClean.toLowerCase() };
  }
  
  const digits = chaveClean.replace(/\D/g, '');
  
  // CPF
  if (digits.length === 11 && validarCpf(digits)) {
    return { tipo: 'CPF', chaveFormatada: digits };
  }
  
  // CNPJ
  if (digits.length === 14 && validarCnpj(digits)) {
    return { tipo: 'CNPJ', chaveFormatada: digits };
  }
  
  // Telefone (11 dígitos começando com 9)
  if (digits.length === 11 && digits[2] === '9') {
    return { tipo: 'TELEFONE', chaveFormatada: `+55${digits}` };
  }
  
  // Chave aleatória (EVP)
  if (chaveClean.length >= 32 || chaveClean.includes('-')) {
    return { tipo: 'CHAVE_ALEATORIA', chaveFormatada: chaveClean };
  }
  
  // Se não identificou, tentar usar como está
  return { tipo: 'CHAVE_ALEATORIA', chaveFormatada: chaveClean };
}

// POST - Enviar PIX via Inter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      valor,
      descricao,
      destinatario,
      chave,
      data_pagamento,
      bar_id,
      inter_credencial_id,
      agendamento_id // ID da tabela de agendamentos (legado) para atualizar com o código de solicitação
    } = body;

    // Validar bar_id - OBRIGATÓRIO
    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Validações
    if (!chave || !valor) {
      return NextResponse.json(
        { success: false, error: 'Chave PIX e valor são obrigatórios' },
        { status: 400 }
      );
    }

    // Processar valor
    let valorNumerico: number;
    if (typeof valor === 'string') {
      valorNumerico = parseFloat(valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    } else {
      valorNumerico = parseFloat(valor);
    }

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valor inválido' },
        { status: 400 }
      );
    }

    // Identificar tipo de chave
    const tipoChave = identificarTipoChave(chave);
    if (!tipoChave) {
      return NextResponse.json(
        { success: false, error: 'Chave PIX inválida' },
        { status: 400 }
      );
    }

    // Buscar credenciais do Inter
    const credentialId = Number.isFinite(Number(inter_credencial_id))
      ? Number(inter_credencial_id)
      : undefined;
    const credenciais = await getInterCredentials(bar_id, credentialId);
    
    if (!credenciais) {
      console.error('[INTER-PIX] Credenciais não encontradas para bar_id:', bar_id);
      return NextResponse.json(
        { success: false, error: 'Credenciais Inter não configuradas para este bar' },
        { status: 400 }
      );
    }

    // ============================================================
    // MODO PRODUÇÃO - Chamada real à API do Inter
    // ============================================================

    // Extrair credenciais
    const clientId = credenciais.client_id;
    const clientSecret = credenciais.client_secret;
    const contaCorrente = credenciais.configuracoes?.conta_corrente;
    const credencialDebug = {
      credencial_id: credenciais.id,
      empresa_nome: credenciais.empresa_nome || null,
      conta_corrente: contaCorrente || null,
      cert_file:
        credenciais.configuracoes?.cert_file ||
        credenciais.configuracoes?.cert_path ||
        credenciais.configuracoes?.certificate_file ||
        null,
      key_file:
        credenciais.configuracoes?.key_file ||
        credenciais.configuracoes?.key_path ||
        credenciais.configuracoes?.private_key_file ||
        null,
    };

    if (!clientId || !clientSecret || !contaCorrente) {
      return NextResponse.json(
        { success: false, error: 'Credenciais Inter incompletas (client_id/client_secret/conta_corrente)' },
        { status: 400 }
      );
    }

    try {
      // 1. Obter access_token via OAuth2 com mTLS
      const mtlsCredentials = await loadCredentialCertificates(credenciais.configuracoes);
      
      // Se o body tiver force_new_token, limpar cache primeiro
      const forceNewToken = body.force_new_token;
      if (forceNewToken) {
        clearInterTokenCache();
      }
      
      const accessToken = await getInterAccessToken(
        clientId,
        clientSecret,
        'pagamento-pix.write',
        mtlsCredentials || undefined
      );

      // 2. Realizar pagamento PIX
      const resultadoPix = await realizarPagamentoPixInter({
        token: accessToken,
        contaCorrente: contaCorrente,
        valor: valorNumerico,
        descricao: descricao || `Pagamento PIX para ${destinatario || 'beneficiário'}`,
        chave: tipoChave.chaveFormatada,
        mtlsCredentials: mtlsCredentials || undefined
      });

      if (!resultadoPix.success) {
        console.error('[INTER-PIX] Erro no pagamento:', resultadoPix.error);
        
        // Salvar erro no banco para tracking
        await supabase.from('pix_enviados').insert({
          txid: `ERR_${Date.now()}`,
          bar_id,
          valor: valorNumerico,
          beneficiario: {
            nome: destinatario || 'Não informado',
            chave: tipoChave.chaveFormatada,
            tipoChave: tipoChave.tipo,
            descricao: descricao || 'Pagamento PIX',
            erro: resultadoPix.error
          },
          data_envio: new Date().toISOString(),
          status: 'erro',
          created_at: new Date().toISOString()
        });

        return NextResponse.json(
          { success: false, error: resultadoPix.error, credencial: credencialDebug },
          { status: resultadoPix.error?.toLowerCase().includes('acesso negado') ? 401 : 400 }
        );
      }

      // 3. PIX enviado com sucesso
      const codigoSolicitacao = resultadoPix.data?.codigoSolicitacao || 
                                 resultadoPix.data?.endToEndId || 
                                 `PIX_${Date.now()}`;

      // Salvar no banco pix_enviados
      const { error: insertError } = await supabase.from('pix_enviados').insert({
        txid: codigoSolicitacao,
        bar_id,
        valor: valorNumerico,
        beneficiario: {
          nome: destinatario || 'Não informado',
          chave: tipoChave.chaveFormatada,
          tipoChave: tipoChave.tipo,
          descricao: descricao || 'Pagamento PIX'
        },
        data_envio: new Date().toISOString(),
        status: 'enviado',
        created_at: new Date().toISOString()
      });

      if (insertError) {
        console.error('[INTER-PIX] Erro ao salvar no banco:', insertError);
      }

      // Se tiver agendamento_id, atualizar a tabela de agendamentos com o código de solicitação
      // Isso permite que o webhook encontre o agendamento quando receber a confirmação
      // NOTA: Tabela nibo_agendamentos mantida para compatibilidade com webhook PIX
      if (agendamento_id) {
        const { error: updateError } = await supabase
          .from('nibo_agendamentos')
          .update({
            inter_codigo_solicitacao: codigoSolicitacao,
            inter_end_to_end_id: resultadoPix.data?.endToEndId || null,
            inter_status: 'AGUARDANDO_APROVACAO',
            status: 'aguardando_aprovacao',
            atualizado_em: new Date().toISOString()
          })
          .eq('id', agendamento_id);

        if (updateError) {
          console.error('[INTER-PIX] Erro ao atualizar agendamento:', updateError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'PIX enviado com sucesso',
        data: {
          codigoSolicitacao,
          valor: valorNumerico,
          chave: tipoChave.chaveFormatada,
          tipoChave: tipoChave.tipo,
          status: 'enviado',
          destinatario,
          interResponse: resultadoPix.data,
          credencial: credencialDebug,
        }
      });

    } catch (interError: any) {
      console.error('[INTER-PIX] Erro na comunicação com Inter:', interError);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Erro na comunicação com Banco Inter: ${interError.message || 'Erro desconhecido'}`,
          credencial: credencialDebug,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[INTER-PIX] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar PIX' },
      { status: 500 }
    );
  }
}

// GET - Consultar status de PIX
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codigoSolicitacao = searchParams.get('codigo');
    const barId = parseInt(searchParams.get('bar_id') || '3');

    if (codigoSolicitacao) {
      // Buscar PIX específico
      const { data, error } = await supabase
        .from('pix_enviados')
        .select('*')
        .eq('txid', codigoSolicitacao)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: 'PIX não encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data });
    }

    // Listar últimos PIX
    const { data, error } = await supabase
      .from('pix_enviados')
      .select('*')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    });

  } catch (error) {
    console.error('[INTER-PIX] Erro ao consultar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao consultar PIX' },
      { status: 500 }
    );
  }
}
