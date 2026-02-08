import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

// Cache de suppliers por bar_id (válido por 5 minutos)
// Exportado como global para poder ser limpo de outras rotas
declare global {
  var suppliersCache: Map<number, { suppliers: any[], timestamp: number }> | undefined;
}

if (!global.suppliersCache) {
  global.suppliersCache = new Map();
}

const suppliersCache = global.suppliersCache;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Função para limpar o cache (chamada após criar supplier)
export function clearSuppliersCache(barId?: number) {
  if (barId !== undefined) {
    suppliersCache.delete(barId);
    console.log(`[BUSCAR-STAKEHOLDER] Cache limpo para bar_id=${barId}`);
  } else {
    suppliersCache.clear();
    console.log(`[BUSCAR-STAKEHOLDER] Cache completo limpo`);
  }
}

// Buscar todos suppliers com paginação e cache
async function getAllSuppliers(barId: number, apiToken: string): Promise<any[]> {
  // Verificar cache
  const cached = suppliersCache.get(barId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[BUSCAR-STAKEHOLDER] Usando cache: ${cached.suppliers.length} suppliers`);
    return cached.suppliers;
  }
  
  // Buscar com paginação
  let allSuppliers: any[] = [];
  let skip = 0;
  const pageSize = 500;
  let hasMore = true;
  
  console.log(`[BUSCAR-STAKEHOLDER] Buscando suppliers do NIBO (paginado)...`);
  
  while (hasMore) {
    const niboUrl = `${NIBO_BASE_URL}/suppliers?apitoken=${apiToken}&$top=${pageSize}&$skip=${skip}`;
    
    const response = await fetch(niboUrl, {
      headers: {
        'accept': 'application/json',
        'apitoken': apiToken
      }
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody.substring(0, 500);
      } catch { }
      console.error(`[BUSCAR-STAKEHOLDER] Erro NIBO ${response.status}: ${errorDetails}`);
      throw new Error(`Erro NIBO: ${response.status}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }

    const niboData = await response.json();
    const pageSuppliers = niboData.items || niboData || [];
    
    allSuppliers = [...allSuppliers, ...pageSuppliers];
    
    // Se retornou menos que o pageSize, não há mais páginas
    if (pageSuppliers.length < pageSize) {
      hasMore = false;
    } else {
      skip += pageSize;
    }
    
    // Limite de segurança: máximo 10 páginas (5000 suppliers)
    if (skip >= 5000) {
      hasMore = false;
    }
  }
  
  console.log(`[BUSCAR-STAKEHOLDER] Total: ${allSuppliers.length} suppliers carregados`);
  
  // Salvar no cache
  suppliersCache.set(barId, { suppliers: allSuppliers, timestamp: Date.now() });
  
  return allSuppliers;
}

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
function extrairDocumento(chavePix: string): string | null {
  const digits = chavePix.replace(/\D/g, '');
  
  if (digits.length === 11 && validarCpf(digits)) {
    return digits;
  }
  
  if (digits.length === 14 && validarCnpj(digits)) {
    return digits;
  }
  
  return null;
}

// Normalizar nome para comparação (remove acentos, maiúsculas, substitui variações)
function normalizarNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[ÇĆĈĊČ]/g, 'C')
    .replace(/[ŚŜŞŠ]/g, 'S')
    .replace(/[ŹŻŽ]/g, 'Z')
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
}

// Calcular similaridade entre nomes (Dice coefficient simplificado)
function calcularSimilaridade(nome1: string, nome2: string): number {
  const n1 = normalizarNome(nome1);
  const n2 = normalizarNome(nome2);
  
  if (n1 === n2) return 1.0;
  
  // Dividir em palavras e comparar
  const palavras1 = n1.split(' ').filter(p => p.length > 2);
  const palavras2 = n2.split(' ').filter(p => p.length > 2);
  
  let matches = 0;
  for (const p1 of palavras1) {
    if (palavras2.some(p2 => p2 === p1 || p2.includes(p1) || p1.includes(p2))) {
      matches++;
    }
  }
  
  const maxPalavras = Math.max(palavras1.length, palavras2.length);
  return maxPalavras > 0 ? matches / maxPalavras : 0;
}

// POST - Buscar stakeholder por CPF/CNPJ ou nome no NIBO
export async function POST(request: NextRequest) {
  try {
    const { nome, chave_pix, bar_id = 3 } = await request.json();

    if (!nome) {
      return NextResponse.json(
        { success: false, error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    const credencial = await getNiboCredentials(bar_id);
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas' },
        { status: 400 }
      );
    }

    // Buscar suppliers com cache
    const suppliers = await getAllSuppliers(bar_id, credencial.api_token);

    let found: any = null;
    let matchType = '';

    // ETAPA 1: Tentar buscar por CPF/CNPJ (se a chave PIX for documento)
    if (chave_pix) {
      // Limpar a chave PIX de possíveis caracteres invisíveis
      const chaveLimpa = chave_pix.toString().trim().replace(/\s+/g, ' ');
      const documento = extrairDocumento(chaveLimpa);
      
      if (documento) {
        // Buscar por documento
        for (const s of suppliers) {
          const docNibo = (s.document?.number || '').replace(/\D/g, '');
          if (docNibo === documento) {
            found = s;
            matchType = 'CPF/CNPJ';
            break;
          }
        }
      }
    }

    // ETAPA 2: Se não encontrou por documento, buscar por nome exato
    if (!found) {
      const nomeBusca = normalizarNome(nome);
      
      found = suppliers.find((s: any) => 
        normalizarNome(s.name || '') === nomeBusca
      );
      
      if (found) {
        matchType = 'nome exato';
      }
    }

    // ETAPA 3: Se não encontrou exato, buscar por similaridade alta (>= 80%)
    if (!found) {
      let melhorMatch: any = null;
      let melhorScore = 0;
      
      for (const s of suppliers) {
        const score = calcularSimilaridade(nome, s.name || '');
        if (score > melhorScore) {
          melhorScore = score;
          melhorMatch = s;
        }
      }
      
      // Aceitar se similaridade >= 80%
      if (melhorScore >= 0.8 && melhorMatch) {
        found = melhorMatch;
        matchType = `similaridade ${Math.round(melhorScore * 100)}%`;
      }
    }

    // ETAPA 4: Busca parcial - nome contém ou é contido
    if (!found) {
      const nomeBusca = normalizarNome(nome);
      
      found = suppliers.find((s: any) => {
        const nomeSupplier = normalizarNome(s.name || '');
        // Buscar se um contém o outro (para nomes parciais)
        return nomeSupplier.includes(nomeBusca) || nomeBusca.includes(nomeSupplier);
      });
      
      if (found) {
        matchType = 'nome parcial';
      }
    }

    if (found) {
      console.log(`[BUSCAR-STAKEHOLDER] ✓ "${nome}" -> "${found.name}" (${matchType})`);
      return NextResponse.json({
        success: true,
        found: true,
        matchType,
        stakeholder: {
          id: found.id,
          name: found.name,
          document: found.document?.number || '',
          type: found.type || 'Supplier',
          pixKey: found.bankAccountInformation?.pixKey || null
        }
      });
    }

    console.log(`[BUSCAR-STAKEHOLDER] ✗ "${nome}" não encontrado`);
    return NextResponse.json({
      success: true,
      found: false,
      stakeholder: null,
      message: `Supplier "${nome}" não encontrado no NIBO. Cadastre primeiro.`
    });

  } catch (error) {
    console.error('[BUSCAR-STAKEHOLDER] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar stakeholder' },
      { status: 500 }
    );
  }
}
