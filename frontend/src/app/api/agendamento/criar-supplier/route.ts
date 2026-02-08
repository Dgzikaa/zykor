import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearSuppliersCache } from '../buscar-stakeholder/route';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

// Buscar credenciais do NIBO
async function getNiboCredentials(barId: number) {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('api_token')
    .eq('sistema', 'nibo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !data?.api_token) {
    return null;
  }
  return data;
}

// Validar CPF
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

// Validar CNPJ
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

// Extrair CPF/CNPJ da chave PIX
function extrairDocumento(chavePix: string): { number: string; type: string } | null {
  const digits = chavePix.replace(/\D/g, '');
  
  if (digits.length === 11 && validarCpf(digits)) {
    return { number: digits, type: 'CPF' };
  }
  
  if (digits.length === 14 && validarCnpj(digits)) {
    return { number: digits, type: 'CNPJ' };
  }
  
  return null;
}

// Validar e formatar chave PIX para o NIBO
// Retorna null se a chave não for válida/suportada
function validarEFormatarPixKey(chavePix: string): { pixKey: string; pixKeyType: number } | null {
  const trimmed = chavePix.trim();
  const digits = trimmed.replace(/\D/g, '');
  
  // CPF válido (11 dígitos)
  if (digits.length === 11 && validarCpf(digits)) {
    return { pixKey: digits, pixKeyType: 3 };
  }
  
  // CNPJ válido (14 dígitos)
  if (digits.length === 14 && validarCnpj(digits)) {
    return { pixKey: digits, pixKeyType: 3 };
  }
  
  // Email (contém @)
  if (trimmed.includes('@') && trimmed.includes('.')) {
    return { pixKey: trimmed.toLowerCase(), pixKeyType: 2 };
  }
  
  // Telefone - precisa ter formato +55XXXXXXXXXXX (13 dígitos com código do país)
  // Se tiver 10-11 dígitos, adiciona +55
  if (digits.length >= 10 && digits.length <= 11) {
    const telefoneFormatado = `+55${digits}`;
    return { pixKey: telefoneFormatado, pixKeyType: 1 };
  }
  
  // Chave aleatória (UUID) - formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return { pixKey: trimmed, pixKeyType: 4 };
  }
  
  // Chave não reconhecida/inválida - não enviar para o NIBO
  console.log(`[CRIAR-SUPPLIER] Chave PIX não suportada: "${chavePix}"`);
  return null;
}

// POST - Criar supplier no NIBO
export async function POST(request: NextRequest) {
  try {
    const { nome, chave_pix, bar_id = 3 } = await request.json();

    if (!nome) {
      return NextResponse.json(
        { success: false, error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`[CRIAR-SUPPLIER] Criando "${nome}" (chave_pix: ${chave_pix || 'N/A'}) no bar_id=${bar_id}`);

    const credencial = await getNiboCredentials(bar_id);
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas' },
        { status: 400 }
      );
    }

    // Extrair documento da chave PIX (se for CPF/CNPJ)
    const documento = chave_pix ? extrairDocumento(chave_pix) : null;
    
    // Validar e formatar chave PIX
    const pixInfo = chave_pix ? validarEFormatarPixKey(chave_pix) : null;
    
    // Montar payload para criar supplier
    const supplierPayload: any = {
      name: nome.trim()
    };
    
    // Adicionar documento se disponível
    if (documento) {
      supplierPayload.document = {
        number: documento.number,
        type: documento.type
      };
    }
    
    // Adicionar informações bancárias/PIX APENAS se a chave for válida
    if (pixInfo) {
      supplierPayload.bankAccountInformation = {
        pixKey: pixInfo.pixKey,
        pixKeyType: pixInfo.pixKeyType
      };
      console.log(`[CRIAR-SUPPLIER] PIX válido: ${pixInfo.pixKey} (tipo ${pixInfo.pixKeyType})`);
    } else if (chave_pix) {
      console.log(`[CRIAR-SUPPLIER] PIX ignorado (formato inválido): ${chave_pix}`);
    }

    console.log(`[CRIAR-SUPPLIER] Payload:`, JSON.stringify(supplierPayload));

    // Criar supplier no NIBO
    const niboUrl = `${NIBO_BASE_URL}/suppliers?apitoken=${credencial.api_token}`;
    
    const response = await fetch(niboUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'apitoken': credencial.api_token
      },
      body: JSON.stringify(supplierPayload)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`[CRIAR-SUPPLIER] Erro NIBO ${response.status}:`, responseText);
      
      // Verificar se o erro é "já existe com esta chave PIX"
      if (responseText.includes('Já existe um fornecedor cadastrado com esta chave PIX')) {
        // Tentar buscar o supplier existente
        console.log(`[CRIAR-SUPPLIER] Supplier já existe com esta chave PIX, buscando...`);
        
        try {
          // Buscar todos suppliers com paginação
          let allSuppliers: any[] = [];
          let skip = 0;
          const pageSize = 500;
          let hasMore = true;
          
          while (hasMore) {
            const searchUrl = `${NIBO_BASE_URL}/suppliers?apitoken=${credencial.api_token}&$top=${pageSize}&$skip=${skip}`;
            const searchResponse = await fetch(searchUrl, {
              headers: {
                'accept': 'application/json',
                'apitoken': credencial.api_token
              }
            });
            
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const pageSuppliers = searchData.items || searchData || [];
              allSuppliers = [...allSuppliers, ...pageSuppliers];
              
              if (pageSuppliers.length < pageSize) {
                hasMore = false;
              } else {
                skip += pageSize;
              }
              
              if (skip >= 5000) hasMore = false;
            } else {
              // API NIBO com erro - logar e parar
              console.error(`[CRIAR-SUPPLIER] Erro ao buscar suppliers: NIBO retornou ${searchResponse.status}`);
              hasMore = false;
              
              // Se não conseguimos buscar suppliers, retornar erro amigável
              if (allSuppliers.length === 0) {
                return NextResponse.json({
                  success: false,
                  error: `Supplier já existe com esta chave PIX no NIBO, mas não foi possível localizá-lo (API NIBO indisponível). Tente novamente em alguns minutos.`,
                  niboError: true
                }, { status: 503 });
              }
            }
          }
          
          console.log(`[CRIAR-SUPPLIER] Buscando "${nome}" entre ${allSuppliers.length} suppliers...`);
          
          // Normalizar nome para comparação
          const nomeNormalizado = nome.trim().toUpperCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          
          console.log(`[CRIAR-SUPPLIER] Nome normalizado: "${nomeNormalizado}"`);
          
          // Buscar pelo PIX formatado ou por nome similar
          const pixFormatado = pixInfo?.pixKey?.toLowerCase();
          let existente: any = null;
          
          // Primeiro tentar por PIX
          if (pixFormatado) {
            existente = allSuppliers.find((s: any) => {
              const pixNibo = (s.bankAccountInformation?.pixKey || '').toLowerCase();
              // Comparar com e sem +55
              return pixNibo === pixFormatado || 
                     pixNibo === pixFormatado.replace('+55', '') ||
                     '+55' + pixNibo === pixFormatado;
            });
          }
          
          // Se não encontrou por PIX, buscar por nome
          if (!existente) {
            existente = allSuppliers.find((s: any) => {
              const nomeNibo = (s.name || '').toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return nomeNibo === nomeNormalizado;
            });
          }
          
          // Se ainda não encontrou, buscar por similaridade de nome
          if (!existente) {
            const palavrasNome = nomeNormalizado.split(' ').filter(p => p.length > 2);
            existente = allSuppliers.find((s: any) => {
              const nomeNibo = (s.name || '').toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const palavrasNibo = nomeNibo.split(' ').filter((p: string) => p.length > 2);
              
              // Contar palavras em comum
              let matches = 0;
              for (const p of palavrasNome) {
                if (palavrasNibo.includes(p)) matches++;
              }
              
              // Se 80% das palavras coincidem
              return matches >= Math.ceil(palavrasNome.length * 0.8);
            });
          }
          
          if (existente) {
            console.log(`[CRIAR-SUPPLIER] ✓ Encontrado supplier existente: ${existente.id} - ${existente.name}`);
            // Limpar cache
            clearSuppliersCache(bar_id);
            return NextResponse.json({
              success: true,
              supplier: {
                id: existente.id,
                name: existente.name,
                document: existente.document?.number || '',
                pixKey: existente.bankAccountInformation?.pixKey || null
              },
              jaExistia: true,
              message: `Supplier "${existente.name}" já existe no NIBO`
            });
          } else {
            // Listar algumas opções para debug
            const opcoesNome = allSuppliers
              .filter((s: any) => {
                const n = (s.name || '').toUpperCase();
                return n.includes(nomeNormalizado.split(' ')[0]) || 
                       nomeNormalizado.includes(n.split(' ')[0]);
              })
              .slice(0, 3)
              .map((s: any) => s.name);
            console.log(`[CRIAR-SUPPLIER] ✗ Não encontrado. Opções similares:`, opcoesNome);
          }
        } catch (searchError) {
          console.error(`[CRIAR-SUPPLIER] Erro ao buscar supplier existente:`, searchError);
        }
      }
      
      return NextResponse.json(
        { success: false, error: `Erro ao criar supplier: ${responseText}` },
        { status: response.status }
      );
    }

    let createdSupplier;
    try {
      createdSupplier = JSON.parse(responseText);
    } catch {
      createdSupplier = { id: responseText };
    }

    const supplierId = createdSupplier.id || createdSupplier;
    const pixStatus = pixInfo ? 'com PIX' : (chave_pix ? 'sem PIX (formato inválido)' : 'sem PIX');
    console.log(`[CRIAR-SUPPLIER] ✓ Supplier criado: ${supplierId} (${pixStatus})`);
    
    // Limpar cache para que a próxima busca encontre o novo supplier
    clearSuppliersCache(bar_id);

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplierId,
        name: nome,
        document: documento?.number || '',
        pixKey: pixInfo?.pixKey || null
      },
      pixIncluido: !!pixInfo,
      message: `Supplier "${nome}" criado com sucesso no NIBO`
    });

  } catch (error) {
    console.error('[CRIAR-SUPPLIER] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao criar supplier' },
      { status: 500 }
    );
  }
}
