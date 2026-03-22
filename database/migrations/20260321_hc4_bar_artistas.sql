-- HC-4: Criar tabela bar_artistas para substituir lista hardcoded
-- Antes: arrays ATRACOES_CONHECIDAS e DJS_CONHECIDOS em atracoes/route.ts
-- Depois: tabela bar_artistas com config por bar

-- PASSO 1: Criar tabela
CREATE TABLE IF NOT EXISTS bar_artistas (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL REFERENCES bares_config(bar_id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('banda', 'dj', 'solo')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bar_id, nome)
);

-- PASSO 2: Inserir artistas conhecidos (Ordinario bar_id=3)
INSERT INTO bar_artistas (bar_id, nome, tipo) VALUES
(3, 'Breno Alves', 'banda'),
(3, 'Benzadeus', 'banda'),
(3, 'Bonsai', 'banda'),
(3, 'Boka de Sergipe', 'banda'),
(3, 'Pe no Chao', 'banda'),
(3, '7naRoda', 'banda'),
(3, 'Doze', 'banda'),
(3, 'STZ', 'banda'),
(3, 'Sambadona', 'banda'),
(3, 'Reconvexa', 'banda'),
(3, 'Na Medida', 'banda'),
(3, 'Gigi', 'solo'),
(3, 'Pagode da Gigi', 'banda'),
(3, 'Clima de Montanha', 'banda'),
(3, 'Inacio Rios', 'solo'),
(3, 'Mosquito', 'solo'),
(3, 'Marina Iris', 'solo'),
(3, 'Marcelle Motta', 'solo'),
(3, 'Lucas Alves', 'solo'),
(3, 'Umiranda', 'solo'),
(3, 'Stephanie', 'solo'),
(3, 'Dj Jess Ullun', 'dj'),
(3, 'Dj Vinny', 'dj'),
(3, 'Dj Caju', 'dj'),
(3, 'Dj Negritah', 'dj'),
(3, 'Dj Afrika', 'dj'),
(3, 'Dj Leo Cabral', 'dj'),
(3, 'Dj Tiago Jousef', 'dj')
ON CONFLICT (bar_id, nome) DO NOTHING;

-- Enable RLS
ALTER TABLE bar_artistas ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read artists from their bar
CREATE POLICY "bar_artistas_select" ON bar_artistas
  FOR SELECT USING (
    bar_id = (SELECT bar_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
