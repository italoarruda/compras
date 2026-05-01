# Lista de Compras — Setup Completo

## Stack
| Camada | Serviço | Plano gratuito |
|--------|---------|----------------|
| Banco de dados + API | [Supabase](https://supabase.com) | ✅ 500 MB |
| Hospedagem frontend | [Netlify](https://netlify.com) | ✅ Ilimitado |
| Scraping NFC-e (opcional) | Supabase Edge Function | ✅ 500k req/mês |

---

## 1. Supabase — Criar projeto e banco

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Anote a **Project URL** e a **anon public key** (Settings → API)
3. No **SQL Editor**, cole e execute o conteúdo de `schema.sql`
4. Ainda no SQL Editor, adicione os dois usuários (substitua com os dados reais):

```sql
INSERT INTO usuarios (nome, cpf, data_nascimento) VALUES
  ('Seu Nome',    '00000000001', '1990-01-15'),
  ('Nome Cônjuge','00000000002', '1992-05-20');
```
> **CPF**: apenas dígitos, sem pontos/traço  
> **data_nascimento**: formato `AAAA-MM-DD`

---

## 2. Configurar o index.html

Abra `index.html` e atualize as linhas no início do `<script>`:

```js
const SUPABASE_URL = 'https://xxxxx.supabase.co';   // ← sua URL
const SUPABASE_KEY = 'eyJhbGc...';                   // ← sua anon key
```

---

## 3. Deploy no Netlify (hospedagem gratuita)

### Opção A — Arrastar e soltar (mais simples)
1. Acesse [app.netlify.com](https://app.netlify.com) → **Add new site → Deploy manually**
2. Arraste a pasta `compras/` para a área indicada
3. Pronto! Você recebe um link público como `https://xxx.netlify.app`

### Opção B — Via GitHub
1. Suba a pasta `compras/` em um repositório GitHub
2. No Netlify → **Add new site → Import from Git**
3. Selecione o repositório e clique em Deploy

---

## 4. (Opcional) Edge Function para NFC-e via Supabase

Use isso se o CORS proxy do navegador falhar.

```bash
# Instale a CLI do Supabase
npm install -g supabase

# Login e link com seu projeto
supabase login
supabase link --project-ref SEU_PROJECT_ID

# Deploy da função
supabase functions deploy scrape-nfce
```

No `index.html`, substitua a função `processNFCeURL` para usar:
```js
const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-nfce`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
  body: JSON.stringify({ url })
});
const dados = await res.json();
```

---

## Como usar o app

### Login
- Informe CPF (formato `000.000.000-00`) e data de nascimento

### Lista do Mês
- **Adicionar item**: busque na lista de produtos e informe quantidade
- **Marcar item**: toque no círculo — o item vai riscado para o fim da lista
- **Sugerir**: preenche automaticamente com os itens da última compra registrada
- **Ler NFC-e**: lê o QR Code da nota fiscal para registrar a compra

### Ler QR Code da NFC-e
1. Abra o app no celular → Lista → **Ler NFC-e**
2. Aponte a câmera para o QR Code na parte de baixo da nota fiscal
3. OU cole o link da NFC-e (ex: `https://sistemas.sefaz.am.gov.br/nfceweb/...`)
4. Revise os produtos e categorias → **Salvar Compra**

### Dashboard
- Navegue pelos meses com as setas
- **Gráfico de pizza**: distribuição dos gastos por categoria no mês
- **Gráfico de linhas**: tendência dos últimos 6 meses por categoria

### Histórico
- Lista todas as compras registradas
- Toque em uma compra para expandir e ver os itens

---

## Estrutura do banco

```
categorias      → grupos (Frutas, Carnes, Limpeza...)
produtos        → catálogo de itens (ligados a uma categoria)
usuarios        → 2 usuários (CPF + data nascimento)
listas_compras  → uma lista por usuário/mês/ano
itens_lista     → itens da lista do mês (checklist)
compras         → nota fiscal registrada (NFC-e)
itens_compra    → produtos da nota com preço
```
