// Supabase Edge Function — Scraping de NFC-e da SEFAZ
// Deploy: supabase functions deploy scrape-nfce
//
// Uso no frontend (substitua o CORS proxy direto):
//   const res = await fetch('https://SEU_PROJETO.supabase.co/functions/v1/scrape-nfce',
//     { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer ANON_KEY'},
//       body: JSON.stringify({ url: 'https://sistemas.sefaz.am.gov.br/...' }) });

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const { url } = await req.json().catch(() => ({}));
  if (!url) return new Response(JSON.stringify({ error: "url obrigatória" }), { status: 400, headers: CORS });

  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NFC-e Reader)" },
  }).catch(() => null);

  if (!resp?.ok) return new Response(JSON.stringify({ error: "Falha ao buscar página" }), { status: 502, headers: CORS });

  const html = await resp.text();
  const dados = parseNFCe(html, url);

  return new Response(JSON.stringify(dados), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

function parseMoeda(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

function parseNFCe(html: string, urlOriginal: string) {
  // Remove tags, normaliza espaços
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const chave = (() => {
    try {
      const p = new URL(urlOriginal).searchParams.get("p") || "";
      return p.split("|")[0].replace(/\D/g, "").slice(0, 44);
    } catch { return ""; }
  })();

  // Extrai loja / CNPJ / data / total
  const cnpjMatch  = texto.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  const dataMatch  = texto.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
  const totalMatch = texto.match(/[Vv]alor\s+[Aa]\s+[Pp]agar\s*R\$\s*:?\s*([\d.,]+)/);
  const lojaMatch  = texto.match(/([A-ZÁÀÃÂÉÊÍÓÕÔÚÜ][A-ZÁÀÃÂÉÊÍÓÕÔÚÜ\s]{5,}(?:S\/A|LTDA|EIRELI|ME|EPP))/);

  const loja  = lojaMatch?.[0]?.trim() || "Loja";
  const cnpj  = cnpjMatch?.[1] || "";
  const data  = dataMatch?.[1] || "";
  const total = parseMoeda(totalMatch?.[1] || "");

  // Extrai itens — padrão: blocos "NOME (Código: XXXX) Qtde.: N UN Vl. Unit.: R$ X,XX Vl. Total: R$ X,XX"
  const itens: object[] = [];
  const itemPattern = /([A-ZÁÀÃÂÉÊÍÓÕÔÚÜ][^\n(]{3,40?})\s+(?:\(.*?\)\s+)?Qtde\.\s*:\s*([\d,]+)\s*([A-Za-z]+)\s+Vl\.\s*Unit\.\s*:\s*R?\$?\s*([\d.,]+)\s+Vl\.\s*Total\s*:\s*R?\$?\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = itemPattern.exec(texto)) !== null) {
    itens.push({
      nome: m[1].trim().toUpperCase(),
      quantidade: parseFloat(m[2].replace(",", ".")),
      unidade: m[3].toUpperCase(),
      preco_unitario: parseMoeda(m[4]),
      preco_total: parseMoeda(m[5]),
    });
  }

  return { loja, cnpj, data, total, chave, urlOriginal, itens };
}
