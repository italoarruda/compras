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
  marca          TEXT,
  quantidade     DECIMAL(10,3),
  unidade        TEXT,
  preco_unitario DECIMAL(10,2),
  preco_total    DECIMAL(10,2),
  fora_da_lista  BOOLEAN DEFAULT FALSE,
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_itens_compra ON itens_compra(compra_id);
CREATE INDEX IF NOT EXISTS idx_itens_cat ON itens_compra(categoria_id);

-- ============================================================
-- SEED: Categorias
-- ============================================================
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

-- ============================================================
-- SEED: Produtos (ordenados alfabeticamente por categoria)
-- ============================================================
DO $$
DECLARE
  cat_horti    UUID; cat_carnes  UUID; cat_latic    UUID;
  cat_mercea   UUID; cat_temp    UUID; cat_bebidas  UUID;
  cat_padaria  UUID; cat_limpeza UUID; cat_higiene  UUID;
BEGIN
  SELECT id INTO cat_horti    FROM categorias WHERE nome = 'Hortifruti';
  SELECT id INTO cat_carnes   FROM categorias WHERE nome = 'Carnes e Proteínas';
  SELECT id INTO cat_latic    FROM categorias WHERE nome = 'Laticínios';
  SELECT id INTO cat_mercea   FROM categorias WHERE nome = 'Mercearia';
  SELECT id INTO cat_temp     FROM categorias WHERE nome = 'Temperos e Condimentos';
  SELECT id INTO cat_bebidas  FROM categorias WHERE nome = 'Bebidas';
  SELECT id INTO cat_padaria  FROM categorias WHERE nome = 'Padaria e Doces';
  SELECT id INTO cat_limpeza  FROM categorias WHERE nome = 'Limpeza';
  SELECT id INTO cat_higiene  FROM categorias WHERE nome = 'Higiene e Cuidados';

  -- HORTIFRUTI (Frutas + Legumes + Verduras e Ervas)
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Abacate',           cat_horti, 'uni'), ('Abacaxi',       cat_horti, 'uni'),
    ('Açaí',              cat_horti, 'Kg'),  ('Acerola',       cat_horti, 'Kg'),
    ('Banana',            cat_horti, 'Kg'),  ('Banana da terra', cat_horti, 'Kg'),
    ('Caju',              cat_horti, 'Kg'),  ('Cajá',          cat_horti, 'Kg'),
    ('Coco',              cat_horti, 'uni'), ('Cupuaçu',       cat_horti, 'Kg'),
    ('Goiaba',            cat_horti, 'Kg'),  ('Graviola',      cat_horti, 'Kg'),
    ('Laranja',           cat_horti, 'Kg'),  ('Lima',          cat_horti, 'Kg'),
    ('Limão',             cat_horti, 'Kg'),  ('Maçã',          cat_horti, 'Kg'),
    ('Mamão',             cat_horti, 'Kg'),  ('Manga rosa',    cat_horti, 'Kg'),
    ('Maracujá',          cat_horti, 'Kg'),  ('Melancia',      cat_horti, 'uni'),
    ('Melão',             cat_horti, 'uni'), ('Morango',       cat_horti, 'pct'),
    ('Pera',              cat_horti, 'Kg'),  ('Uva',           cat_horti, 'Kg'),
    ('Abóbora',           cat_horti, 'Kg'),  ('Abobrinha',     cat_horti, 'Kg'),
    ('Batata doce',       cat_horti, 'Kg'),  ('Batata inglesa', cat_horti, 'Kg'),
    ('Berinjela',         cat_horti, 'Kg'),  ('Beterraba',     cat_horti, 'Kg'),
    ('Cebola branca',     cat_horti, 'Kg'),  ('Cebola roxa',   cat_horti, 'Kg'),
    ('Chuchu',            cat_horti, 'Kg'),  ('Inhame',        cat_horti, 'Kg'),
    ('Macaxeira',         cat_horti, 'Kg'),  ('Milho verde',   cat_horti, 'uni'),
    ('Pepino',            cat_horti, 'uni'), ('Pimentão amarelo', cat_horti, 'uni'),
    ('Pimentão verde',    cat_horti, 'uni'), ('Pimentão vermelho', cat_horti, 'uni'),
    ('Quiabo',            cat_horti, 'Kg'),  ('Tomate',        cat_horti, 'Kg'),
    ('Vagem',             cat_horti, 'Kg'),  ('Acelga',        cat_horti, 'maço'),
    ('Alface',            cat_horti, 'uni'), ('Alho',          cat_horti, 'uni'),
    ('Cebolinha',         cat_horti, 'maço'),('Coentro',       cat_horti, 'maço'),
    ('Couve',             cat_horti, 'maço'),('Espinafre',     cat_horti, 'maço'),
    ('Gengibre',          cat_horti, 'Kg'),  ('Hortelã',       cat_horti, 'maço'),
    ('Pimenta de cheiro', cat_horti, 'uni'), ('Rúcula',        cat_horti, 'maço'),
    ('Salsa',             cat_horti, 'maço')
  ON CONFLICT DO NOTHING;

  -- CARNES E PROTEÍNAS (Bovinas + Aves + Peixes + Embutidos + Ovos)
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Acém',               cat_carnes, 'Kg'), ('Alcatra',         cat_carnes, 'Kg'),
    ('Bisteca bovina',     cat_carnes, 'Kg'), ('Contrafilé',      cat_carnes, 'Kg'),
    ('Costela bovina',     cat_carnes, 'Kg'), ('Coxão mole',      cat_carnes, 'Kg'),
    ('Filé mignon',        cat_carnes, 'Kg'), ('Fraldinha',       cat_carnes, 'Kg'),
    ('Hambúrguer artesanal', cat_carnes, 'pct'), ('Lagarto',      cat_carnes, 'Kg'),
    ('Músculo',            cat_carnes, 'Kg'), ('Patinho',         cat_carnes, 'Kg'),
    ('Picanha',            cat_carnes, 'Kg'),
    ('Asa de frango',      cat_carnes, 'Kg'), ('Coxa de frango',  cat_carnes, 'Kg'),
    ('Coxa e sobrecoxa',   cat_carnes, 'Kg'), ('Coxinha de asa',  cat_carnes, 'pct'),
    ('Filé de frango',     cat_carnes, 'Kg'), ('Frango inteiro',  cat_carnes, 'Kg'),
    ('Linguiça de frango', cat_carnes, 'Kg'), ('Peito de frango', cat_carnes, 'Kg'),
    ('Peru',               cat_carnes, 'Kg'),
    ('Camarão',            cat_carnes, 'Kg'), ('Filé de pirarucu', cat_carnes, 'Kg'),
    ('Jaraqui',            cat_carnes, 'Kg'), ('Sardinha fresca', cat_carnes, 'Kg'),
    ('Tambaqui',           cat_carnes, 'Kg'), ('Tilápia',         cat_carnes, 'Kg'),
    ('Tucunaré',           cat_carnes, 'Kg'),
    ('Apresuntado',        cat_carnes, 'Kg'), ('Linguiça calabresa', cat_carnes, 'Kg'),
    ('Mortadela',          cat_carnes, 'Kg'), ('Presunto',        cat_carnes, 'Kg'),
    ('Salame',             cat_carnes, 'Kg'), ('Salsicha',        cat_carnes, 'pct'),
    ('Ovos branco',        cat_carnes, 'uni'),('Ovos caipira',    cat_carnes, 'uni'),
    ('Ovos codorna',       cat_carnes, 'uni'),('Ovos vermelhos',  cat_carnes, 'uni')
  ON CONFLICT DO NOTHING;

  -- LATICÍNIOS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Bebida láctea',         cat_latic, 'L'),   ('Creme de leite',       cat_latic, 'uni'),
    ('Iogurte grego',         cat_latic, 'uni'),  ('Iogurte natural',      cat_latic, 'uni'),
    ('Leite condensado',      cat_latic, 'uni'),  ('Leite de coco',        cat_latic, 'uni'),
    ('Leite desnatado',       cat_latic, 'L'),   ('Leite em pó',          cat_latic, 'pct'),
    ('Leite integral',        cat_latic, 'L'),   ('Manteiga',             cat_latic, 'uni'),
    ('Manteiga de garrafa',   cat_latic, 'uni'),  ('Margarina 500g',       cat_latic, 'uni'),
    ('Queijo coalho',         cat_latic, 'Kg'),  ('Queijo minas frescal', cat_latic, 'uni'),
    ('Queijo mussarela',      cat_latic, 'Kg'),  ('Queijo parmesão ralado', cat_latic, 'pct'),
    ('Requeijão',             cat_latic, 'uni')
  ON CONFLICT DO NOTHING;

  -- MERCEARIA (Grãos + Farinhas + Massas + Enlatados)
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Arroz branco',           cat_mercea, 'Kg'),  ('Arroz integral',     cat_mercea, 'Kg'),
    ('Arroz parboilizado',     cat_mercea, 'Kg'),  ('Aveia em flocos',    cat_mercea, 'pct'),
    ('Ervilha seca',           cat_mercea, 'Kg'),  ('Feijão branco',      cat_mercea, 'Kg'),
    ('Feijão carioca',         cat_mercea, 'Kg'),  ('Feijão de baião',    cat_mercea, 'Kg'),
    ('Feijão fradinho',        cat_mercea, 'Kg'),  ('Feijão preto',       cat_mercea, 'Kg'),
    ('Grão de bico',           cat_mercea, 'Kg'),  ('Lentilha',           cat_mercea, 'Kg'),
    ('Milho para pipoca',      cat_mercea, 'pct'), ('Quinoa',             cat_mercea, 'pct'),
    ('Amido de milho',         cat_mercea, 'pct'), ('Farinha de mandioca', cat_mercea, 'Kg'),
    ('Farinha de trigo branca', cat_mercea, 'Kg'), ('Farinha de trigo integral', cat_mercea, 'Kg'),
    ('Fubá mimoso',            cat_mercea, 'pct'), ('Goma de tapioca',    cat_mercea, 'pct'),
    ('Polvilho azedo',         cat_mercea, 'pct'), ('Polvilho doce',      cat_mercea, 'pct'),
    ('Lasanha',                cat_mercea, 'pct'), ('Macarrão ave-maria', cat_mercea, 'pct'),
    ('Macarrão espaguete',     cat_mercea, 'pct'), ('Macarrão espaguete integral', cat_mercea, 'pct'),
    ('Macarrão parafuso',      cat_mercea, 'pct'), ('Macarrão pena',      cat_mercea, 'pct'),
    ('Macarrão sopa',          cat_mercea, 'pct'),
    ('Atum em água',           cat_mercea, 'uni'), ('Atum em azeite',     cat_mercea, 'uni'),
    ('Ervilha lata',           cat_mercea, 'uni'), ('Milho lata',         cat_mercea, 'uni'),
    ('Palmito',                cat_mercea, 'uni'), ('Sardinha lata',      cat_mercea, 'uni'),
    ('Seleta de legumes',      cat_mercea, 'uni')
  ON CONFLICT DO NOTHING;

  -- TEMPEROS E CONDIMENTOS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Açafrão cúrcuma',    cat_temp, 'pct'), ('Azeite de oliva',   cat_temp, 'uni'),
    ('Azeitona preta',     cat_temp, 'pct'), ('Azeitona verde',    cat_temp, 'pct'),
    ('Canela em pó',       cat_temp, 'pct'), ('Colorau',           cat_temp, 'pct'),
    ('Cominho',            cat_temp, 'pct'), ('Dendê',             cat_temp, 'L'),
    ('Extrato de tomate',  cat_temp, 'uni'), ('Fermento em pó',    cat_temp, 'pct'),
    ('Ketchup',            cat_temp, 'uni'), ('Maionese',          cat_temp, 'uni'),
    ('Mel',                cat_temp, 'uni'), ('Molho de pimenta',  cat_temp, 'uni'),
    ('Molho inglês',       cat_temp, 'uni'), ('Molho shoyu',       cat_temp, 'uni'),
    ('Mostarda',           cat_temp, 'uni'), ('Óleo de coco',      cat_temp, 'uni'),
    ('Óleo de soja',       cat_temp, 'uni'), ('Orégano',           cat_temp, 'pct'),
    ('Pimenta do reino',   cat_temp, 'pct'), ('Sal refinado',      cat_temp, 'Kg'),
    ('Tempero baiano',     cat_temp, 'pct'), ('Vinagre de álcool', cat_temp, 'uni'),
    ('Vinagre de maçã',    cat_temp, 'uni')
  ON CONFLICT DO NOTHING;

  -- BEBIDAS
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Achocolatado',        cat_bebidas, 'uni'), ('Água com gás',    cat_bebidas, 'uni'),
    ('Água de coco',        cat_bebidas, 'uni'), ('Água mineral',    cat_bebidas, 'uni'),
    ('Café solúvel',        cat_bebidas, 'pct'), ('Café torrado moído', cat_bebidas, 'pct'),
    ('Chá verde',           cat_bebidas, 'pct'), ('Energético',      cat_bebidas, 'uni'),
    ('Polpa de fruta',      cat_bebidas, 'pct'), ('Refrigerante',    cat_bebidas, 'uni'),
    ('Suco de laranja',     cat_bebidas, 'uni'), ('Suco de uva integral', cat_bebidas, 'uni')
  ON CONFLICT DO NOTHING;

  -- PADARIA E DOCES
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Amendoim',             cat_padaria, 'Kg'),  ('Amêndoa',        cat_padaria, 'pct'),
    ('Barra de cereal',      cat_padaria, 'pct'), ('Biscoito cream cracker', cat_padaria, 'pct'),
    ('Biscoito Maizena',     cat_padaria, 'pct'), ('Castanha de caju', cat_padaria, 'Kg'),
    ('Castanha do pará',     cat_padaria, 'Kg'),  ('Chocolate ao leite', cat_padaria, 'uni'),
    ('Chocolate 70%',        cat_padaria, 'uni'), ('Granola',         cat_padaria, 'pct'),
    ('Paçoca',               cat_padaria, 'pct'), ('Pão de forma',    cat_padaria, 'uni'),
    ('Pão integral',         cat_padaria, 'uni'), ('Torradas',        cat_padaria, 'pct')
  ON CONFLICT DO NOTHING;

  -- LIMPEZA
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Água sanitária',     cat_limpeza, 'uni'), ('Álcool 70% gel',    cat_limpeza, 'uni'),
    ('Álcool 70% líquido', cat_limpeza, 'uni'), ('Amaciante',         cat_limpeza, 'uni'),
    ('Desinfetante',       cat_limpeza, 'uni'), ('Detergente',        cat_limpeza, 'uni'),
    ('Esponja dupla face', cat_limpeza, 'uni'), ('Limpa vidros',      cat_limpeza, 'uni'),
    ('Multiuso spray',     cat_limpeza, 'uni'), ('Sabão de coco barra', cat_limpeza, 'uni'),
    ('Sabão em pó',        cat_limpeza, 'pct'), ('Saco de lixo',      cat_limpeza, 'pct')
  ON CONFLICT DO NOTHING;

  -- HIGIENE E CUIDADOS (Higiene Pessoal + Descartáveis)
  INSERT INTO produtos (nome, categoria_id, unidade_padrao) VALUES
    ('Absorvente',         cat_higiene, 'pct'), ('Condicionador',     cat_higiene, 'uni'),
    ('Creme dental',       cat_higiene, 'uni'), ('Desodorante aerosol', cat_higiene, 'uni'),
    ('Desodorante roll-on', cat_higiene, 'uni'),('Escova de dentes',  cat_higiene, 'uni'),
    ('Fio dental',         cat_higiene, 'uni'), ('Fraldas',           cat_higiene, 'pct'),
    ('Lenço umedecido',    cat_higiene, 'pct'), ('Papel higiênico',   cat_higiene, 'pct'),
    ('Papel toalha',       cat_higiene, 'pct'), ('Sabonete barra',    cat_higiene, 'uni'),
    ('Sabonete líquido',   cat_higiene, 'uni'), ('Shampoo',           cat_higiene, 'uni'),
    ('Filme plástico',     cat_higiene, 'uni'), ('Papel alumínio',    cat_higiene, 'uni')
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
