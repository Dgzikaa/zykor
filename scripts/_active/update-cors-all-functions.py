#!/usr/bin/env python3
"""
Script para atualizar CORS em todas as Edge Functions

Atualiza:
1. Remove declaração inline de corsHeaders
2. Importa getCorsHeaders de cors.ts
3. Move getCorsHeaders(req) para dentro do handler
"""

import os
import re
from pathlib import Path

# Diretório base das Edge Functions
FUNCTIONS_DIR = Path(r"c:\Projects\zykor\backend\supabase\functions")

# Funções que já foram atualizadas manualmente
SKIP_FUNCTIONS = [
    'agente-dispatcher',
    'inter-pix-webhook',
    '_shared',
    '_archived',
]

def update_function_file(file_path: Path) -> bool:
    """Atualiza um arquivo de Edge Function"""
    
    print(f"[*] Processando: {file_path.relative_to(FUNCTIONS_DIR)}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes_made = False
    
    # 1. Verificar se já usa getCorsHeaders
    if 'getCorsHeaders' in content:
        print(f"  [OK] Ja usa getCorsHeaders")
        return False
    
    # 2. Verificar se tem corsHeaders definido
    if 'const corsHeaders = {' not in content:
        print(f"  [WARN] Nao tem corsHeaders definido")
        return False
    
    # 3. Adicionar import de getCorsHeaders se não existir
    if "from '../_shared/cors.ts'" not in content:
        # Encontrar a última linha de import
        import_pattern = r"(import .+ from .+;)\n"
        imports = list(re.finditer(import_pattern, content))
        
        if imports:
            last_import = imports[-1]
            insert_pos = last_import.end()
            
            new_import = "import { getCorsHeaders } from '../_shared/cors.ts';\n"
            content = content[:insert_pos] + new_import + content[insert_pos:]
            changes_made = True
            print(f"  [OK] Adicionado import de getCorsHeaders")
    
    # 4. Remover declaração inline de corsHeaders
    cors_pattern = r"const corsHeaders = \{[^}]+\};"
    if re.search(cors_pattern, content):
        content = re.sub(cors_pattern, '', content)
        changes_made = True
        print(f"  [OK] Removida declaracao inline de corsHeaders")
    
    # 5. Adicionar getCorsHeaders no início do handler
    # Padrão 1: serve(async (req)
    handler_pattern1 = r"(serve\(async \(req\) => \{)"
    if re.search(handler_pattern1, content):
        replacement = r"\1\n  const corsHeaders = getCorsHeaders(req);\n"
        content = re.sub(handler_pattern1, replacement, content, count=1)
        changes_made = True
        print(f"  [OK] Adicionado getCorsHeaders no handler (padrao 1)")
    
    # Padrão 2: Deno.serve(async (req)
    handler_pattern2 = r"(Deno\.serve\(async \(req[^)]*\)[^{]*\{)"
    if re.search(handler_pattern2, content):
        replacement = r"\1\n  const corsHeaders = getCorsHeaders(req);\n"
        content = re.sub(handler_pattern2, replacement, content, count=1)
        changes_made = True
        print(f"  [OK] Adicionado getCorsHeaders no handler (padrao 2)")
    
    # 6. Salvar se houve mudanças
    if changes_made and content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  [SAVED] Arquivo atualizado!")
        return True
    else:
        print(f"  [SKIP] Nenhuma mudanca necessaria")
        return False

def main():
    """Processa todas as Edge Functions"""
    
    print("Iniciando atualizacao de CORS em Edge Functions\n")
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    # Percorrer todas as pastas de funções
    for func_dir in FUNCTIONS_DIR.iterdir():
        if not func_dir.is_dir():
            continue
        
        # Pular funções já atualizadas ou especiais
        if func_dir.name in SKIP_FUNCTIONS:
            print(f"[SKIP] Pulando: {func_dir.name} (ja atualizada ou especial)\n")
            skipped_count += 1
            continue
        
        # Procurar index.ts
        index_file = func_dir / "index.ts"
        if not index_file.exists():
            print(f"[WARN] Sem index.ts: {func_dir.name}\n")
            skipped_count += 1
            continue
        
        try:
            if update_function_file(index_file):
                updated_count += 1
            else:
                skipped_count += 1
        except Exception as e:
            print(f"  [ERROR] {e}")
            error_count += 1
        
        print()  # Linha em branco entre funções
    
    # Resumo
    print("\n" + "="*60)
    print("RESUMO DA ATUALIZACAO")
    print("="*60)
    print(f"[OK] Atualizadas: {updated_count}")
    print(f"[SKIP] Puladas: {skipped_count}")
    print(f"[ERROR] Erros: {error_count}")
    print("="*60)

if __name__ == "__main__":
    main()
