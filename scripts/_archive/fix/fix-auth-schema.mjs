#!/usr/bin/env node

/**
 * Script para corrigir referências às tabelas de auth
 * Adiciona .schema('auth_custom') onde necessário
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DIRETORIOS_ALVO = [
  'frontend/src/app/api',
  'frontend/src/lib/auth',
  'frontend/src/middleware',
];

const EXTENSOES = ['.ts', '.tsx'];

// Padrões para substituir
const PADROES = [
  {
    // .from('usuarios') SEM schema antes
    buscar: /(?<!schema\('auth_custom'\)\s{0,50})\n\s*\.from\('usuarios'\)/g,
    substituir: "\n      .schema('auth_custom')\n      .from('usuarios')"
  },
  {
    // .from("usuarios") SEM schema antes
    buscar: /(?<!schema\('auth_custom'\)\s{0,50})\n\s*\.from\("usuarios"\)/g,
    substituir: '\n      .schema(\'auth_custom\')\n      .from("usuarios")'
  },
  {
    // .from('usuarios_bares') SEM schema antes
    buscar: /(?<!schema\('auth_custom'\)\s{0,50})\n\s*\.from\('usuarios_bares'\)/g,
    substituir: "\n      .schema('auth_custom')\n      .from('usuarios_bares')"
  },
  {
    // .from("usuarios_bares") SEM schema antes
    buscar: /(?<!schema\('auth_custom'\)\s{0,50})\n\s*\.from\("usuarios_bares"\)/g,
    substituir: '\n      .schema(\'auth_custom\')\n      .from("usuarios_bares")'
  }
];

async function* listarArquivos(dir) {
  try {
    const arquivos = await readdir(dir, { withFileTypes: true });
    
    for (const arquivo of arquivos) {
      const caminho = join(dir, arquivo.name);
      
      if (arquivo.isDirectory()) {
        if (!arquivo.name.startsWith('.') && arquivo.name !== 'node_modules') {
          yield* listarArquivos(caminho);
        }
      } else {
        const ext = arquivo.name.substring(arquivo.name.lastIndexOf('.'));
        if (EXTENSOES.includes(ext)) {
          yield caminho;
        }
      }
    }
  } catch (error) {
    // Diretório não existe, ignorar
  }
}

async function processarArquivo(caminho) {
  try {
    let conteudo = await readFile(caminho, 'utf-8');
    let modificado = false;
    let substituicoes = [];
    
    for (const padrao of PADROES) {
      const matches = conteudo.match(padrao.buscar);
      if (matches && matches.length > 0) {
        conteudo = conteudo.replace(padrao.buscar, padrao.substituir);
        modificado = true;
        substituicoes.push(`Adicionou schema('auth_custom') (${matches.length}x)`);
      }
    }
    
    if (modificado) {
      await writeFile(caminho, conteudo, 'utf-8');
      return { caminho, substituicoes, modificado: true };
    }
    
    return { caminho, substituicoes: [], modificado: false };
    
  } catch (error) {
    return { caminho, erro: error.message, modificado: false };
  }
}

async function main() {
  console.log('🔐 Corrigindo referências de auth schema...\n');
  
  let totalArquivos = 0;
  let totalModificados = 0;
  const arquivosModificados = [];
  
  for (const dir of DIRETORIOS_ALVO) {
    console.log(`📂 Processando: ${dir}`);
    
    for await (const arquivo of listarArquivos(dir)) {
      totalArquivos++;
      const resultado = await processarArquivo(arquivo);
      
      if (resultado.modificado) {
        totalModificados++;
        arquivosModificados.push(resultado);
        console.log(`   ✅ ${arquivo}`);
      }
      
      if (resultado.erro) {
        console.error(`   ❌ ${arquivo}: ${resultado.erro}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO');
  console.log('='.repeat(60));
  console.log(`📁 Analisados: ${totalArquivos}`);
  console.log(`✅ Modificados: ${totalModificados}`);
  console.log('='.repeat(60));
  
  if (totalModificados > 0) {
    console.log('\n🎯 Próximo passo: Testar login no sistema');
  }
}

main().catch(console.error);
