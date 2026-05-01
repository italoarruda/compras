-- ============================================================
-- Lista de Compras - Schema para Supabase
-- Execute no SQL Editor do Supabase (supabase.com/dashboard)
-- ============================================================

-- ============================================================
-- PASSO 0 — DESABILITAR RLS (Row Level Security)
-- O Supabase ativa RLS por padrão; sem isso a anon key não
-- consegue ler nenhuma linha e o login falha silenciosamente.
-- Execute este bloco ANTES de qualquer outra coisa.
-- ============================================================
ALTER TABLE IF EXISTS usuarios         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categorias       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produtos         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS listas_compras   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS itens_lista      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS compras          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS itens_compra     DISABLE ROW LEVEL SECURITY;

-- Se as tabelas ainda não existem, rode o bloco acima de novo
-- depois de criá-las (as linhas com IF EXISTS são seguras).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== CATEGORIAS =====
CREATE TABLE IF NOT EXISTS categorias (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT UNIQUE NOT NULL,
  cor  TEXT DEFAULT '#6c757d',
  icone TEXT DEFAULT '🛒',
  ordem INTEGER DEFAULT 0
);

-- ===== PRODUTOS =====
CREATE TABLE IF NOT EXISTS produtos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome           TEXT NOT NULL,
  categoria_id   UUID REFERENCES categorias(id),
  unidade_padrao TEXT DEFAULT 'uni',
  ativo          BOOLEAN DEFAULT TRUE,
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_produtos_cat ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);

-- ===== USUÁRIOS =====
CREATE TABLE IF NOT EXISTS usuarios (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome             TEXT NOT NULL,
  cpf              TEXT UNIQUE NOT NULL,
  data_nascimento  DATE NOT NULL,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- ===== LISTAS DE COMPRAS =====
CREATE TABLE IF NOT EXISTS listas_compras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID REFERENCES usuarios(id),
  mes         INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano         INTEGER NOT NULL,
  status      TEXT DEFAULT 'rascunho',
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, mes, ano)
);

-- ===== ITENS DA LISTA =====
CREATE TABLE IF NOT EXISTS itens_lista (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lista_id      UUID REFERENCES listas_compras(id) ON DELETE CASCADE,
  produto_id    UUID REFERENCES produtos(id),
  nome_produto  TEXT NOT NULL,
  quantidade    DECIMAL(10,3) DEFAULT 1,
  unidade       TEXT DEFAULT 'uni',
  marcado       BOOLEAN DEFAULT FALSE,
  posicao       INTEGER DEFAULT 0,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_itens_lista ON itens_lista(lista_id);

-- ===== COMPRAS (registradas via NFC-e) =====
CREATE TABLE IF NOT EXISTS compras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID REFERENCES usuarios(id),
  lista_id    UUID REFERENCES listas_compras(id),
  chave_nfce  TEXT UNIQUE,
  nome_loja   TEXT,
  cnpj_loja   TEXT,
  data_compra TIMESTAMPTZ DEFAULT NOW(),
  valor_total DECIMAL(10,2),
  dados_brutos JSONB,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compras_usuario ON compras(usuario_id);
CREATE INDEX IF NOT EXISTS idx_compras_lista ON compras(lista_id);

-- ===== ITENS DA COMPRA =====
CREATE TABLE IF NOT EXISTS itens_compra (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id      UUID REFERENCES compras(id) ON DELETE CASCADE,
  produto_id     UUID REFERENCES produtos(id),
  categoria_id   UUID REFERENCES categorias(id),
  nome_original  TEXT NOT NULL,
  quantidade     DECIMAL(10,3),
  unidade        TEXT,
  preco_unitario DECIMAL(10,2),
  preco_total    DECIMAL(10,2),
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_itens_compra ON itens_compra(compra_id);
CREATE INDEX IF NOT EXISTS idx_itens_cat ON itens_compra(categoria_id);

-- ============================================================
-- SEED: Categorias
-- ============================================================
INSERT INTO categorias (nome, cor, icone, ordem) VALUES
  ('Frutas',                 '#27ae60', '🍎', 10),
  ('Legumes',                '#2ecc71', '🥦', 20),
  ('Verduras e Ervas',       '#1abc9c', '🌿', 30),
  ('Carnes Bovinas',         '#c0392b', '🥩', 40),
  ('Aves',                   '#e74c3c', '🍗', 50),
  ('Peixes e Frutos do Mar', '#2980b9', '🐟', 60),
  ('Laticínios',             '#3498db', '🥛', 70),
  ('Embutidos e Frios',      '#8e44ad', '🥓', 80),
  ('Ovos',                   '#f39c12', '🥚', 90),
  ('Grãos e Cereais',        '#e67e22', '🌾', 100),
  ('Farinhas e Amidos',      '#d35400', '🌽', 110),
  ('Massas',                 '#f0932b', '🍝', 120),
  ('Temperos e Condimentos', '#9b59b6', '🧄', 130),
  ('Enlatados e Conservas',  '#7f8c8d', '🥫', 140),
  ('Bebidas',                '#16a085', '🧃', 150),
  ('Lanches e Guloseimas',   '#e67e22', '🍫', 160),
  ('Limpeza',                '#2c3e50', '🧹', 170),
  ('Higiene Pessoal',        '#16a085', '🧴', 180),
  ('Descartáveis e Outros',  '#95a5a6', '🛍️', 190)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- SEED: Produtos (ordenados alfabeticamente por categoria)
-- ============================================================
DO $$
DECLARE
  cat_frutas       UUID; cat_legumes UUID; cat_verduras UUID;
  cat_bovina       UUID; cat_aves    UUID; cat_peixes   UUID;
  cat_laticinios   UUID; cat_embutidos UUID; cat_ovos   UUID;
  cat_graos        UUID; cat_farinhas  UUID; cat_massas  UUID;
  cat_temperos     UUID; cat_enlatados UUID; cat_bebidas UUID;
  cat_lanches      UUID; cat_limpeza   UUID; cat_higiene UUID;
  cat_descartaveis UUID;
BEGIN
  SELECT id INTO cat_frutas       FROM categorias WHERE nome = 'Frutas';
  SELECT id INTO cat_legumes      FROM categorias WHERE nome = 'Legumes';
  SELECT id INTO cat_verduras     FROM categorias WHERE nome = 'Verduras e Ervas';
  SELECT id INTO cat_bovina       FROM categorias WHERE nome = 'Carnes Bovinas';
  SELECT id INTO cat_aves         FROM categorias WHERE nome = 'Aves';
  SELECT id INTO cat_peixes       FROM categorias WHERE nome = 'Peixes e Frutos do Mar';
  SELECT id INTO cat_laticinios   FROM categorias WHERE nome = 'Laticínios';
  SELECT id INTO cat_embutidos    FROM categorias WHERE nome = 'Embutidos e Frios';
  SELECT id INTO cat_ovos         FROM categorias WHERE nome = 'Ovos';
  SELECT id INTO cat_graos        FROM categorias WHERE nome = 'Grãos e Cereais';
  SELECT id INTO cat_farinhas     FROM categorias WHERE nome = 'Farinhas e Amidos';
  SELECT id INTO cat_massas       FROM categorias WHERE nome = 'Massas';
  SELECT id INTO cat_temperos     FROM categorias WHERE nome = 'Temperos e Condimentos';
  SELECT id INTO cat_enlatados    FROM categorias WHERE nome = 'Enlatados e Conservas';
  SELECT id INTO cat_bebidas      FROM categorias WHERE nome = 'Bebidas';
  SELECT id INTO cat_lanches      FROM categorias WHERE nome = 'Lanches e Guloseimas';
  SELECT id INTO cat_limpeza      FROM categorias WHERE nome = 'Limpeza';
  SELECT id INTO cat_higiene      FROM categorias WHERE nome = 'Higiene Pessoal';
  SELECT id INTO cat_descartaveis FROM categorias WHERE nome = 'Descartáveis e Outros';

  -- FRUTAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Abacate',       cat_frutas, 'uni'),
    ('Abacaxi',       cat_frutas, 'uni'),
    ('Açaí',          cat_frutas, 'Kg'),
    ('Acerola',       cat_frutas, 'Kg'),
    ('Banana',        cat_frutas, 'Kg'),
    ('Banana da terra', cat_frutas, 'Kg'),
    ('Caju',          cat_frutas, 'Kg'),
    ('Cajá',          cat_frutas, 'Kg'),
    ('Carambola',     cat_frutas, 'Kg'),
    ('Coco',          cat_frutas, 'uni'),
    ('Cupuaçu',       cat_frutas, 'Kg'),
    ('Goiaba',        cat_frutas, 'Kg'),
    ('Graviola',      cat_frutas, 'Kg'),
    ('Laranja',       cat_frutas, 'Kg'),
    ('Lima',          cat_frutas, 'Kg'),
    ('Limão',         cat_frutas, 'Kg'),
    ('Maçã',          cat_frutas, 'Kg'),
    ('Mamão',         cat_frutas, 'Kg'),
    ('Manga rosa',    cat_frutas, 'Kg'),
    ('Mangaba',       cat_frutas, 'Kg'),
    ('Maracujá',      cat_frutas, 'Kg'),
    ('Melancia',      cat_frutas, 'uni'),
    ('Melão',         cat_frutas, 'uni'),
    ('Morango',       cat_frutas, 'pct'),
    ('Pera',          cat_frutas, 'Kg'),
    ('Pêssego',       cat_frutas, 'Kg'),
    ('Pitanga',       cat_frutas, 'Kg'),
    ('Pupunha',       cat_frutas, 'Kg'),
    ('Tamarindo',     cat_frutas, 'Kg'),
    ('Taperebá',      cat_frutas, 'Kg'),
    ('Uva',           cat_frutas, 'Kg')
  ON CONFLICT DO NOTHING;

  -- LEGUMES
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Abóbora',              cat_legumes, 'Kg'),
    ('Abobrinha',            cat_legumes, 'Kg'),
    ('Batata doce',          cat_legumes, 'Kg'),
    ('Batata inglesa',       cat_legumes, 'Kg'),
    ('Batata palha congelada', cat_legumes, 'pct'),
    ('Berinjela',            cat_legumes, 'Kg'),
    ('Beterraba',            cat_legumes, 'Kg'),
    ('Cará',                 cat_legumes, 'Kg'),
    ('Cebola branca',        cat_legumes, 'Kg'),
    ('Cebola roxa',          cat_legumes, 'Kg'),
    ('Chuchu',               cat_legumes, 'Kg'),
    ('Inhame',               cat_legumes, 'Kg'),
    ('Macaxeira',            cat_legumes, 'Kg'),
    ('Maxixe',               cat_legumes, 'Kg'),
    ('Milho verde',          cat_legumes, 'uni'),
    ('Pepino',               cat_legumes, 'uni'),
    ('Pimentão amarelo',     cat_legumes, 'uni'),
    ('Pimentão verde',       cat_legumes, 'uni'),
    ('Pimentão vermelho',    cat_legumes, 'uni'),
    ('Quiabo',               cat_legumes, 'Kg'),
    ('Repolho',              cat_legumes, 'uni'),
    ('Tomate',               cat_legumes, 'Kg'),
    ('Vagem',                cat_legumes, 'Kg')
  ON CONFLICT DO NOTHING;

  -- VERDURAS E ERVAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Acelga',             cat_verduras, 'maço'),
    ('Agrião',             cat_verduras, 'maço'),
    ('Alface',             cat_verduras, 'uni'),
    ('Alho',               cat_verduras, 'uni'),
    ('Cebolinha',          cat_verduras, 'maço'),
    ('Coentro',            cat_verduras, 'maço'),
    ('Couve',              cat_verduras, 'maço'),
    ('Couve-flor',         cat_verduras, 'uni'),
    ('Espinafre',          cat_verduras, 'maço'),
    ('Gengibre',           cat_verduras, 'Kg'),
    ('Hortelã',            cat_verduras, 'maço'),
    ('Manjericão',         cat_verduras, 'maço'),
    ('Orégano fresco',     cat_verduras, 'maço'),
    ('Pimenta de cheiro',  cat_verduras, 'uni'),
    ('Pimenta dedo de moça', cat_verduras, 'uni'),
    ('Rúcula',             cat_verduras, 'maço'),
    ('Salsa',              cat_verduras, 'maço'),
    ('Tomilho fresco',     cat_verduras, 'maço')
  ON CONFLICT DO NOTHING;

  -- CARNES BOVINAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Acém',               cat_bovina, 'Kg'),
    ('Alcatra',            cat_bovina, 'Kg'),
    ('Bisteca bovina',     cat_bovina, 'Kg'),
    ('Chambaril',          cat_bovina, 'Kg'),
    ('Contrafilé',         cat_bovina, 'Kg'),
    ('Costela bovina',     cat_bovina, 'Kg'),
    ('Coxão duro',         cat_bovina, 'Kg'),
    ('Coxão mole',         cat_bovina, 'Kg'),
    ('Filé mignon',        cat_bovina, 'Kg'),
    ('Fraldinha',          cat_bovina, 'Kg'),
    ('Hambúrguer artesanal', cat_bovina, 'pct'),
    ('Lagarto',            cat_bovina, 'Kg'),
    ('Músculo',            cat_bovina, 'Kg'),
    ('Osso para caldo',    cat_bovina, 'Kg'),
    ('Patinho',            cat_bovina, 'Kg'),
    ('Picanha',            cat_bovina, 'Kg')
  ON CONFLICT DO NOTHING;

  -- AVES
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Asa de frango',       cat_aves, 'Kg'),
    ('Coxa de frango',      cat_aves, 'Kg'),
    ('Coxa e sobrecoxa',    cat_aves, 'Kg'),
    ('Coxinha de asa',      cat_aves, 'pct'),
    ('Filé de frango',      cat_aves, 'Kg'),
    ('Frango caipira',      cat_aves, 'Kg'),
    ('Frango inteiro',      cat_aves, 'Kg'),
    ('Linguiça de frango',  cat_aves, 'Kg'),
    ('Peito de frango',     cat_aves, 'Kg'),
    ('Peru',                cat_aves, 'Kg')
  ON CONFLICT DO NOTHING;

  -- PEIXES E FRUTOS DO MAR
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Camarão',         cat_peixes, 'Kg'),
    ('Caranguejo',      cat_peixes, 'Kg'),
    ('Filé de pirarucu', cat_peixes, 'Kg'),
    ('Jaraqui',         cat_peixes, 'Kg'),
    ('Pacu',            cat_peixes, 'Kg'),
    ('Pintado',         cat_peixes, 'Kg'),
    ('Sardinha fresca', cat_peixes, 'Kg'),
    ('Tambaqui',        cat_peixes, 'Kg'),
    ('Tilápia',         cat_peixes, 'Kg'),
    ('Tucunaré',        cat_peixes, 'Kg')
  ON CONFLICT DO NOTHING;

  -- LATICÍNIOS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Bebida láctea',        cat_laticinios, 'L'),
    ('Creme de leite',       cat_laticinios, 'uni'),
    ('Iogurte grego',        cat_laticinios, 'uni'),
    ('Iogurte natural',      cat_laticinios, 'uni'),
    ('Leite condensado',     cat_laticinios, 'uni'),
    ('Leite de coco',        cat_laticinios, 'uni'),
    ('Leite desnatado',      cat_laticinios, 'L'),
    ('Leite em pó',          cat_laticinios, 'pct'),
    ('Leite fermentado',     cat_laticinios, 'pct'),
    ('Leite integral',       cat_laticinios, 'L'),
    ('Manteiga',             cat_laticinios, 'uni'),
    ('Manteiga de garrafa',  cat_laticinios, 'uni'),
    ('Margarina 500g',       cat_laticinios, 'uni'),
    ('Queijo coalho',        cat_laticinios, 'Kg'),
    ('Queijo cottage',       cat_laticinios, 'uni'),
    ('Queijo minas frescal', cat_laticinios, 'uni'),
    ('Queijo mussarela',     cat_laticinios, 'Kg'),
    ('Queijo parmesão ralado', cat_laticinios, 'pct'),
    ('Queijo ralado',        cat_laticinios, 'pct'),
    ('Requeijão',            cat_laticinios, 'uni')
  ON CONFLICT DO NOTHING;

  -- EMBUTIDOS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Apresuntado',       cat_embutidos, 'Kg'),
    ('Linguiça calabresa', cat_embutidos, 'Kg'),
    ('Mortadela',         cat_embutidos, 'Kg'),
    ('Presunto',          cat_embutidos, 'Kg'),
    ('Salame',            cat_embutidos, 'Kg'),
    ('Salsicha',          cat_embutidos, 'pct')
  ON CONFLICT DO NOTHING;

  -- OVOS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Ovos branco',    cat_ovos, 'uni'),
    ('Ovos caipira',   cat_ovos, 'uni'),
    ('Ovos codorna',   cat_ovos, 'uni'),
    ('Ovos vermelhos', cat_ovos, 'uni')
  ON CONFLICT DO NOTHING;

  -- GRÃOS E CEREAIS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Arroz branco',       cat_graos, 'Kg'),
    ('Arroz integral',     cat_graos, 'Kg'),
    ('Arroz parboilizado', cat_graos, 'Kg'),
    ('Aveia em flocos',    cat_graos, 'pct'),
    ('Cevada',             cat_graos, 'pct'),
    ('Ervilha seca',       cat_graos, 'Kg'),
    ('Feijão branco',      cat_graos, 'Kg'),
    ('Feijão carioca',     cat_graos, 'Kg'),
    ('Feijão de baião',    cat_graos, 'Kg'),
    ('Feijão fradinho',    cat_graos, 'Kg'),
    ('Feijão jalo',        cat_graos, 'Kg'),
    ('Feijão mulato',      cat_graos, 'Kg'),
    ('Feijão preto',       cat_graos, 'Kg'),
    ('Floção de milho',    cat_graos, 'pct'),
    ('Grão de bico',       cat_graos, 'Kg'),
    ('Lentilha',           cat_graos, 'Kg'),
    ('Milho para pipoca',  cat_graos, 'pct'),
    ('Quinoa',             cat_graos, 'pct')
  ON CONFLICT DO NOTHING;

  -- FARINHAS E AMIDOS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Amido de milho',          cat_farinhas, 'pct'),
    ('Farinha de arroz',        cat_farinhas, 'pct'),
    ('Farinha de aveia',        cat_farinhas, 'pct'),
    ('Farinha de mandioca',     cat_farinhas, 'Kg'),
    ('Farinha de trigo branca', cat_farinhas, 'Kg'),
    ('Farinha de trigo integral', cat_farinhas, 'Kg'),
    ('Fubá mimoso',             cat_farinhas, 'pct'),
    ('Goma de tapioca',         cat_farinhas, 'pct'),
    ('Polvilho azedo',          cat_farinhas, 'pct'),
    ('Polvilho doce',           cat_farinhas, 'pct')
  ON CONFLICT DO NOTHING;

  -- MASSAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Lasanha',                   cat_massas, 'pct'),
    ('Macarrão ave-maria',        cat_massas, 'pct'),
    ('Macarrão espaguete',        cat_massas, 'pct'),
    ('Macarrão espaguete integral', cat_massas, 'pct'),
    ('Macarrão parafuso',         cat_massas, 'pct'),
    ('Macarrão pena',             cat_massas, 'pct'),
    ('Macarrão sopa',             cat_massas, 'pct')
  ON CONFLICT DO NOTHING;

  -- TEMPEROS E CONDIMENTOS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Açafrão cúrcuma',          cat_temperos, 'pct'),
    ('Azeite de oliva',          cat_temperos, 'uni'),
    ('Azeitona preta',           cat_temperos, 'pct'),
    ('Azeitona verde',           cat_temperos, 'pct'),
    ('Bicarbonato de sódio',     cat_temperos, 'pct'),
    ('Cacau em pó',              cat_temperos, 'pct'),
    ('Canela em pau',            cat_temperos, 'pct'),
    ('Canela em pó',             cat_temperos, 'pct'),
    ('Chimichurri',              cat_temperos, 'pct'),
    ('Colorau',                  cat_temperos, 'pct'),
    ('Cominho',                  cat_temperos, 'pct'),
    ('Curry',                    cat_temperos, 'pct'),
    ('Dendê',                    cat_temperos, 'L'),
    ('Erva doce',                cat_temperos, 'pct'),
    ('Extrato de tomate',        cat_temperos, 'uni'),
    ('Fermento em pó',           cat_temperos, 'pct'),
    ('Ketchup',                  cat_temperos, 'uni'),
    ('Lemon pepper',             cat_temperos, 'pct'),
    ('Maionese',                 cat_temperos, 'uni'),
    ('Mel',                      cat_temperos, 'uni'),
    ('Molho de pimenta',         cat_temperos, 'uni'),
    ('Molho inglês',             cat_temperos, 'uni'),
    ('Molho shoyu',              cat_temperos, 'uni'),
    ('Mostarda',                 cat_temperos, 'uni'),
    ('Noz moscada',              cat_temperos, 'pct'),
    ('Óleo de coco',             cat_temperos, 'uni'),
    ('Óleo de soja',             cat_temperos, 'uni'),
    ('Orégano',                  cat_temperos, 'pct'),
    ('Pimenta do reino',         cat_temperos, 'pct'),
    ('Sal refinado',             cat_temperos, 'Kg'),
    ('Sal rosa',                 cat_temperos, 'pct'),
    ('Tempero baiano',           cat_temperos, 'pct'),
    ('Tomilho seco',             cat_temperos, 'pct'),
    ('Vinagre de álcool',        cat_temperos, 'uni'),
    ('Vinagre de maçã',          cat_temperos, 'uni')
  ON CONFLICT DO NOTHING;

  -- ENLATADOS E CONSERVAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Atum em água',        cat_enlatados, 'uni'),
    ('Atum em azeite',      cat_enlatados, 'uni'),
    ('Ervilha lata',        cat_enlatados, 'uni'),
    ('Milho lata',          cat_enlatados, 'uni'),
    ('Palmito',             cat_enlatados, 'uni'),
    ('Sardinha lata',       cat_enlatados, 'uni'),
    ('Seleta de legumes',   cat_enlatados, 'uni')
  ON CONFLICT DO NOTHING;

  -- BEBIDAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Achocolatado',       cat_bebidas, 'uni'),
    ('Água com gás',       cat_bebidas, 'uni'),
    ('Água de coco',       cat_bebidas, 'uni'),
    ('Água mineral',       cat_bebidas, 'uni'),
    ('Café solúvel',       cat_bebidas, 'pct'),
    ('Café torrado moído', cat_bebidas, 'pct'),
    ('Chá verde',          cat_bebidas, 'pct'),
    ('Energético',         cat_bebidas, 'uni'),
    ('Kefir',              cat_bebidas, 'uni'),
    ('Polpa de fruta',     cat_bebidas, 'pct'),
    ('Refrigerante',       cat_bebidas, 'uni'),
    ('Suco de laranja',    cat_bebidas, 'uni'),
    ('Suco de uva integral', cat_bebidas, 'uni')
  ON CONFLICT DO NOTHING;

  -- LANCHES E GULOSEIMAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Amendoim',             cat_lanches, 'Kg'),
    ('Amêndoa',              cat_lanches, 'pct'),
    ('Barra de cereal',      cat_lanches, 'pct'),
    ('Biscoito cream cracker', cat_lanches, 'pct'),
    ('Biscoito Maizena',     cat_lanches, 'pct'),
    ('Castanha de caju',     cat_lanches, 'Kg'),
    ('Castanha do pará',     cat_lanches, 'Kg'),
    ('Chocolate ao leite',   cat_lanches, 'uni'),
    ('Chocolate 70%',        cat_lanches, 'uni'),
    ('Farinha láctea',       cat_lanches, 'pct'),
    ('Gelatina',             cat_lanches, 'pct'),
    ('Granola',              cat_lanches, 'pct'),
    ('Linhaça',              cat_lanches, 'pct'),
    ('Nozes',                cat_lanches, 'pct'),
    ('Paçoca',               cat_lanches, 'pct'),
    ('Pão de forma',         cat_lanches, 'uni'),
    ('Pão integral',         cat_lanches, 'uni'),
    ('Torradas',             cat_lanches, 'pct')
  ON CONFLICT DO NOTHING;

  -- LIMPEZA
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Água sanitária',       cat_limpeza, 'uni'),
    ('Álcool 70% gel',       cat_limpeza, 'uni'),
    ('Álcool 70% líquido',   cat_limpeza, 'uni'),
    ('Amaciante',            cat_limpeza, 'uni'),
    ('Desengordurante',      cat_limpeza, 'uni'),
    ('Desinfetante',         cat_limpeza, 'uni'),
    ('Detergente',           cat_limpeza, 'uni'),
    ('Esponja dupla face',   cat_limpeza, 'uni'),
    ('Lã de aço',            cat_limpeza, 'pct'),
    ('Limpa vidros',         cat_limpeza, 'uni'),
    ('Multiuso spray',       cat_limpeza, 'uni'),
    ('Pedra sanitária',      cat_limpeza, 'uni'),
    ('Sabão de coco barra',  cat_limpeza, 'uni'),
    ('Sabão em pó',          cat_limpeza, 'pct'),
    ('Saco de lixo',         cat_limpeza, 'pct')
  ON CONFLICT DO NOTHING;

  -- HIGIENE PESSOAL
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Absorvente',          cat_higiene, 'pct'),
    ('Barbeador',           cat_higiene, 'uni'),
    ('Condicionador',       cat_higiene, 'uni'),
    ('Cotonete',            cat_higiene, 'pct'),
    ('Creme dental',        cat_higiene, 'uni'),
    ('Desodorante aerosol', cat_higiene, 'uni'),
    ('Desodorante roll-on', cat_higiene, 'uni'),
    ('Escova de dentes',    cat_higiene, 'uni'),
    ('Fio dental',          cat_higiene, 'uni'),
    ('Fraldas',             cat_higiene, 'pct'),
    ('Lenço umedecido',     cat_higiene, 'pct'),
    ('Papel higiênico',     cat_higiene, 'pct'),
    ('Sabonete barra',      cat_higiene, 'uni'),
    ('Sabonete líquido',    cat_higiene, 'uni'),
    ('Shampoo',             cat_higiene, 'uni')
  ON CONFLICT DO NOTHING;

  -- DESCARTÁVEIS E OUTROS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Coador de café',        cat_descartaveis, 'uni'),
    ('Filme plástico',        cat_descartaveis, 'uni'),
    ('Papel alumínio',        cat_descartaveis, 'uni'),
    ('Papel manteiga',        cat_descartaveis, 'uni'),
    ('Papel toalha',          cat_descartaveis, 'pct'),
    ('Prato descartável',     cat_descartaveis, 'pct'),
    ('Saco plástico',         cat_descartaveis, 'pct'),
    ('Talheres descartáveis', cat_descartaveis, 'pct')
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- USUÁRIOS DE EXEMPLO (substitua com os dados reais)
-- Formato CPF: apenas dígitos (ex: 12345678901)
-- Formato data: YYYY-MM-DD
-- ============================================================
-- INSERT INTO usuarios (nome, cpf, data_nascimento) VALUES
--   ('Nome Usuário 1', '00000000001', '1990-01-15'),
--   ('Nome Usuário 2', '00000000002', '1992-05-20');
