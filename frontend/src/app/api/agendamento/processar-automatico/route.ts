import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';
import { realizarPagamentoPixInter } from '@/lib/inter/pixPayment';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapeamento de bar_id por nome
const BAR_IDS: Record<string, number> = {
  'Ordinário': 3,
  'Deboche': 4,
};

// Buscar credenciais do Banco Inter do banco de dados
async function getInterCredentials(barId: number): Promise<{
  client_id: string;
  client_secret: string;
  configuracoes?: any;
} | null> {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('client_id, client_secret, configuracoes')
    .eq('sistema', 'inter')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !data?.client_id || !data?.client_secret) {
    console.error(`[INTER] Credenciais não encontradas para bar_id ${barId}:`, error);
    return null;
  }

  return data;
}

// Funções de validação (convertidas do Python)
function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11 || cpf === cpf[0].repeat(11)) {
    return false;
  }
  
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf[i]) * (10 - i);
  }
  const d1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (parseInt(cpf[9]) !== d1) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf[i]) * (11 - i);
  }
  const d2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return parseInt(cpf[10]) === d2;
}

function validarCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || cnpj === cnpj[0].repeat(14)) {
    return false;
  }
  
  const pesos1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj[i]) * pesos1[i];
  }
  const d1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (parseInt(cnpj[12]) !== d1) return false;
  
  const pesos2 = [6, ...pesos1];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj[i]) * pesos2[i];
  }
  const d2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return parseInt(cnpj[13]) === d2;
}

function validarTelefoneCelular(num: string): boolean {
  const n = num.replace(/\D/g, '');
  return n.length === 11 && n[2] === '9' && parseInt(n.slice(0, 2)) >= 11 && parseInt(n.slice(0, 2)) <= 99;
}

function limparValor(valor: string): number {
  return parseFloat(valor.replace(/R\$/, '').replace(/\./g, '').replace(',', '.').trim());
}

function identificarTipoChave(chave: string): { tipo: string | null; chaveFormatada: string } {
  if (!chave) return { tipo: null, chaveFormatada: chave };
  
  const chaveClean = chave.trim();
  
  // Email
  if (chaveClean.includes('@') && /^[\w\.-]+@[\w\.-]+\.\w{2,4}$/.test(chaveClean)) {
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
  
  // Telefone
  if (validarTelefoneCelular(digits)) {
    return { tipo: 'TELEFONE', chaveFormatada: `+55${digits}` };
  }
  
  // Chave aleatória
  if (chaveClean.length >= 32 || chaveClean.includes('-')) {
    return { tipo: 'ALEATORIA', chaveFormatada: chaveClean };
  }
  
  return { tipo: null, chaveFormatada: chave };
}

// Função para converter tipo de chave PIX para formato NIBO
function getTipoPixNibo(tipo: string): number {
  switch (tipo) {
    case 'CPF': return 1;
    case 'CNPJ': return 2;
    case 'EMAIL': return 3;
    case 'TELEFONE': return 4;
    case 'ALEATORIA': return 5;
    default: return 3; // Email como padrão
  }
}

// Função para obter token do Inter (usando mTLS real)
async function obterAccessToken(config: any, conta: string, bar_id: number): Promise<string> {
  console.log('🔑 Obtendo token Inter para:', {
    conta,
    bar_id,
    conta_corrente: config.CONTA_CORRENTE
  });
  
  // Usar função real com mTLS
  const token = await getInterAccessToken(
    config.CLIENT_ID,
    config.CLIENT_SECRET,
    'pagamento-pix.write'
  );
  
  return token;
}

// Função para enviar PIX (usando mTLS real)
async function enviarPix(config: any, token: string, payload: any): Promise<{ success: boolean; codigoSolicitacao?: string; error?: string }> {
  console.log('💸 Enviando PIX real:', payload);
  
  // Usar função real com mTLS
  const resultado = await realizarPagamentoPixInter({
    token: token,
    contaCorrente: config.CONTA_CORRENTE,
    valor: parseFloat(payload.valor),
    descricao: payload.descricao,
    chave: payload.destinatario.chave
  });
  
  if (resultado.success) {
    return {
      success: true,
      codigoSolicitacao: resultado.data?.codigoSolicitacao || resultado.data?.endToEndId || `PIX_${Date.now()}`
    };
  } else {
    return {
      success: false,
      error: resultado.error || 'Erro na API Inter'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      conta, 
      chave_pix, 
      nome_beneficiario, 
      valor, 
      descricao, 
      data_pagamento, 
      data_competencia,
      categoria_id,
      centro_custo_id 
    } = await request.json();

    console.log('🔍 Dados recebidos na API:', {
      conta: conta + ' (tipo: ' + typeof conta + ')',
      chave_pix: chave_pix + ' (tipo: ' + typeof chave_pix + ')',
      nome_beneficiario: nome_beneficiario + ' (tipo: ' + typeof nome_beneficiario + ')',
      valor: valor + ' (tipo: ' + typeof valor + ')',
      categoria_id: categoria_id + ' (tipo: ' + typeof categoria_id + ')',
      centro_custo_id: centro_custo_id + ' (tipo: ' + typeof centro_custo_id + ')',
    });

    console.log('🔍 Validação individual de campos:', {
      conta_ok: !!conta,
      chave_pix_ok: !!chave_pix,
      nome_beneficiario_ok: !!nome_beneficiario,
      valor_ok: !!valor,
      categoria_id_ok: !!categoria_id,
      centro_custo_id_ok: !!centro_custo_id,
    });

    // Validar dados de entrada
    // centro_custo_id é opcional
    if (!conta || !chave_pix || !nome_beneficiario || !valor || !categoria_id) {
      console.log('❌ Validação falhou - campos faltando:', {
        conta: !conta ? 'FALTANDO' : 'OK',
        chave_pix: !chave_pix ? 'FALTANDO' : 'OK',
        nome_beneficiario: !nome_beneficiario ? 'FALTANDO' : 'OK',
        valor: !valor ? 'FALTANDO' : 'OK',
        categoria_id: !categoria_id ? 'FALTANDO' : 'OK',
        centro_custo_id: centro_custo_id || 'NÃO INFORMADO (opcional)',
      });
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios faltando (conta, chave_pix, nome_beneficiario, valor, categoria_id)'
      }, { status: 400 });
    }

    // Mapear conta para bar_id
    const bar_id = BAR_IDS[conta as keyof typeof BAR_IDS];
    
    if (!bar_id) {
      return NextResponse.json({
        success: false,
        error: 'Conta não configurada'
      }, { status: 400 });
    }

    // Buscar credenciais do Banco Inter do banco de dados
    const interCredentials = await getInterCredentials(bar_id);
    
    if (!interCredentials) {
      console.error(`[INTER] Credenciais não encontradas para ${conta} (bar_id: ${bar_id})`);
      return NextResponse.json({
        success: false,
        error: `Credenciais do Banco Inter não configuradas para ${conta}`
      }, { status: 400 });
    }
    
    // Criar objeto config compatível com funções existentes
    const config = {
      CLIENT_ID: interCredentials.client_id,
      CLIENT_SECRET: interCredentials.client_secret,
      CONTA_CORRENTE: interCredentials.configuracoes?.conta_corrente || ''
    };

    // Processar chave PIX
    const { tipo, chaveFormatada } = identificarTipoChave(chave_pix);
    
    console.log('🔍 Debug chave PIX:', {
      chave_original: chave_pix,
      chave_limpa: chave_pix.replace(/\D/g, ''),
      tipo_identificado: tipo,
      chave_formatada: chaveFormatada
    });
    
    if (!tipo) {
      return NextResponse.json({
        success: false,
        error: `Chave PIX inválida: ${chave_pix} (${chave_pix.replace(/\D/g, '')})`
      }, { status: 400 });
    }

    // Processar valor
    let valorNumerico: number;
    try {
      valorNumerico = limparValor(valor);
      if (valorNumerico <= 0) {
        throw new Error('Valor deve ser maior que zero');
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Valor inválido'
      }, { status: 400 });
    }

    // Processar datas
    let dataPagamentoFormatada = '';
    let dataCompetenciaFormatada = '';
    
    if (data_pagamento) {
      try {
        const [dia, mes, ano] = data_pagamento.split('/');
        dataPagamentoFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      } catch (error) {
        dataPagamentoFormatada = new Date().toISOString().split('T')[0];
      }
    } else {
      dataPagamentoFormatada = new Date().toISOString().split('T')[0];
    }

    if (data_competencia) {
      try {
        const [dia, mes, ano] = data_competencia.split('/');
        dataCompetenciaFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      } catch (error) {
        dataCompetenciaFormatada = dataPagamentoFormatada; // Usar data de pagamento como fallback
      }
    } else {
      dataCompetenciaFormatada = dataPagamentoFormatada;
    }

    // 1. PRIMEIRO: Buscar/Criar stakeholder no NIBO
    console.log('🔍 Verificando stakeholder no NIBO...');
    let stakeholderId: string | null = null;
    
    // Usar URL base para chamadas internas - prioriza variável de ambiente, depois Vercel, depois produção
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zykor.com.br');
    
    try {
      // Determinar CPF/CNPJ para buscar stakeholder
      // Se a chave PIX é CPF/CNPJ, usar ela como documento
      // Caso contrário, buscar pelo nome do beneficiário
      const cpfCnpj = (tipo === 'CPF' || tipo === 'CNPJ') ? chaveFormatada : '';
      const queryParam = cpfCnpj || encodeURIComponent(nome_beneficiario);
      
      console.log(`🔍 Buscando stakeholder por: ${cpfCnpj ? 'CPF/CNPJ' : 'nome'} = ${queryParam}`);
      
      const stakeholderResponse = await fetch(`${baseUrl}/api/financeiro/nibo/stakeholders?q=${queryParam}&bar_id=${bar_id}`);
      const stakeholderData = await stakeholderResponse.json();

      if (stakeholderData.success && stakeholderData.data.length > 0) {
        const stakeholder = stakeholderData.data[0];
        stakeholderId = stakeholder.id;
        console.log('✅ Stakeholder encontrado no NIBO:', stakeholderId);
        
        // Verificar se precisa atualizar chave PIX
        if (stakeholder.pixKey !== chaveFormatada) {
          console.log('🔄 Atualizando chave PIX do stakeholder...');
          const updateResponse = await fetch(`${baseUrl}/api/financeiro/nibo/stakeholders/${stakeholderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pixKey: chaveFormatada,
              pixKeyType: getTipoPixNibo(tipo)
            }),
          });
          
          if (updateResponse.ok) {
            console.log('✅ Chave PIX atualizada com sucesso');
          } else {
            console.log('⚠️ Erro ao atualizar chave PIX, mas continuando...');
          }
        } else {
          console.log('✅ Chave PIX já está correta');
        }
      } else {
        // Tentar criar novo stakeholder apenas se temos CPF/CNPJ
        if (cpfCnpj) {
          console.log('📝 Criando novo stakeholder com chave PIX...');
          const novoStakeholder = {
            name: nome_beneficiario,
            document: cpfCnpj,
            type: 'fornecedor' as const,
            bar_id: bar_id,
            pixKey: chaveFormatada,
            pixKeyType: getTipoPixNibo(tipo)
          };

          console.log('📤 Payload do novo stakeholder:', novoStakeholder);

          const createResponse = await fetch(`${baseUrl}/api/financeiro/nibo/stakeholders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoStakeholder),
          });

          const createData = await createResponse.json();
          if (createData.success) {
            stakeholderId = createData.data.id;
            console.log('✅ Stakeholder criado com chave PIX:', stakeholderId);
          } else {
            // Não bloquear, apenas logar warning
            console.warn('⚠️ Não foi possível criar stakeholder, continuando sem:', createData.error);
          }
        } else {
          // Chave PIX não é CPF/CNPJ, não temos documento para criar stakeholder
          console.log('⚠️ Chave PIX é email/telefone/aleatória - continuando sem stakeholder vinculado');
        }
      }
    } catch (error) {
      // Não bloquear pagamento por erro de stakeholder
      console.warn('⚠️ Erro ao verificar/criar stakeholder (continuando):', error);
    }

    // 2. SEGUNDO: Criar agendamento no NIBO
    console.log('📅 Criando agendamento no NIBO...');
    let niboAgendamentoId: string | null = null;
    
    try {
      // Validar categoria_id ANTES de criar agendamento
      if (!categoria_id) {
        throw new Error('categoria_id é obrigatório para criar agendamento no NIBO');
      }

      // Usar a mesma estrutura do botão "Agendar no NIBO" funcional
      // IMPORTANTE: NÃO passar 'categories' - a API /schedules usa categoria_id diretamente
      const agendamento = {
        stakeholderId: stakeholderId,
        stakeholder_nome: nome_beneficiario, // Para buscar por nome se stakeholderId for null
        dueDate: dataPagamentoFormatada,
        scheduleDate: dataPagamentoFormatada,
        categoria_id: categoria_id, // OBRIGATÓRIO - ID da categoria no NIBO
        centro_custo_id: centro_custo_id || '',
        accrualDate: dataCompetenciaFormatada,
        value: valorNumerico,
        description: descricao || `Pagamento PIX para ${nome_beneficiario}`,
        reference: `PIX_${Date.now()}`,
        bar_id: bar_id, // Importante: passar o bar_id correto
      };

      console.log('📋 Payload para NIBO:', agendamento);
      console.log('🔍 Validação de campos obrigatórios:', {
        stakeholderId: !!stakeholderId,
        dueDate: !!dataPagamentoFormatada,
        scheduleDate: !!dataPagamentoFormatada,
        categoria_id: !!categoria_id,
        categoria_id_valor: categoria_id,
        centro_custo_id: !!centro_custo_id,
        value: !!valorNumerico,
        bar_id: bar_id
      });

      const niboResponse = await fetch(`${baseUrl}/api/financeiro/nibo/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agendamento)
      });

      if (!niboResponse.ok) {
        const errorText = await niboResponse.text();
        throw new Error(`Erro HTTP ${niboResponse.status}: ${errorText}`);
      }

      const niboResult = await niboResponse.json();
      niboAgendamentoId = niboResult.data?.id || niboResult.id;
      
      console.log('✅ Agendamento NIBO criado com sucesso:', niboAgendamentoId);
      
    } catch (error) {
      console.error('❌ Erro ao criar agendamento NIBO:', error);
      return NextResponse.json({
        success: false,
        error: `Erro ao criar agendamento no NIBO: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }, { status: 500 });
    }

    // 3. TERCEIRO: Obter token do Inter
    const token = await obterAccessToken(config, conta, bar_id);

    // 4. QUARTO: Preparar payload para o PIX
    const payload = {
      valor: valorNumerico.toString(),
      descricao: descricao || `Pagamento para ${nome_beneficiario}`,
      dataPagamento: dataPagamentoFormatada,
      destinatario: {
        tipo: 'CHAVE',
        chave: chaveFormatada
      }
    };

    // Tentar enviar PIX
    let resultado = await enviarPix(config, token, payload);

    // Se falhou e é 11 dígitos, tentar como telefone também
    if (!resultado.success && chave_pix.replace(/\D/g, '').length === 11) {
      console.log('🔄 Tentando como telefone...');
      const payloadTelefone = {
        ...payload,
        destinatario: {
          tipo: 'CHAVE',
          chave: `+55${chave_pix.replace(/\D/g, '')}`
        }
      };
      resultado = await enviarPix(config, token, payloadTelefone);
    }

    if (resultado.success) {
      return NextResponse.json({
        success: true,
        codigoSolicitacao: resultado.codigoSolicitacao,
        niboAgendamentoId,
        message: `Agendamento NIBO criado e PIX enviado com sucesso para ${nome_beneficiario}`,
        detalhes: {
          bar_id,
          conta,
          agendamento_nibo: niboAgendamentoId,
          codigo_pix: resultado.codigoSolicitacao,
          data_pagamento: dataPagamentoFormatada,
          data_competencia: dataCompetenciaFormatada,
          valor: valorNumerico
        }
      });
    } else {
      // Se o PIX falhou, idealmente deveria reverter o agendamento NIBO
      console.error('❌ PIX falhou, mas agendamento NIBO já foi criado:', niboAgendamentoId);
      return NextResponse.json({
        success: false,
        error: `Agendamento NIBO criado (${niboAgendamentoId}), mas PIX falhou: ${resultado.error || 'Erro desconhecido'}`
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Erro na API de processamento automático:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
