#!/usr/bin/env python3
"""Script para corrigir erros de TypeScript após migração de tabelas"""

import re
from pathlib import Path

FRONTEND = Path(r"c:\Projects\zykor\frontend\src")

# Lista de arquivos e suas correções
ARQUIVOS_CORRIGIR = {
    # Arquivos com user.bar_id undefined
    "app/api/configuracoes/atribuicoes/route.ts": {
        "bar_id_check": True,
        "user_id_to_auth_id": [130]
    },
    "app/api/configuracoes/notifications/route.ts": {
        "bar_id_check": True,
        "user_id_to_auth_id": [171, 367]
    },
    "app/api/configuracoes/notifications/[id]/route.ts": {
        "user_id_to_auth_id": [64, 134, 253, 373, 392, 420, 434]
    },
    "app/api/configuracoes/reports/templates/route.ts": {
        "user_id_to_auth_id": [242]
    },
    "app/api/configuracoes/templates/[id]/route.ts": {
        "user_id_to_auth_id": [243, 418]
    },
    "app/api/configuracoes/templates/route.ts": {
        "bar_id_check": True,
        "user_id_to_auth_id": [525, 597, 728]
    },
    "app/api/configuracoes/uploads/route.ts": {
        "user_id_to_auth_id": [179, 349]
    },
    "app/api/operacional/checklists/[id]/rollback/route.ts": {
        "user_id_to_auth_id": [109, 127]
    },
    "app/api/operacional/checklists/[id]/route.ts": {
        "user_id_to_auth_id": [350, 367, 485, 503]
    },
    "app/api/operacional/checklists/agendamentos/route.ts": {
        "bar_id_check": True,
        "user_id_to_auth_id": [209]
    },
    "app/api/operacional/checklists/badge-data/route.ts": {
        "bar_id_check": True
    },
    "app/api/operacional/execucoes/[id]/finalizar/route.ts": {
        "user_id_to_auth_id": [112, 126, 158]
    },
    "app/api/operacional/execucoes/[id]/route.ts": {
        "fix_interface": True
    }
}

def corrigir_arquivo(filepath_rel, config):
    filepath = FRONTEND / filepath_rel
    
    if not filepath.exists():
        print(f"⚠️  Arquivo não encontrado: {filepath_rel}")
        return False
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        modificado = False
        
        # Substituir user.user_id por user.auth_id
        if "user_id_to_auth_id" in config:
            for i, line in enumerate(lines):
                if 'user.user_id' in line:
                    lines[i] = line.replace('user.user_id', 'user.auth_id')
                    modificado = True
        
        # Adicionar check de bar_id
        if config.get("bar_id_check"):
            for i, line in enumerate(lines):
                if 'const supabase = await getAdminClient()' in line and 'barIdStr' not in ''.join(lines[i:i+10]):
                    indent = len(line) - len(line.lstrip())
                    check_code = [
                        '\n',
                        ' ' * indent + 'if (!user.bar_id) {\n',
                        ' ' * indent + '  return NextResponse.json({ error: \'Bar ID não encontrado\' }, { status: 400 });\n',
                        ' ' * indent + '}\n',
                        ' ' * indent + 'const barIdStr = user.bar_id.toString();\n',
                        '\n'
                    ]
                    lines = lines[:i+1] + check_code + lines[i+1:]
                    modificado = True
                    break
            
            # Substituir user.bar_id.toString() por barIdStr
            for i, line in enumerate(lines):
                if 'user.bar_id.toString()' in line:
                    lines[i] = line.replace('user.bar_id.toString()', 'barIdStr')
                    modificado = True
        
        # Fix interface local em execucoes/[id]/route.ts
        if config.get("fix_interface"):
            for i, line in enumerate(lines):
                if 'interface AuthenticatedUser {' in line:
                    # Procurar a linha com user_id e substituir
                    for j in range(i, min(i+15, len(lines))):
                        if 'user_id:' in lines[j]:
                            lines[j] = lines[j].replace('user_id:', 'auth_id:')
                            modificado = True
                            break
                    break
        
        if modificado:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            print(f"✅ {filepath_rel}")
            return True
        else:
            print(f"⏭️  {filepath_rel} (sem mudanças)")
            return False
            
    except Exception as e:
        print(f"❌ Erro em {filepath_rel}: {e}")
        return False

def main():
    print("🔧 Corrigindo erros de TypeScript...\n")
    
    total = len(ARQUIVOS_CORRIGIR)
    corrigidos = 0
    
    for arquivo, config in ARQUIVOS_CORRIGIR.items():
        if corrigir_arquivo(arquivo, config):
            corrigidos += 1
    
    print(f"\n✨ Concluído! {corrigidos}/{total} arquivos corrigidos")

if __name__ == '__main__':
    main()
