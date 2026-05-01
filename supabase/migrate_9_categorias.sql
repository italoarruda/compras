-- ============================================================
-- Migração: 19 → 9 categorias
-- Execute no Supabase SQL Editor (apenas uma vez)
-- ============================================================

-- 1. Inserir as 9 novas categorias (ignora se já existirem)
INSERT INTO categorias (nome, cor, icone, ordem) VALUES
  ('Hortifruti',             '#27ae60', '🥦', 10),
  ('Carnes e Proteínas',     '#c0392b', '🥩', 20),
  ('Laticínios',             '#3498db', '🥛', 30),
  ('Mercearia',              '#e67e22', '🌾', 40),
  ('Temperos e Condimentos', '#9b59b6', '🧄', 50),
  ('Bebidas',                '#16a085', '🧃', 60),
  ('Padaria e Doces',        '#f39c12', '🍫', 70),
  ('Limpeza',                '#2c3e50', '🧹', 80),
  ('Higiene e Cuidados',     '#1abc9c', '🧴', 90)
ON CONFLICT (nome) DO NOTHING;

-- 2. Reatribuir registros que referenciam as categorias antigas
DO $$
DECLARE
  -- antigas
  old_frutas       UUID; old_legumes UUID; old_verduras UUID;
  old_bovina       UUID; old_aves    UUID; old_peixes   UUID;
  old_embutidos    UUID; old_ovos    UUID;
  old_graos        UUID; old_farinhas UUID; old_massas  UUID;
  old_enlatados    UUID; old_lanches UUID;
  old_descartaveis UUID;
  -- novas
  new_horti    UUID; new_carnes UUID; new_mercea   UUID;
  new_padaria  UUID; new_higiene UUID;
BEGIN
  -- busca IDs das categorias antigas
  SELECT id INTO old_frutas       FROM categorias WHERE nome = 'Frutas';
  SELECT id INTO old_legumes      FROM categorias WHERE nome = 'Legumes';
  SELECT id INTO old_verduras     FROM categorias WHERE nome = 'Verduras e Ervas';
  SELECT id INTO old_bovina       FROM categorias WHERE nome = 'Carnes Bovinas';
  SELECT id INTO old_aves         FROM categorias WHERE nome = 'Aves';
  SELECT id INTO old_peixes       FROM categorias WHERE nome = 'Peixes e Frutos do Mar';
  SELECT id INTO old_embutidos    FROM categorias WHERE nome = 'Embutidos e Frios';
  SELECT id INTO old_ovos         FROM categorias WHERE nome = 'Ovos';
  SELECT id INTO old_graos        FROM categorias WHERE nome = 'Grãos e Cereais';
  SELECT id INTO old_farinhas     FROM categorias WHERE nome = 'Farinhas e Amidos';
  SELECT id INTO old_massas       FROM categorias WHERE nome = 'Massas';
  SELECT id INTO old_enlatados    FROM categorias WHERE nome = 'Enlatados e Conservas';
  SELECT id INTO old_lanches      FROM categorias WHERE nome = 'Lanches e Guloseimas';
  SELECT id INTO old_descartaveis FROM categorias WHERE nome = 'Descartáveis e Outros';

  -- busca IDs das novas categorias
  SELECT id INTO new_horti    FROM categorias WHERE nome = 'Hortifruti';
  SELECT id INTO new_carnes   FROM categorias WHERE nome = 'Carnes e Proteínas';
  SELECT id INTO new_mercea   FROM categorias WHERE nome = 'Mercearia';
  SELECT id INTO new_padaria  FROM categorias WHERE nome = 'Padaria e Doces';
  SELECT id INTO new_higiene  FROM categorias WHERE nome = 'Higiene e Cuidados';

  -- Hortifruti ← Frutas + Legumes + Verduras e Ervas
  UPDATE produtos     SET categoria_id = new_horti  WHERE categoria_id IN (old_frutas, old_legumes, old_verduras);
  UPDATE itens_compra SET categoria_id = new_horti  WHERE categoria_id IN (old_frutas, old_legumes, old_verduras);

  -- Carnes e Proteínas ← Bovinas + Aves + Peixes + Embutidos + Ovos
  UPDATE produtos     SET categoria_id = new_carnes  WHERE categoria_id IN (old_bovina, old_aves, old_peixes, old_embutidos, old_ovos);
  UPDATE itens_compra SET categoria_id = new_carnes  WHERE categoria_id IN (old_bovina, old_aves, old_peixes, old_embutidos, old_ovos);

  -- Mercearia ← Grãos + Farinhas + Massas + Enlatados
  UPDATE produtos     SET categoria_id = new_mercea  WHERE categoria_id IN (old_graos, old_farinhas, old_massas, old_enlatados);
  UPDATE itens_compra SET categoria_id = new_mercea  WHERE categoria_id IN (old_graos, old_farinhas, old_massas, old_enlatados);

  -- Padaria e Doces ← Lanches e Guloseimas
  UPDATE produtos     SET categoria_id = new_padaria  WHERE categoria_id = old_lanches;
  UPDATE itens_compra SET categoria_id = new_padaria  WHERE categoria_id = old_lanches;

  -- Higiene e Cuidados ← Higiene Pessoal + Descartáveis e Outros
  UPDATE produtos     SET categoria_id = new_higiene  WHERE categoria_id = old_descartaveis;
  UPDATE itens_compra SET categoria_id = new_higiene  WHERE categoria_id = old_descartaveis;

  -- Remove todas as categorias antigas (as novas já foram inseridas no passo 1)
  DELETE FROM categorias WHERE nome IN (
    'Frutas','Legumes','Verduras e Ervas',
    'Carnes Bovinas','Aves','Peixes e Frutos do Mar',
    'Embutidos e Frios','Ovos',
    'Grãos e Cereais','Farinhas e Amidos','Massas',
    'Enlatados e Conservas',
    'Lanches e Guloseimas',
    'Higiene Pessoal',
    'Descartáveis e Outros'
  );

END $$;

-- 3. Confirma resultado
SELECT nome, cor, icone, ordem FROM categorias ORDER BY ordem;
