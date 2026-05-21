// ================================================================
//  ⚙️  CONFIGURAÇÃO
// ================================================================
const SUPABASE_URL = 'https://mnvsxesmyzhbktgjolne.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aSU5COfoIPe9rkPbTecK9Q_bx5ptdT8';

const NFCE_FUNCTION_URL = '';

// ================================================================
//  STATE
// ================================================================
let sb, currentUser, currentList = null, allProducts = [], allCategorias = [];
let selectedProduct = null, nfceParsed = null, sugestaoItens = [];
let qrScanner = null, qrMode = 'lista';
let dashYear = new Date().getFullYear(), dashMonth = new Date().getMonth() + 1;
let chartPie = null, chartLine = null;

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ================================================================
//  INIT
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initDarkMode();
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const saved = localStorage.getItem('compras_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    await bootstrapApp();
  } else {
    showView('login');
  }
  document.getElementById('inp-cpf').addEventListener('input', maskCPF);
});

async function bootstrapApp() {
  document.getElementById('bottom-nav').classList.remove('hidden');
  const [prods, cats] = await Promise.all([
    sb.from('produtos').select('*, categorias(id,nome,cor)').eq('ativo', true).order('nome'),
    sb.from('categorias').select('*').order('ordem')
  ]);
  allProducts  = prods.data || [];
  allCategorias = cats.data || [];
  await loadCurrentList();
  showView('lista');
  loadHistorico();
}

// ================================================================
//  AUTH
// ================================================================
async function login() {
  const cpfInput = document.getElementById('inp-cpf');
  const cpf  = cpfInput.value.replace(/\D/g, '');
  const nasc = document.getElementById('inp-nasc').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');

  errEl.style.display = 'none';

  if (!cpf || !nasc) { showError('Preencha todos os campos.'); return; }
  if (cpf.length !== 11) { showError('CPF incompleto.'); cpfInput.focus(); return; }
  if (!validarCPF(cpf)) {
    showError('CPF inválido. Verifique os números digitados.');
    cpfInput.style.borderColor = 'var(--danger)';
    cpfInput.focus();
    return;
  }

  btn.disabled = true; btn.textContent = 'Verificando...';

  try {
    const { data, error, status, statusText } = await sb.from('usuarios')
      .select('*').eq('cpf', cpf).eq('data_nascimento', nasc).maybeSingle();

    btn.disabled = false; btn.textContent = 'Entrar';

    console.log('[Login] cpf enviado:', cpf, '| data:', nasc);
    console.log('[Login] status:', status, statusText);
    console.log('[Login] data:', data, '| error:', error);

    if (error) {
      if (error.code === 'PGRST116') {
        showError('Erro: CPF duplicado no banco. Corrija via Supabase.');
      } else if (status === 401 || status === 403) {
        showError('Permissão negada (RLS). Rode o SQL de configuração no Supabase.');
      } else {
        throw error;
      }
      return;
    }

    if (data) {
      cpfInput.style.borderColor = 'var(--accent)';
      currentUser = data;
      localStorage.setItem('compras_user', JSON.stringify(data));
      await bootstrapApp();
    } else {
      const { count } = await sb.from('usuarios').select('*', { count: 'exact', head: true });
      console.log('[Login] total de usuários visíveis:', count);
      if (count === 0 || count === null) {
        showError('Acesso bloqueado pelo banco (RLS). Rode o SQL de configuração no Supabase.');
      } else {
        showError('CPF ou data de nascimento incorretos.');
        cpfInput.style.borderColor = 'var(--danger)';
      }
    }
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Entrar';
    showError('Erro de conexão. Verifique sua internet e tente novamente.');
    console.error('[Login] exception:', e);
  }
}

function logout() {
  if (!confirm('Deseja sair?')) return;
  localStorage.removeItem('compras_user');
  currentUser = null;
  document.getElementById('bottom-nav').classList.add('hidden');
  showView('login');
}

function maskCPF(e) {
  e.target.value = e.target.value.replace(/\D/g,'')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})/,'$1-$2')
    .slice(0,14);
  validateCPFInput(e.target);
}

function validateCPFInput(input) {
  const digits = input.value.replace(/\D/g,'');
  if (digits.length === 0) { input.setCustomValidity(''); return true; }
  if (digits.length < 11) {
    input.style.borderColor = 'var(--border)';
    return false;
  }
  const ok = validarCPF(digits);
  input.style.borderColor = ok ? 'var(--accent)' : 'var(--danger)';
  return ok;
}

function validarCPF(cpf) {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf[10]);
}

// ================================================================
//  SHOPPING LIST
// ================================================================
async function loadCurrentList() {
  const now = new Date();
  const mes = now.getMonth() + 1, ano = now.getFullYear();
  document.getElementById('list-month-label').textContent = `${MESES[mes-1]} de ${ano}`;

  let { data: lista } = await sb.from('listas_compras')
    .select('*').eq('usuario_id', currentUser.id)
    .eq('mes', mes).eq('ano', ano).maybeSingle();

  if (!lista) {
    const { data } = await sb.from('listas_compras')
      .insert({ usuario_id: currentUser.id, mes, ano }).select().single();
    lista = data;
  }
  currentList = lista;

  const { data: items } = await sb.from('itens_lista')
    .select('*, produtos(id, nome, unidade_padrao, categorias(id,nome,cor))')
    .eq('lista_id', lista.id)
    .order('posicao').order('criado_em');

  renderList(items || []);
}

function renderList(items) {
  const unchecked = items.filter(i => !i.marcado);
  const checked   = items.filter(i => i.marcado);
  const total = items.length, done = checked.length;

  document.getElementById('list-count-label').textContent =
    `${done}/${total} itens marcados`;

  const container = document.getElementById('list-container');
  if (!items.length) {
    container.innerHTML = `<div class="list-empty">
      <span class="icon">🛒</span>
      <p>Sua lista está vazia.</p>
      <p class="text-muted" style="font-size:.85rem">Adicione itens ou use a sugestão do mês anterior.</p>
    </div>`;
    return;
  }

  let html = '';
  if (unchecked.length) {
    html += `<div class="section-title">A comprar (${unchecked.length})</div>
             <div class="list-section">`;
    html += unchecked.map(i => itemHTML(i)).join('');
    html += '</div>';
  }
  if (checked.length) {
    html += `<div class="section-title">Marcados (${checked.length})</div>
             <div class="list-section">`;
    html += checked.map(i => itemHTML(i)).join('');
    html += '</div>';
  }
  container.innerHTML = html;
}

function itemHTML(item) {
  const cat   = item.produtos?.categorias;
  const cor   = cat?.cor || '#aaa';
  const qty   = formatQty(item.quantidade);
  const cls   = item.marcado ? 'item-card checked' : 'item-card';
  return `<div class="${cls}" id="item-${item.id}">
    <div class="item-check" onclick="toggleItem('${item.id}', ${!item.marcado})"></div>
    <div class="item-cat-dot" style="background:${cor}"></div>
    <div class="item-info" onclick="toggleItem('${item.id}', ${!item.marcado})">
      <div class="item-name">${item.nome_produto}</div>
      <div class="item-qty">${qty} ${item.unidade}${cat ? ' · '+cat.nome : ''}</div>
    </div>
    <button class="item-del" onclick="removeItem('${item.id}')" title="Remover">
      <svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
    </button>
  </div>`;
}

async function toggleItem(id, checked) {
  await sb.from('itens_lista').update({ marcado: checked }).eq('id', id);
  await loadCurrentList();
}

async function removeItem(id) {
  await sb.from('itens_lista').delete().eq('id', id);
  await loadCurrentList();
  toast('Item removido');
}

// ================================================================
//  ADD ITEM VIEW
// ================================================================
function openAddItemView() {
  selectedProduct = null;
  document.getElementById('inp-search').value = '';
  document.getElementById('add-item-form').style.display = 'none';
  document.getElementById('product-list').innerHTML = '';
  showView('add-item');
  searchProducts('');
  setTimeout(() => document.getElementById('inp-search').focus(), 100);
}

function searchProducts(q) {
  const filtered = q.trim()
    ? allProducts.filter(p => p.nome.toLowerCase().includes(q.toLowerCase()))
    : allProducts.slice(0, 40);

  document.getElementById('product-list').innerHTML = filtered.map(p => `
    <div class="product-option" onclick="selectProduct(${JSON.stringify(p).replace(/"/g,'&quot;')})">
      <span>${p.nome}</span>
      <span class="cat-badge">${p.categorias?.nome || ''}</span>
    </div>`).join('') || '<div style="padding:12px;color:var(--text-light);font-size:.85rem">Nenhum produto encontrado</div>';
}

function selectProduct(p) {
  selectedProduct = p;
  document.getElementById('selected-product-name').textContent = p.nome;
  document.getElementById('inp-unit').value = p.unidade_padrao || 'uni';
  document.getElementById('add-item-form').style.display = 'block';
  document.getElementById('product-list').scrollTop = 0;
}

async function addSelectedItem() {
  if (!selectedProduct || !currentList) return;
  const qty  = parseFloat(document.getElementById('inp-qty').value) || 1;
  const unit = document.getElementById('inp-unit').value;
  const maxPos = await sb.from('itens_lista').select('posicao')
    .eq('lista_id', currentList.id).order('posicao', { ascending: false }).limit(1);
  const pos = (maxPos.data?.[0]?.posicao || 0) + 1;

  await sb.from('itens_lista').insert({
    lista_id: currentList.id,
    produto_id: selectedProduct.id,
    nome_produto: selectedProduct.nome,
    quantidade: qty,
    unidade: unit,
    posicao: pos
  });
  showView('lista');
  await loadCurrentList();
  toast('Item adicionado!', 'success');
}

// ================================================================
//  SUGESTÃO DO MÊS
// ================================================================
async function openModalSugestao() {
  sugestaoItens = [];
  document.getElementById('sugestao-list').innerHTML = '<div class="spinner"></div>';
  openModal('modal-sugestao');

  const { data: lastCompra } = await sb.from('compras')
    .select('id').eq('usuario_id', currentUser.id)
    .order('data_compra', { ascending: false }).limit(1).maybeSingle();

  if (!lastCompra) {
    document.getElementById('sugestao-list').innerHTML =
      '<p class="text-muted" style="font-size:.85rem">Nenhuma compra registrada ainda. Leia uma NFC-e primeiro.</p>';
    return;
  }

  const { data: items } = await sb.from('itens_compra')
    .select('*, categorias(nome,cor)').eq('compra_id', lastCompra.id);

  sugestaoItens = (items || []).map(i => ({
    nome: i.nome_original,
    quantidade: i.quantidade,
    unidade: i.unidade,
    categoria: i.categorias
  }));

  document.getElementById('sugestao-list').innerHTML = sugestaoItens.map((i, idx) => `
    <div class="item-card" style="background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <input type="checkbox" checked id="sug-${idx}" style="width:16px;height:16px">
      <div class="item-info">
        <div class="item-name">${i.nome}</div>
        <div class="item-qty">${formatQty(i.quantidade)} ${i.unidade}</div>
      </div>
    </div>`).join('') || '<p class="text-muted" style="font-size:.85rem">Nenhum item encontrado na última compra.</p>';
}

async function aplicarSugestao() {
  if (!currentList || !sugestaoItens.length) return;
  const selecionados = sugestaoItens.filter((_, i) =>
    document.getElementById(`sug-${i}`)?.checked);

  if (!selecionados.length) { toast('Nenhum item selecionado.'); return; }

  const rows = selecionados.map((i, idx) => ({
    lista_id: currentList.id,
    nome_produto: i.nome,
    quantidade: i.quantidade,
    unidade: i.unidade || 'uni',
    posicao: idx
  }));

  await sb.from('itens_lista').insert(rows);
  closeModal('modal-sugestao');
  await loadCurrentList();
  toast(`${rows.length} itens adicionados!`, 'success');
}

// ================================================================
//  QR CODE / NFC-e
// ================================================================
function openModalQR(mode) {
  qrMode = mode;
  document.getElementById('inp-nfce-url').value = '';
  document.getElementById('qr-status').textContent = '';
  document.getElementById('qr-reader').innerHTML = '';
  openModal('modal-qr');

  setTimeout(() => {
    try {
      qrScanner = new Html5QrcodeScanner('qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 });
      qrScanner.render(onQRSuccess, () => {});
    } catch(e) {
      document.getElementById('qr-reader').innerHTML =
        '<p style="color:var(--text-light);font-size:.85rem;text-align:center;padding:16px">Câmera não disponível. Use o campo de URL abaixo.</p>';
    }
  }, 300);
}

function onQRSuccess(text) {
  stopQRScanner();
  closeModal('modal-qr');
  processNFCeURL(text);
}

function stopQRScanner() {
  if (qrScanner) {
    try { qrScanner.clear(); } catch(e) {}
    qrScanner = null;
  }
}

function processNFCeFromInput() {
  const url = document.getElementById('inp-nfce-url').value.trim();
  if (!url) { toast('Cole o link da NFC-e'); return; }
  stopQRScanner();
  closeModal('modal-qr');
  processNFCeURL(url);
}

function nfceProgress(pct, msg) {
  const loader = document.getElementById('nfce-loader');
  loader.style.display = 'block';
  document.getElementById('nfce-loader-bar').classList.remove('fail');
  document.getElementById('nfce-loader-bar').style.width = pct + '%';
  document.getElementById('nfce-loader-pct').textContent = pct + '%';
  if (msg) document.getElementById('nfce-loader-msg').textContent = msg;
}

function nfceProgressDone(msg) {
  nfceProgress(100, msg || 'Pronto!');
  setTimeout(() => { document.getElementById('nfce-loader').style.display = 'none'; }, 900);
}

function nfceProgressFail(msg) {
  document.getElementById('nfce-loader-bar').classList.add('fail');
  document.getElementById('nfce-loader-bar').style.width = '100%';
  document.getElementById('nfce-loader-pct').textContent = '—';
  document.getElementById('nfce-loader-msg').textContent = msg || 'Falha ao buscar nota';
  setTimeout(() => { document.getElementById('nfce-loader').style.display = 'none'; }, 2500);
}

async function processNFCeURL(url) {
  nfceProgress(5, 'Conectando ao SEFAZ...');

  const chave    = extractChaveNFCe(url);
  const cleanUrl = url.includes('%7C') || url.includes('%7c')
    ? decodeURIComponent(url) : url;

  if (NFCE_FUNCTION_URL) {
    nfceProgress(15, 'Consultando servidor...');
    try {
      const res = await fetch(NFCE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ url: cleanUrl }),
        signal: AbortSignal.timeout(20000)
      });
      if (res.ok) {
        nfceProgress(85, 'Processando itens...');
        const dados = await res.json();
        if (dados?.itens?.length) {
          nfceProgressDone(`${dados.itens.length} itens encontrados!`);
          mostrarConfirmacaoNFCe(dados);
          return;
        }
      }
    } catch(e) { console.warn('[NFC-e] Edge function falhou:', e); }
  }

  const proxies = [
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,  decode: true  },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`,  decode: false },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, decode: true },
    { url: `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`,               decode: true  },
  ];

  let html = null;
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    nfceProgress(15 + Math.round((i / proxies.length) * 70), `Buscando via proxy ${i + 1}/${proxies.length}...`);
    try {
      const res = await fetch(proxy.url, { signal: AbortSignal.timeout(18000) });
      if (!res.ok) { console.warn('[NFC-e] proxy retornou', res.status, proxy.url); continue; }

      if (proxy.decode) {
        const buf = await res.arrayBuffer();
        html = new TextDecoder('iso-8859-1').decode(buf);
      } else {
        const json = await res.json();
        html = json.contents || null;
      }

      if (html && html.includes('tabResult')) break;
      html = null;
    } catch(e) { console.warn('[NFC-e] proxy erro:', proxy.url, e?.message); }
  }

  if (!html) {
    nfceProgressFail('Não foi possível buscar a nota.');
    toast('Não foi possível buscar a nota. Verifique sua conexão ou use a Edge Function.', 'error');
    return;
  }

  nfceProgress(92, 'Identificando produtos...');
  const dados = parseNFCeHTML(html, chave, url);
  if (!dados?.itens?.length) {
    nfceProgressFail('Produtos não encontrados.');
    toast('HTML obtido mas nenhum produto encontrado. Abra o console (F12) para detalhes.', 'error');
    console.error('[NFC-e] HTML recebido:', html.slice(0, 2000));
    return;
  }
  nfceProgressDone(`${dados.itens.length} itens encontrados!`);
  mostrarConfirmacaoNFCe(dados);
}

function extractChaveNFCe(url) {
  try {
    const decoded = decodeURIComponent(url);
    const p = new URL(decoded).searchParams.get('p') || decoded;
    return p.split('|')[0].replace(/\D/g, '').slice(0, 44);
  } catch { return ''; }
}

function parseNFCeHTML(html, chave, urlOriginal) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const itens = [];

  doc.querySelectorAll('#tabResult tr[id^="Item"]').forEach(row => {
    const nome      = row.querySelector('span.txtTit')?.textContent?.trim() ?? '';
    const qtdRaw    = row.querySelector('span.Rqtd')?.textContent?.replace(/Qtde\.?:?\s*/i, '').trim() ?? '0';
    const unRaw     = row.querySelector('span.RUN')?.textContent?.replace(/UN:?\s*/i, '').trim() ?? 'UN';
    const unitRaw   = row.querySelector('span.RvlUnit')?.textContent?.replace(/Vl\. Unit\.?:?\s*/i, '').trim() ?? '0';
    const totalRaw  = row.querySelector('span.valor')?.textContent?.trim() ?? '0';

    const quantidade     = parseMoeda(qtdRaw);
    const unidade        = unRaw.replace(/\s+/g, '').toUpperCase() || 'UN';
    const preco_unitario = parseMoeda(unitRaw);
    const preco_total    = parseMoeda(totalRaw);

    if (nome && quantidade > 0) {
      itens.push({ nome: nome.toUpperCase(), quantidade, unidade, preco_unitario, preco_total });
    }
  });

  const loja = doc.querySelector('.txtTopo')?.textContent?.trim() ?? 'Loja não identificada';

  let cnpj = '';
  doc.querySelectorAll('.text').forEach(el => {
    const m = el.textContent.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (m && !cnpj) cnpj = m[0];
  });

  const infos = doc.getElementById('infos')?.textContent ?? '';
  const dataMatch = infos.match(/Emiss[aã]o:?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
  const data = dataMatch?.[1] ?? '';

  let total = 0;
  doc.querySelectorAll('#linhaTotal, .linhaShade').forEach(div => {
    if (/[Vv]alor\s+[Aa]\s+[Pp]agar/.test(div.textContent)) {
      const v = parseMoeda(div.querySelector('.totalNumb')?.textContent ?? '');
      if (v > 0) total = v;
    }
  });
  if (!total) total = parseMoeda(doc.querySelector('.totalNumb.txtMax')?.textContent ?? '');

  return { loja, cnpj, data, total, chave, urlOriginal, itens };
}

function parseMoeda(str) {
  if (!str) return 0;
  const s = String(str).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
  return parseFloat(s) || 0;
}

function formatMoeda(v) {
  return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function formatQty(v) {
  return (v || 0) % 1 === 0 ? parseInt(v) : parseFloat(v).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

// ================================================================
//  NORMALIZAÇÃO E AUTO-CATEGORIZAÇÃO
// ================================================================
const ABREV_MAP = [
  ['AG SANIT',       'Água Sanitária'],
  ['AGUA M',         'Água Mineral'],
  ['ACHOC',          'Achocolatado'],
  ['BEB VEG',        'Bebida Vegetal'],
  ['REFRIGER',       'Refrigerante'],
  ['AROM',           'Aromatizante'],
  ['CR LEI',         'Creme de Leite'],
  ['L COCO',         'Leite de Coco'],
  ['L COND',         'Leite Condensado'],
  ['L PO',           'Leite em Pó'],
  ['LTE INT',        'Leite Integral'],
  ['LEITE COND',     'Leite Condensado'],
  ['LEITE INT',      'Leite Integral'],
  ['LEITE',          'Leite'],
  ['MUSS',           'Mussarela'],
  ['RQ CREM',        'Requeijão Cremoso'],
  ['REQUEIJ',        'Requeijão'],
  ['CARNE BOV',      'Carne Bovina'],
  ['CARNE MOL',      'Carne Moída'],
  ['COXINHA ASA',    'Coxinha de Asa'],
  ['FG PASS',        'Frango Passarinha'],
  ['FGO',            'Frango'],
  ['FRANGO INT',     'Frango Inteiro'],
  ['FRANGO',         'Frango'],
  ['HAMB',           'Hambúrguer'],
  ['PTS',            'Proteína de Soja'],
  ['SOBREC',         'Sobrecoxa'],
  ['PARM RAL',       'Queijo Parmesão Ralado'],
  ['QUEIJO MOZ',     'Queijo Mozzarela'],
  ['MANT',           'Manteiga'],
  ['MANTEIG',        'Manteiga'],
  ['AC MASC',        'Açúcar Mascavo'],
  ['AC DEM',         'Açúcar Demerara'],
  ['ARR',            'Arroz'],
  ['FEIJAO PTO',     'Feijão Preto'],
  ['FEIJAO C',       'Feijão Carioca'],
  ['FEIJAO P',       'Feijão Preto'],
  ['FEIJAO',         'Feijão'],
  ['FEIJ',           'Feijão'],
  ['F ROSCA',        'Farinha de Rosca'],
  ['F TR',           'Farinha de Trigo'],
  ['FARINHA MAND',   'Farinha de Mandioca'],
  ['FM FLEISCH',     'Fermento Fleischmann'],
  ['FERM PO',        'Fermento em Pó'],
  ['GOM MAND',       'Goma de Mandioca'],
  ['POLV',           'Polvilho'],
  ['MACARRAO',       'Macarrão'],
  ['MACAR',          'Macarrão'],
  ['MACAX',          'Macaxeira'],
  ['MAC',            'Macarrão'],
  ['PASTA AMENDO',   'Pasta de Amendoim'],
  ['MAION',          'Maionese'],
  ['AZ C',           'Azeitona'],
  ['AZ',             'Azeite'],
  ['EXTRATO TOM',    'Extrato de Tomate'],
  ['M POMAROLA',     'Molho de Tomate Pomarola'],
  ['MOLHO TOM',      'Molho de Tomate'],
  ['OL SJ',          'Óleo de Soja'],
  ['OLEO SOJA',      'Óleo de Soja'],
  ['OLEO SOJ',       'Óleo de Soja'],
  ['VINAGRERE',      'Vinagre'],
  ['VINAG',          'Vinagre'],
  ['LARAN',          'Laranja'],
  ['PIMENT',         'Pimentão'],
  ['LEG ERV',        'Ervilha'],
  ['SARD',           'Sardinha'],
  ['BISC ARR',       'Biscoito de Arroz'],
  ['COBERTOP',       'Cobertura de Chocolate'],
  ['PAC DA COL',     'Paçoca da Colônia'],
  ['PAO DE FORM',    'Pão de Forma'],
  ['BAT EUDOR',      'Batata'],
  ['CHEIRO V',       'Cheiro Verde'],
  ['ACUC',           'Açúcar'],
  ['AM COMF',        'Amaciante Confort'],
  ['CREME DENT',     'Creme Dental'],
  ['DET YPE',        'Detergente Ypê'],
  ['DIF SECAR',      'Difusor de Secagem'],
  ['DETERG',         'Detergente'],
  ['DET ',           'Detergente '],
  ['ESM',            'Esmalte'],
  ['OLA',            'Sabão de Coco Líquido'],
  ['SAB EM PO',      'Sabão em Pó'],
  ['SAB PO',         'Sabão em Pó'],
  ['SBT',            'Sabonete'],
  ['VASS',           'Vassoura'],
  ['PAPEL HIG',      'Papel Higiênico'],
  ['TOMATE PEL',     'Tomate Pelado'],
];

const VARIANT_MAP = [
  ['M AM',      'Meio Amargo'],
  ['ESP',       'Espaguete'],
  ['INT',       'Integral'],
  ['TRAD',      'Tradicional'],
  ['LAV',       'Lavanda'],
  ['BAUN',      'Baunilha'],
  ['CAST',      'Castanha'],
  ['CR',        'Cremosa'],
  ['CAMOMIL',   'Camomila'],
  ['FGO',       'Frango'],
  ['AL',        'Alcoólico'],
  ['LIGHT',     'Light'],
  ['DIET',      'Diet'],
  ['ZERO',      'Zero'],
  ['SC',        ''],
  ['ACU',       ''],
];

const BRAND_ABBREV_MAP = [
  ['DALL SE',   "Dall'Anna"],
  ['MARAT',     'Maratá'],
  ['ITAM',      'Itambé'],
  ['NATUQ',     'Natuquim'],
  ['JJ',        'Johnson & Johnson'],
  ['FLEISCH',   'Fleischmann'],
  ['CEPER',     'Ceper'],
  ['RISQUE',    'Risqué'],
  ['SADIA',     'Sadia'],
  ['POMAROLA',  'Pomarola'],
];

const CAT_MAP = [
  [['banana','laranja','manga','uva','mamao','abacaxi','caju','goiaba','limao',
    'abacate','morango','maracuja','pera','maca','melancia','melao','coco',
    'acerola','graviola','cupuacu','batata','cenoura','cebola','pimentao',
    'abobrinha','beterraba','pepino','berinjela','mandioca','macaxeira','inhame',
    'chuchu','quiabo','tomate','alface','couve','espinafre','cebolinha',
    'cheiro verde','coentro','salsa','rucula','hortela','repolho'], 'Hortifruti'],
  [['picanha','alcatra','contrafile','patinho','fraldinha','acem','musculo',
    'coxao','costela','bife','carne bov','carne mol','hamburguer',
    'frango','peito de','coxa de','sobrecoxa','galinha','peru','asa de',
    'coxinha','camarao','salmao','tilapia','bacalhau','merluza','peixe',
    'tambaqui','jaraqui','tucunare','pirarucu','pacu',
    'salsicha','linguica','presunto','mortadela','bacon','calabresa',
    'salame','apresuntado','ovos','ovo ','proteina de soja'], 'Carnes e Proteínas'],
  [['leite','queijo','manteiga','iogurte','requeijao','mussarela','cottage',
    'ricota','creme de leite','nata','margarina'], 'Laticínios'],
  [['arroz','feijao','milho verde','aveia','grao de bico','lentilha',
    'farinha','amido','maisena','polvilho','fuba','tapioca','goma',
    'macarrao','espaguete','penne','lasanha','talharim','massa',
    'atum','sardinha lata','milho enl','ervilha lata','palmito',
    'seleta','milho lata'], 'Mercearia'],
  [['sal fin','acucar','oleo de','oleo soja','vinagre','ketchup','mostarda',
    'maionese','azeite','molho de tomate','molho ingles','molho shoyu',
    'tempero','colorau','cominho','pimenta do reino','alho em','canela',
    'extrato tom','caldo','dendê','fermento','bicarbonato'], 'Temperos e Condimentos'],
  [['agua mineral','suco','refrigerante','cerveja','vinho','achocolatado',
    'cafe ','cha ','energetico','isoton','agua com gas','polpa de fruta',
    'bebida vegetal','leite de coco'], 'Bebidas'],
  [['biscoito','bolacha','pao ','bolo','chocolate','sorvete','bala',
    'chiclete','wafer','chips','salgadinho','paçoca','amendoim',
    'castanha','granola','torrada'], 'Padaria e Doces'],
  [['sabao','detergente','amaciante','desinfetante','agua sanitaria','cera',
    'esponja','vassoura','rodo','ype','flash limp','limpa vidros',
    'multiuso','alcool 70'], 'Limpeza'],
  [['shampoo','condicionador','creme dental','pasta dental','escova dental',
    'absorvente','fralda','sabonete','desodorante','perfume','locao',
    'protetor solar','papel higie','papel toalha','guardanapo',
    'saco lixo','filme pvc','papel alum'], 'Higiene e Cuidados'],
];

function titleCase(s) {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

function parseProduto(raw) {
  let s = raw.trim().toUpperCase();
  s = s.replace(/\b\d+[,.]?\d*\s*(KG|G|ML|L|LT|PCT|UN|GR|UND|CX|K)\b/gi, '');
  s = s.replace(/\s+\d+\s*$/, '');
  s = s.replace(/\s+/g, ' ').trim();

  let expandedPrefix = null;
  let remainderAfterPrefix = '';
  for (const [abrev, expansao] of ABREV_MAP) {
    const a = abrev.toUpperCase();
    if (s === a || (s.startsWith(a) && (a.endsWith(' ') || s[a.length] === ' '))) {
      expandedPrefix = expansao.toUpperCase();
      remainderAfterPrefix = s.slice(a.length).trim();
      break;
    }
  }

  if (!expandedPrefix) {
    return { nome: titleCase(s), marca: '' };
  }

  const tokens = remainderAfterPrefix ? remainderAfterPrefix.split(/\s+/) : [];
  const variantParts = [];
  const remaining = [...tokens];

  for (const [vk, vv] of VARIANT_MAP) {
    if (!vk.includes(' ')) continue;
    const vkWords = vk.split(/\s+/);
    if (remaining.length >= vkWords.length) {
      const tail = remaining.slice(-vkWords.length).join(' ');
      if (tail === vk) {
        if (vv) variantParts.unshift(vv);
        remaining.splice(-vkWords.length);
      }
    }
  }
  let keepStripping = true;
  while (keepStripping && remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    const entry = VARIANT_MAP.find(([vk]) => !vk.includes(' ') && vk === last);
    if (entry) {
      if (entry[1]) variantParts.unshift(entry[1]);
      remaining.pop();
    } else {
      keepStripping = false;
    }
  }

  let marca = '';
  if (remaining.length > 0) {
    const firstToken = remaining[0];
    const brandEntry = BRAND_ABBREV_MAP.find(([bk]) => bk.toUpperCase() === firstToken);
    if (brandEntry) {
      marca = brandEntry[1];
      const extra = remaining.slice(1);
      if (extra.length > 0) variantParts.push(...extra.map(v => titleCase(v)));
    } else {
      marca = titleCase(remaining.join(' '));
    }
  }

  const nomeParts = [expandedPrefix, ...variantParts.map(v => v.toUpperCase())].join(' ').trim();
  return { nome: titleCase(nomeParts), marca };
}

function normalizarNome(raw) {
  return parseProduto(raw).nome;
}

function deduplicarItens(itens) {
  const map = new Map();
  for (const it of itens) {
    const parsed = parseProduto(it.nome);
    const key = parsed.nome;
    if (map.has(key)) {
      const ex = map.get(key);
      ex.quantidade     += it.quantidade;
      ex.preco_total    += it.preco_total;
      ex.preco_unitario  = ex.preco_total / ex.quantidade;
    } else {
      map.set(key, { ...it, nome: parsed.nome, marca: parsed.marca });
    }
  }
  return Array.from(map.values());
}

function autoCategorizarItem(nome) {
  const strip = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = strip(nome) + ' ';
  for (const [keywords, catNome] of CAT_MAP) {
    if (keywords.some(k => norm.includes(k))) {
      const cat = allCategorias.find(c => strip(c.nome) === strip(catNome));
      return cat?.id ?? '';
    }
  }
  return '';
}

// ================================================================
//  CONFIRMAR NFC-e
// ================================================================
function mostrarConfirmacaoNFCe(dados) {
  dados = { ...dados, itens: deduplicarItens(dados.itens) };
  nfceParsed = dados;

  document.getElementById('nfce-info').innerHTML = `
    <p><strong>${dados.loja}</strong></p>
    ${dados.cnpj ? `<p>CNPJ: ${dados.cnpj}</p>` : ''}
    ${dados.data ? `<p>Data: ${dados.data}</p>` : ''}
    <p>Total: <strong>${formatMoeda(dados.total)}</strong> &nbsp;|&nbsp; ${dados.itens.length} itens</p>`;

  document.getElementById('nfce-table-body').innerHTML = dados.itens.map((it, idx) => {
    const autoId = autoCategorizarItem(it.nome);
    const marca = it.marca || '';
    return `
    <tr>
      <td>
        <input type="text" id="nfce-nome-${idx}" value="${it.nome.replace(/"/g,'&quot;')}" placeholder="Nome do produto">
        <input type="text" id="nfce-marca-${idx}" value="${marca.replace(/"/g,'&quot;')}" placeholder="marca" class="nfce-marca-input">
      </td>
      <td><input type="number" value="${it.quantidade}" min="0.001" step="0.001" id="nfce-qty-${idx}"></td>
      <td><select id="nfce-un-${idx}">
        ${['UN','KG','G','PCT','L','PC','FR','LA'].map(u =>
          `<option ${u===it.unidade||u===it.unidade?.toUpperCase()?'selected':''}>${u}</option>`
        ).join('')}
      </select></td>
      <td>${formatMoeda(it.preco_unitario)}</td>
      <td>${formatMoeda(it.preco_total)}</td>
      <td><select id="nfce-cat-${idx}">
        <option value="">— sem categoria —</option>
        ${allCategorias.map(c =>
          `<option value="${c.id}"${c.id === autoId ? ' selected' : ''}>${c.nome}</option>`
        ).join('')}
      </select></td>
      <td style="text-align:center"><input type="checkbox" id="nfce-extra-${idx}" style="width:18px;height:18px;cursor:pointer"></td>
    </tr>`;
  }).join('');

  openModal('modal-nfce');
}

async function confirmarCompra() {
  if (!nfceParsed || !currentUser) return;

  const itensAtualizados = nfceParsed.itens.map((it, idx) => ({
    ...it,
    nome: document.getElementById(`nfce-nome-${idx}`)?.value.trim() || it.nome,
    marca: document.getElementById(`nfce-marca-${idx}`)?.value.trim() || '',
    quantidade: parseFloat(document.getElementById(`nfce-qty-${idx}`).value) || it.quantidade,
    unidade: document.getElementById(`nfce-un-${idx}`).value || it.unidade,
    categoria_id: document.getElementById(`nfce-cat-${idx}`).value || null,
    fora_da_lista: document.getElementById(`nfce-extra-${idx}`)?.checked ?? false
  }));

  const dataCompra = nfceParsed.data
    ? parseDataBR(nfceParsed.data)
    : new Date().toISOString();

  const payload = {
    usuario_id: currentUser.id,
    lista_id: currentList?.id || null,
    chave_nfce: nfceParsed.chave || null,
    nome_loja: nfceParsed.loja,
    cnpj_loja: nfceParsed.cnpj || null,
    data_compra: dataCompra,
    valor_total: nfceParsed.total,
    dados_brutos: nfceParsed
  };

  let { data: compra, error } = await sb.from('compras').insert(payload).select().single();

  if (error) {
    if (error.code === '23505') {
      const substituir = confirm('Esta nota fiscal já foi registrada.\nDeseja excluir o registro anterior e salvar novamente?');
      if (!substituir) return;
      const { data: existing } = await sb.from('compras')
        .select('id').eq('chave_nfce', nfceParsed.chave).maybeSingle();
      if (existing) {
        const { error: delErr } = await sb.from('compras').delete().eq('id', existing.id);
        if (delErr) { toast('Erro ao excluir registro anterior.', 'error'); return; }
      }
      const { data: compra2, error: err2 } = await sb.from('compras').insert(payload).select().single();
      if (err2) { toast('Erro ao salvar. Tente novamente.', 'error'); return; }
      compra = compra2;
    } else {
      toast('Erro ao salvar. Tente novamente.', 'error');
      return;
    }
  }

  const rows = itensAtualizados.map(it => ({
    compra_id: compra.id,
    categoria_id: it.categoria_id || null,
    nome_original: it.nome,
    marca: it.marca || null,
    quantidade: it.quantidade,
    unidade: it.unidade,
    preco_unitario: it.preco_unitario,
    preco_total: it.preco_total,
    fora_da_lista: it.fora_da_lista ?? false
  }));

  const { error: itemsError } = await sb.from('itens_compra').insert(rows);
  if (itemsError) {
    if (itemsError.message?.includes('marca')) {
      const rowsSemMarca = rows.map(({ marca, ...r }) => r);
      const { error: e2 } = await sb.from('itens_compra').insert(rowsSemMarca);
      if (e2) {
        toast(`Compra salva, mas erro nos itens: ${e2.message}`, 'error');
        closeModal('modal-nfce');
        loadHistorico();
        return;
      }
    } else {
      toast(`Erro ao salvar itens: ${itemsError.message}`, 'error');
      closeModal('modal-nfce');
      loadHistorico();
      return;
    }
  }

  closeModal('modal-nfce');
  toast('Compra registrada com sucesso!', 'success');

  if (qrMode === 'historico') loadHistorico();
  else { await loadCurrentList(); loadHistorico(); }
}

function parseDataBR(str) {
  try {
    const [d, t] = str.split(' ');
    const [dd, mm, yyyy] = d.split('/');
    return new Date(`${yyyy}-${mm}-${dd}T${t || '00:00:00'}`).toISOString();
  } catch { return new Date().toISOString(); }
}

// ================================================================
//  HISTÓRICO
// ================================================================
async function loadHistorico() {
  const container = document.getElementById('historico-container');
  const { data: compras, error: histErr } = await sb.from('compras')
    .select('*').eq('usuario_id', currentUser.id)
    .order('data_compra', { ascending: false });

  if (histErr) {
    container.innerHTML = `<div class="list-empty">
      <span class="icon">⚠️</span>
      <p>Erro ao carregar histórico.</p>
      <p class="text-muted" style="font-size:.85rem">${histErr.message}</p>
    </div>`; return;
  }

  if (!compras?.length) {
    container.innerHTML = `<div class="list-empty">
      <span class="icon">🧾</span>
      <p>Nenhuma compra registrada.</p>
      <p class="text-muted" style="font-size:.85rem">Leia o QR Code de uma NFC-e para começar.</p>
    </div>`; return;
  }

  container.innerHTML = compras.map(c => {
    const data = c.data_compra ? new Date(c.data_compra).toLocaleDateString('pt-BR') : '-';
    return `<div class="purchase-card" id="card-${c.id}">
      <div class="purchase-header" onclick="togglePurchase('${c.id}')">
        <div>
          <div class="purchase-store">${c.nome_loja || 'Compra'}</div>
          <div class="purchase-date">${data}${c.cnpj_loja ? ' · CNPJ: '+c.cnpj_loja : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="purchase-total">${formatMoeda(c.valor_total)}</div>
          <button onclick="event.stopPropagation();deletarCompra('${c.id}')" title="Excluir compra"
            style="background:none;border:none;cursor:pointer;color:var(--text-light);font-size:1.1rem;padding:4px;line-height:1">🗑️</button>
        </div>
      </div>
      <div class="purchase-items" id="ph-${c.id}">
        <div style="padding:12px;color:var(--text-light);font-size:.85rem">Carregando...</div>
      </div>
    </div>`;
  }).join('');
}

async function togglePurchase(id) {
  const el = document.getElementById(`ph-${id}`);
  if (el.classList.contains('open')) {
    el.classList.remove('open'); return;
  }
  el.classList.add('open');
  if (el.querySelector('.purchase-item-row')) return;

  const { data: items } = await sb.from('itens_compra').select('*').eq('compra_id', id);
  if (!items?.length) {
    el.innerHTML = '<div style="padding:12px;font-size:.85rem;color:var(--text-light)">Nenhum item.</div>';
    return;
  }
  el.innerHTML = items.map(it => `
    <div class="purchase-item-row">
      <span>${it.nome_original} <span style="color:var(--text-light)">${formatQty(it.quantidade)} ${it.unidade}</span></span>
      <span class="bold">${formatMoeda(it.preco_total)}</span>
    </div>`).join('');
}

async function deletarCompra(id) {
  if (!confirm('Excluir esta compra e todos os seus itens?')) return;
  const { error } = await sb.from('compras').delete().eq('id', id);
  if (error) { toast('Erro ao excluir compra.', 'error'); return; }
  document.getElementById(`card-${id}`)?.remove();
  toast('Compra excluída.', 'success');
  loadDashboard();
}

// ================================================================
//  DASHBOARD
// ================================================================
async function loadDashboard() {
  document.getElementById('dash-month-label').textContent =
    `${MESES[dashMonth-1]} de ${dashYear}`;

  const from = `${dashYear}-${String(dashMonth).padStart(2,'0')}-01`;
  const toDate = new Date(dashYear, dashMonth, 1);
  const to = toDate.toISOString().slice(0, 10);

  const { data: compras, error: dashErr } = await sb.from('compras')
    .select('id,valor_total,data_compra')
    .eq('usuario_id', currentUser.id)
    .gte('data_compra', from).lt('data_compra', to);

  if (dashErr) { console.error('Dashboard error:', dashErr.message); }

  const totalMes    = (compras || []).reduce((s, c) => s + (parseFloat(c.valor_total) || 0), 0);
  const nVisitas    = (compras || []).length;
  const ticket      = nVisitas ? totalMes / nVisitas : 0;

  const ids = (compras || []).map(c => c.id);
  let gastosCat = {};
  let totalItens = 0;
  let totalExtras = 0;

  if (ids.length) {
    const { data: items, error: itemsErr } = await sb.from('itens_compra')
      .select('nome_original,preco_total,categoria_id,fora_da_lista,categorias(nome,cor)')
      .in('compra_id', ids);

    if (itemsErr) console.error('Erro itens dashboard:', itemsErr.message);

    (items || []).forEach(it => {
      totalItens++;
      const preco   = parseFloat(it.preco_total) || 0;
      const catNome = it.categorias?.nome || 'Sem categoria';
      const cor     = it.categorias?.cor  || '#95a5a6';
      if (!gastosCat[catNome]) gastosCat[catNome] = { total: 0, cor };
      gastosCat[catNome].total += preco;
      if (it.fora_da_lista) totalExtras += preco;
    });
  }

  document.getElementById('dash-total').textContent  = formatMoeda(totalMes);
  document.getElementById('dash-itens').textContent  = totalItens;
  document.getElementById('dash-compras').textContent = nVisitas;
  document.getElementById('dash-ticket').textContent  = formatMoeda(ticket);
  document.getElementById('dash-extras').textContent  = formatMoeda(totalExtras);

  renderPieChart(gastosCat);
  await renderLineChart();
}

function renderPieChart(gastosCat) {
  const labels = Object.keys(gastosCat);
  const values = labels.map(k => gastosCat[k].total);
  const colors = labels.map(k => gastosCat[k].cor);

  const canvas = document.getElementById('chart-pie');
  const empty  = document.getElementById('chart-pie-empty');
  if (chartPie) chartPie.destroy();

  if (!labels.length) {
    canvas.style.display = 'none';
    empty.style.display  = 'block';
    return;
  }
  canvas.style.display = 'block';
  empty.style.display  = 'none';

  const ctx = canvas.getContext('2d');
  chartPie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatMoeda(ctx.raw)}` } }
      }
    }
  });
}

async function renderLineChart() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(dashYear, dashMonth - 1 - i, 1);
    months.push({ mes: d.getMonth() + 1, ano: d.getFullYear(), label: MESES[d.getMonth()].slice(0,3) });
  }

  const datasets = [];
  const topCats  = allCategorias.slice(0, 6);

  for (const cat of topCats) {
    const values = [];
    for (const m of months) {
      const from = `${m.ano}-${String(m.mes).padStart(2,'0')}-01`;
      const toD  = new Date(m.ano, m.mes, 1).toISOString().slice(0, 10);
      const { data: compras } = await sb.from('compras')
        .select('id').eq('usuario_id', currentUser.id)
        .gte('data_compra', from).lt('data_compra', toD);
      const ids = (compras||[]).map(c=>c.id);
      let total = 0;
      if (ids.length) {
        const { data: items } = await sb.from('itens_compra')
          .select('preco_total').eq('categoria_id', cat.id).in('compra_id', ids);
        total = (items||[]).reduce((s,i)=>s+(parseFloat(i.preco_total)||0),0);
      }
      values.push(Math.round(total * 100) / 100);
    }
    if (values.some(v => v > 0)) {
      datasets.push({
        label: cat.nome,
        data: values,
        borderColor: cat.cor,
        backgroundColor: cat.cor + '20',
        tension: 0.4,
        fill: false,
        pointRadius: 4
      });
    }
  }

  const canvas = document.getElementById('chart-line');
  const empty  = document.getElementById('chart-line-empty');
  if (chartLine) chartLine.destroy();

  if (!datasets.length) {
    canvas.style.display = 'none';
    empty.style.display  = 'block';
    return;
  }
  canvas.style.display = 'block';
  empty.style.display  = 'none';

  const ctx = canvas.getContext('2d');
  chartLine = new Chart(ctx, {
    type: 'line',
    data: { labels: months.map(m => m.label), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatMoeda(ctx.raw)}` } }
      },
      scales: {
        y: { ticks: { callback: v => 'R$'+v.toLocaleString('pt-BR') }, beginAtZero: true }
      }
    }
  });
}

function dashboardPrevMonth() {
  dashMonth--;
  if (dashMonth < 1) { dashMonth = 12; dashYear--; }
  loadDashboard();
}

function dashboardNextMonth() {
  dashMonth++;
  if (dashMonth > 12) { dashMonth = 1; dashYear++; }
  loadDashboard();
}

// ================================================================
//  VIEW & MODAL NAVIGATION
// ================================================================
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('#bottom-nav button').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById(`nav-${name}`);
  if (navBtn) navBtn.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'historico') loadHistorico();
  if (name === 'login') { document.getElementById('bottom-nav').classList.add('hidden'); }

  stopQRScanner();
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
  if (id === 'modal-qr') stopQRScanner();
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) closeModal(m.id);
  });
});

// ================================================================
//  TOAST
// ================================================================
let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = '', 3000);
}

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ================================================================
//  DARK MODE
// ================================================================
function initDarkMode() {
  const saved = localStorage.getItem('dark_mode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved !== null ? saved === '1' : prefersDark;
  applyDark(isDark);
}

function toggleDark() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('dark_mode', isDark ? '1' : '0');
  applyDark(isDark);
}

function applyDark(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  const icon = document.getElementById('dark-icon');
  const label = document.getElementById('dark-label');
  if (!icon || !label) return;
  if (isDark) {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    label.textContent = 'Claro';
  } else {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    label.textContent = 'Escuro';
  }
  if (chartPie) { chartPie.options.plugins.legend.labels.color = isDark ? '#e2e8f0' : '#666'; chartPie.update(); }
  if (chartLine) { chartLine.options.scales.y.ticks.color = isDark ? '#8892a4' : '#666'; chartLine.update(); }
}
