// Supabase Edge Function — Scraping de NFC-e SEFAZ AM
// Seletores verificados em 01/05/2026 contra o portal nfceweb.
//
// Deploy: supabase functions deploy scrape-nfce
// Após deploy, coloque a URL em NFCE_FUNCTION_URL no index.html:
//   https://SEU_PROJETO.supabase.co/functions/v1/scrape-nfce

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const body = await req.json().catch(() => ({}));
  const url: string = body?.url ?? "";
  if (!url) {
    return new Response(JSON.stringify({ error: "url obrigatória" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" },
  }).catch(() => null);

  if (!resp?.ok) {
    return new Response(JSON.stringify({ error: `SEFAZ retornou ${resp?.status ?? "timeout"}` }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // A página é ISO-8859-1 — decodifica corretamente
  const buffer = await resp.arrayBuffer();
  const html = new TextDecoder("iso-8859-1").decode(buffer);

  const dados = parseNFCe(html, url);
  return new Response(JSON.stringify(dados), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

function parseMoeda(s: string): number {
  if (!s) return 0;
  // Remove tudo exceto dígitos e vírgula; troca vírgula por ponto
  return parseFloat(s.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

function extractChave(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const p = new URL(decoded).searchParams.get("p") ?? decoded;
    return p.split("|")[0].replace(/\D/g, "").slice(0, 44);
  } catch { return ""; }
}

function parseNFCe(html: string, urlOriginal: string) {
  const doc = new DOMParser().parseFromString(html, "text/html")!;
  const chave = extractChave(urlOriginal);
  const itens: object[] = [];

  // ── Produtos ──
  // Seletor real: table#tabResult > tr[id^="Item"]
  const rows = doc.querySelectorAll("#tabResult tr");
  for (const row of rows) {
    const id = row.getAttribute("id") ?? "";
    if (!id.startsWith("Item")) continue;

    const nome     = row.querySelector("span.txtTit")?.textContent?.trim() ?? "";
    const qtdText  = row.querySelector("span.Rqtd")?.textContent?.replace(/Qtde\.?:?\s*/i, "").trim() ?? "0";
    const unText   = row.querySelector("span.RUN")?.textContent?.replace(/UN:?\s*/i, "").trim() ?? "UN";
    const unitText = row.querySelector("span.RvlUnit")?.textContent?.replace(/Vl\. Unit\.?:?\s*/i, "").trim() ?? "0";
    const totText  = row.querySelector("span.valor")?.textContent?.trim() ?? "0";

    const quantidade     = parseMoeda(qtdText);
    const unidade        = unText.replace(/\s+/g, "").toUpperCase() || "UN";
    const preco_unitario = parseMoeda(unitText);
    const preco_total    = parseMoeda(totText);

    if (nome && quantidade > 0) {
      itens.push({ nome: nome.toUpperCase(), quantidade, unidade, preco_unitario, preco_total });
    }
  }

  // ── Loja ──
  const loja = doc.querySelector(".txtTopo")?.textContent?.trim() ?? "Loja não identificada";

  // ── CNPJ ──
  let cnpj = "";
  for (const el of doc.querySelectorAll(".text")) {
    const m = el.textContent?.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (m && !cnpj) { cnpj = m[0]; break; }
  }

  // ── Data de emissão ──
  const infos = doc.getElementById("infos")?.textContent ?? "";
  const dataMatch = infos.match(/Emiss[aã]o:?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
  const data = dataMatch?.[1] ?? "";

  // ── Valor a pagar ──
  let total = 0;
  for (const div of doc.querySelectorAll("#linhaTotal, .linhaShade")) {
    if (/[Vv]alor\s+[Aa]\s+[Pp]agar/.test(div.textContent ?? "")) {
      const v = parseMoeda(div.querySelector(".totalNumb")?.textContent ?? "");
      if (v > 0) { total = v; break; }
    }
  }
  if (!total) {
    total = parseMoeda(doc.querySelector(".totalNumb.txtMax")?.textContent ?? "");
  }

  return { loja, cnpj, data, total, chave, urlOriginal, itens };
}
