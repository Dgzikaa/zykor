-- Configurar categoria de atração para Bar Deboche (bar_id=4)
-- A categoria no Conta Azul (NIBO) é 'Atrações/Eventos'

-- Verificar se já existe
SELECT * FROM bar_categorias_custo WHERE bar_id = 4 AND tipo = 'atracao';

-- Inserir configuração (se não existir)
INSERT INTO bar_categorias_custo (bar_id, tipo, nome_categoria, ativo, created_at, updated_at)
VALUES (4, 'atracao', 'Atrações/Eventos', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Verificar resultado
SELECT * FROM bar_categorias_custo WHERE bar_id = 4 AND tipo = 'atracao';
