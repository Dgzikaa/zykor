import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { realizarPagamentoPixInter } from '@/lib/inter/pixPayment';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// Gera um UUID (formato v4) DETERMINÍSTICO a partir de uma seed. Mesmo pagamento
// => mesma seed => mesma chave `x-id-idempotente` => o Banco Inter deduplica o
// reenvio no lado dele (rede de segurança bancária contra pagamento em dobro).
function idempotenciaDeterministica(seed: string): string {
  const h = crypto.createHash('sha256').update(seed).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Função para obter credenciais do Inter do banco
async function getInterCredentials(barId: number = 3, credentialId?: number) {
  // 1ª tentativa: credencial específica pedida (se houver), SEMPRE amarrada ao bar.
  // Nunca usamos uma credencial de outro bar — o filtro .eq('bar_id') garante isso.
  if (credentialId) {
    const { data, error } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('bar_id', barId)
      .in('sistema', ['inter', 'banco_inter'])
      .eq('ativo', true)
      .eq('id', credentialId)
      .limit(1);

    if (!error && data?.[0]) return data[0];

    // A credencial pedida não pertence a este bar (ex.: lista misturando bares,
    // seleção de credencial do bar errado). Em vez de devolver "não configuradas",
    // cai na credencial ATIVA do próprio bar — o pagamento sai pela conta certa.
    console.warn(
      `[INTER-PIX] credencial ${credentialId} não pertence ao bar ${barId}; usando credencial ativa do bar.`
    );
  }

  const { data: credenciais, error } = await supabase
    .from('api_credentials')
    .select('*')
    .eq('bar_id', barId)
    .in('sistema', ['inter', 'banco_inter'])
    .eq('ativo', true)
    .order('id', { ascending: true })
    .limit(1);

  const credencial = credenciais?.[0];
  if (error || !credencial) {
    console.error('[INTER-PIX] Erro ao buscar credenciais:', error);
    return null;
  }

  return credencial;
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

// DDDs válidos no Brasil — usado pra distinguir celular de CPF (ambos 11 dígitos).
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

// Celular: 11 dígitos = DDD válido + 9 (9º dígito obrigatório) + 8 dígitos.
function pareceCelular(digits: string): boolean {
  return digits.length === 11 && digits[2] === '9' && DDDS_VALIDOS.has(Number(digits.slice(0, 2)));
}

// Identifica o tipo da chave PIX. `chaveAlternativa` cobre a AMBIGUIDADE de 11
// dígitos: um número pode ser CPF válido E celular válido ao mesmo tempo. Nesse
// caso mandamos o formato mais provável e, se o Inter não achar no DICT, o
// pagamento re-tenta com o formato alternativo (CPF cru <-> +55telefone).
function identificarTipoChave(
  chave: string
): { tipo: string; chaveFormatada: string; chaveAlternativa?: string } | null {
  if (!chave) return null;

  const chaveClean = chave.trim();

  // Email
  if (chaveClean.includes('@') && /^[\w.-]+@[\w.-]+\.\w{2,4}$/.test(chaveClean)) {
    return { tipo: 'EMAIL', chaveFormatada: chaveClean.toLowerCase() };
  }

  const digits = chaveClean.replace(/\D/g, '');
  const ehCelular = pareceCelular(digits);
  const ehCpf = digits.length === 11 && validarCpf(digits);

  // CPF (mantém prioridade atual; se também parece celular, guarda o +55 como alternativa)
  if (ehCpf) {
    return {
      tipo: 'CPF',
      chaveFormatada: digits,
      chaveAlternativa: ehCelular ? `+55${digits}` : undefined,
    };
  }

  // CNPJ
  if (digits.length === 14 && validarCnpj(digits)) {
    return { tipo: 'CNPJ', chaveFormatada: digits };
  }

  // Telefone (celular válido). Se os dígitos também forem CPF válido, guarda o CPF cru.
  if (ehCelular) {
    return {
      tipo: 'TELEFONE',
      chaveFormatada: `+55${digits}`,
      chaveAlternativa: ehCpf ? digits : undefined,
    };
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
    // AUTENTICAÇÃO: envia dinheiro real — exige usuário logado com perfil financeiro/admin.
    // bar_id vem SEMPRE do usuário autenticado (nunca do corpo), evitando ação cross-tenant.
    const user = await authenticateUser(request);
    if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
    if (user.role !== 'admin' && user.role !== 'financeiro') {
      return permissionErrorResponse('Sem permissão para enviar PIX');
    }
    const bar_id = user.bar_id;
    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'Usuário sem bar associado' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      valor,
      descricao,
      destinatario,
      chave,
      data_pagamento,
      inter_credencial_id,
      agendamento_id // ID da tabela de agendamentos (legado) para atualizar com o código de solicitação
    } = body;

    // Validações
    if (!chave || !valor) {
      return NextResponse.json(
        { success: false, error: 'Chave PIX e valor são obrigatórios' },
        { status: 400 }
      );
    }

    // Processar valor — aceita number direto OU string em formato pt-BR/en-US
    let valorNumerico: number;
    if (typeof valor === 'number') {
      valorNumerico = valor;
    } else {
      const s = String(valor || '').replace(/[R$\s]/g, '').trim();
      // Detecta formato:
      //   pt-BR: "1.089,10" (ponto = milhar, vírgula = decimal)
      //   en-US: "1089.10"   (ponto = decimal, sem vírgula)
      //   ambíguo: "1089"    (inteiro, qualquer um)
      if (s.includes(',')) {
        // pt-BR — tira pontos de milhar, troca vírgula por ponto
        valorNumerico = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      } else {
        // en-US ou inteiro — parseFloat respeita ponto decimal natural
        valorNumerico = parseFloat(s);
      }
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

    // ============================================================
    // IDEMPOTÊNCIA (servidor) — impede reenviar o MESMO pagamento.
    // O agendamento_id (pagamento_zykor_id) identifica o item da lista. Se já saiu
    // um PIX pra esse item (status != erro), NÃO reenvia — devolve o código
    // existente. Cobre reload, 2 abas, 2 usuários (lista compartilhada por bar) e
    // TROCA DE BAR entre cliques (por isso NÃO filtra por bar_id: no incidente o
    // mesmo item saiu 1x como bar 3 e 1x como bar 4). Retry legítimo após falha
    // continua liberado porque a tentativa com erro fica status='erro'.
    // ============================================================
    const zykorId = typeof agendamento_id === 'string' && agendamento_id ? agendamento_id : null;
    if (zykorId) {
      const { data: jaEnviado } = await (supabase.schema('financial' as any) as any)
        .from('pix_enviados')
        .select('inter_codigo_solicitacao, txid, inter_status, status, bar_id, valor')
        .eq('pagamento_zykor_id', zykorId)
        .neq('status', 'erro')
        .order('data_envio', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jaEnviado) {
        const codigoExistente =
          jaEnviado.inter_codigo_solicitacao || jaEnviado.txid || null;
        console.warn(
          `[INTER-PIX] Idempotência: agendamento ${zykorId} já possui PIX (bar ${jaEnviado.bar_id}, status ${jaEnviado.inter_status}). Reenvio bloqueado.`
        );
        return NextResponse.json({
          success: true,
          message: 'PIX já enviado para este pagamento — reenvio bloqueado (idempotência).',
          data: {
            codigoSolicitacao: codigoExistente,
            valor: Number(jaEnviado.valor) || valorNumerico,
            chave: tipoChave.chaveFormatada,
            tipoChave: tipoChave.tipo,
            status: jaEnviado.status,
            agendado: jaEnviado.status === 'agendado',
            destinatario,
            dedupe: true,
          },
        });
      }
    }

    // ============================================================
    // GUARDA DE QUASE-DUPLICATA — mesmo beneficiário + valor + data de pagamento
    // já enviado nas últimas 24h (qualquer bar, mesmo sendo item/linha diferente).
    // Cobre o caso de RE-DIGITAR o pagamento como uma nova linha (id novo), que a
    // trava por item acima não pega. Não bloqueia de vez: exige confirmação
    // explícita (confirmar_duplicata=true) — repasses legítimos iguais seguem OK.
    // ============================================================
    const dataPagamentoIso =
      typeof data_pagamento === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data_pagamento)
        ? data_pagamento.slice(0, 10)
        : null;
    if (zykorId && body.confirmar_duplicata !== true) {
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let q = (supabase.schema('financial' as any) as any)
        .from('pix_enviados')
        .select('inter_codigo_solicitacao, txid, bar_id, valor, data_envio, inter_status, pagamento_zykor_id')
        .neq('status', 'erro')
        .eq('valor', valorNumerico)
        .eq('beneficiario->>chave', tipoChave.chaveFormatada)
        .gte('data_envio', desde)
        .order('data_envio', { ascending: false })
        .limit(1);
      if (dataPagamentoIso) q = q.eq('data_pagamento', dataPagamentoIso);
      const { data: similar } = await q.maybeSingle();

      if (similar) {
        console.warn(
          `[INTER-PIX] Possível duplicata: chave ${tipoChave.chaveFormatada} valor ${valorNumerico} já enviado em ${similar.data_envio} (bar ${similar.bar_id}).`
        );
        return NextResponse.json(
          {
            success: false,
            code: 'possivel_duplicata',
            error:
              `Possível duplicata: já saiu um PIX de R$ ${valorNumerico.toFixed(2)} para esta chave ` +
              `em ${new Date(similar.data_envio).toLocaleString('pt-BR')} (bar ${similar.bar_id}, status ${similar.inter_status}).`,
            similar: {
              codigoSolicitacao: similar.inter_codigo_solicitacao || similar.txid,
              bar_id: similar.bar_id,
              data_envio: similar.data_envio,
              inter_status: similar.inter_status,
            },
          },
          { status: 409 }
        );
      }
    }

    // Chave de idempotência ESTÁVEL enviada ao Inter (dedupe também no lado do banco).
    // Deriva do item + valor + chave; NÃO inclui bar_id de propósito (o bar pode
    // trocar). O retry de ambiguidade usa outra chave PIX, então ganha uma chave de
    // idempotência distinta — senão o banco devolveria a resposta cacheada do erro.
    const centsIdem = Math.round(valorNumerico * 100);
    const idempotencyKey = zykorId
      ? idempotenciaDeterministica(`pix:${zykorId}:${centsIdem}:${tipoChave.chaveFormatada}`)
      : undefined;
    const idempotencyKeyAlt = zykorId && tipoChave.chaveAlternativa
      ? idempotenciaDeterministica(`pix:${zykorId}:${centsIdem}:${tipoChave.chaveAlternativa}`)
      : undefined;

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

    // Resolver credencial (envelope: client_secret + cert/key descriptografados em runtime
    // com a chave-mestra do Vercel; nada utilizável vem do Supabase)
    let resolved;
    try {
      resolved = await resolveInterCredential(credenciais);
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e?.message || 'Falha ao resolver credencial Inter' },
        { status: 400 }
      );
    }
    const clientId = resolved.clientId;
    const clientSecret = resolved.clientSecret;
    const contaCorrente = resolved.contaCorrente;
    const credencialDebug = {
      credencial_id: resolved.id,
      empresa_nome: resolved.empresaNome,
      conta_corrente: contaCorrente || null,
    };

    if (!clientId || !clientSecret || !contaCorrente) {
      return NextResponse.json(
        { success: false, error: 'Credenciais Inter incompletas (client_id/client_secret/conta_corrente)' },
        { status: 400 }
      );
    }

    try {
      // 1. Obter access_token via OAuth2 com mTLS (cert/key já descriptografados)
      const mtlsCredentials = resolved.mtls;

      // Se o body tiver force_new_token, limpar cache primeiro
      const forceNewToken = body.force_new_token;
      if (forceNewToken) {
        clearInterTokenCache();
      }

      let accessToken = await getInterAccessToken(
        clientId,
        clientSecret,
        'pagamento-pix.write',
        mtlsCredentials || undefined
      );

      // 2. Realizar pagamento PIX (com agendamento se data_pagamento for futura)
      let resultadoPix = await realizarPagamentoPixInter({
        token: accessToken,
        contaCorrente: contaCorrente,
        valor: valorNumerico,
        descricao: descricao || `Pagamento PIX para ${destinatario || 'beneficiário'}`,
        chave: tipoChave.chaveFormatada,
        dataPagamento: typeof data_pagamento === 'string' ? data_pagamento : undefined,
        mtlsCredentials: mtlsCredentials || undefined,
        idempotencyKey,
      });

      // Retry automático se token cached for de cert antigo (após troca de cert+key)
      const erroCertificado = !resultadoPix.success && /not bound to a valid|recognized certificate/i.test(resultadoPix.error || '');
      if (erroCertificado) {
        console.log('[INTER-PIX] Token cached parece estar atrelado a cert antigo. Limpando cache e re-tentando...');
        clearInterTokenCache();
        accessToken = await getInterAccessToken(
          clientId,
          clientSecret,
          'pagamento-pix.write',
          mtlsCredentials || undefined
        );
        resultadoPix = await realizarPagamentoPixInter({
          token: accessToken,
          contaCorrente: contaCorrente,
          valor: valorNumerico,
          descricao: descricao || `Pagamento PIX para ${destinatario || 'beneficiário'}`,
          chave: tipoChave.chaveFormatada,
          dataPagamento: typeof data_pagamento === 'string' ? data_pagamento : undefined,
          mtlsCredentials: mtlsCredentials || undefined,
          idempotencyKey,
        });
      }

      // Retry de AMBIGUIDADE de chave: 11 dígitos podem ser CPF e celular ao mesmo
      // tempo. Se o Inter não achou a chave no formato escolhido, re-tenta com o
      // alternativo. Seguro: "chave não cadastrada" é falha de lookup no DICT —
      // nenhum pagamento foi executado, então não há risco de pagar em dobro.
      const chaveNaoEncontrada =
        !resultadoPix.success &&
        !!tipoChave.chaveAlternativa &&
        /n[ãa]o\s+cadastrada|n[ãa]o\s+encontrada|not\s+registered|not\s+found|chave\s+inv[áa]lida/i.test(
          resultadoPix.error || ''
        );
      if (chaveNaoEncontrada) {
        console.log(
          `[INTER-PIX] Chave não encontrada como ${tipoChave.tipo}; re-tentando com formato alternativo (${tipoChave.chaveAlternativa}).`
        );
        resultadoPix = await realizarPagamentoPixInter({
          token: accessToken,
          contaCorrente: contaCorrente,
          valor: valorNumerico,
          descricao: descricao || `Pagamento PIX para ${destinatario || 'beneficiário'}`,
          chave: tipoChave.chaveAlternativa as string,
          dataPagamento: typeof data_pagamento === 'string' ? data_pagamento : undefined,
          mtlsCredentials: mtlsCredentials || undefined,
          idempotencyKey: idempotencyKeyAlt,
        });
      }

      if (!resultadoPix.success) {
        console.error('[INTER-PIX] Erro no pagamento:', resultadoPix.error);

        // Salvar erro no banco para tracking (schema correto: financial.pix_enviados)
        await (supabase.schema('financial' as any) as any).from('pix_enviados').insert({
          txid: `ERR_${Date.now()}`,
          bar_id,
          valor: valorNumerico,
          // Credencial REALMENTE usada (pode diferir da pedida após o fallback por bar).
          inter_credencial_id: resolved?.id ?? credentialId ?? null,
          inter_status: 'ERRO',
          data_pagamento: typeof data_pagamento === 'string' ? data_pagamento : null,
          pagamento_zykor_id: typeof body.agendamento_id === 'string' ? body.agendamento_id : null,
          beneficiario: {
            nome: destinatario || 'Não informado',
            chave: tipoChave.chaveFormatada,
            tipoChave: tipoChave.tipo,
            descricao: descricao || 'Pagamento PIX',
            erro: resultadoPix.error
          },
          data_envio: new Date().toISOString(),
          status: 'erro',
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

      // Salvar no banco financial.pix_enviados (schema correto + campos pra webhook tracking)
      // dataPagamentoIso já calculado acima (guarda de quase-duplicata).
      const isAgendado =
        !!dataPagamentoIso &&
        dataPagamentoIso > new Date().toISOString().slice(0, 10);
      const { error: insertError } = await (supabase
        .schema('financial' as any) as any)
        .from('pix_enviados')
        .insert({
          txid: codigoSolicitacao,
          bar_id,
          valor: valorNumerico,
          // Credencial REALMENTE usada (pode diferir da pedida após o fallback por bar).
          inter_credencial_id: resolved?.id ?? credentialId ?? null,
          inter_codigo_solicitacao: codigoSolicitacao,
          inter_status: isAgendado ? 'AGENDADO' : 'ENVIADO',
          data_pagamento: dataPagamentoIso,
          pagamento_zykor_id: typeof body.agendamento_id === 'string' ? body.agendamento_id : null,
          beneficiario: {
            nome: destinatario || 'Não informado',
            chave: tipoChave.chaveFormatada,
            tipoChave: tipoChave.tipo,
            descricao: descricao || 'Pagamento PIX',
          },
          data_envio: new Date().toISOString(),
          status: isAgendado ? 'agendado' : 'enviado',
        });

      if (insertError) {
        console.error('[INTER-PIX] Erro ao salvar no banco:', insertError);
      }


      return NextResponse.json({
        success: true,
        message: 'PIX enviado com sucesso',
        data: {
          codigoSolicitacao,
          valor: valorNumerico,
          chave: tipoChave.chaveFormatada,
          tipoChave: tipoChave.tipo,
          status: isAgendado ? 'agendado' : 'enviado',
          agendado: isAgendado,
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
