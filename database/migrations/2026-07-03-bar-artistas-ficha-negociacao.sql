-- Ficha/negociação do artista (perfil no cadastro). Aberta junto dos números
-- (modal de /analitico/atracoes) pro papo comercial. Aplicado via MCP; versionado aqui.
alter table operations.bar_artistas
  add column if not exists tipo_acordo text,              -- 'cache' | 'sociedade' | 'couvert' | 'misto'
  add column if not exists cachet_combinado numeric,      -- cachê combinado padrão
  add column if not exists percentual_sociedade numeric,  -- % quando sociedade/misto
  add column if not exists duracao_combinada_min smallint,-- duração padrão combinada (min)
  add column if not exists horario_padrao time,           -- horário padrão de início
  add column if not exists contato text,                  -- telefone/@ do artista/empresário
  add column if not exists anotacoes text;                -- histórico de negociação / observações
