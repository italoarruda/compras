/**
 * Validation tests for the compras project.
 * Uses only Node.js built-in assert module — no build system required.
 * Run with: node tests/validation.test.js
 */

const assert = require('assert');

// ─── Helpers copied / extracted from app.js logic ────────────────────────────

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

function validateItemValue(valor) {
  const n = parseFloat(valor);
  return !isNaN(n) && n > 0;
}

function validateCategory(categoria) {
  return typeof categoria === 'string' && categoria.trim().length > 0;
}

// NFC-e QR Code URLs start with a known SEFAZ endpoint pattern
function validateQRCodeURL(url) {
  if (typeof url !== 'string' || url.trim().length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

// ─── Item value validation ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

console.log('\n--- validateItemValue ---');

test('valor positivo é válido', () => {
  assert.strictEqual(validateItemValue(10.5), true);
});

test('valor zero é inválido', () => {
  assert.strictEqual(validateItemValue(0), false);
});

test('valor negativo é inválido', () => {
  assert.strictEqual(validateItemValue(-5), false);
});

test('string numérica positiva é válida', () => {
  assert.strictEqual(validateItemValue('3.99'), true);
});

test('string vazia é inválida', () => {
  assert.strictEqual(validateItemValue(''), false);
});

test('texto não-numérico é inválido', () => {
  assert.strictEqual(validateItemValue('abc'), false);
});

// ─── Category validation ──────────────────────────────────────────────────────

console.log('\n--- validateCategory ---');

test('categoria com texto é válida', () => {
  assert.strictEqual(validateCategory('Alimentos'), true);
});

test('categoria vazia é inválida', () => {
  assert.strictEqual(validateCategory(''), false);
});

test('categoria só espaços é inválida', () => {
  assert.strictEqual(validateCategory('   '), false);
});

test('null não é categoria válida', () => {
  assert.strictEqual(validateCategory(null), false);
});

test('undefined não é categoria válida', () => {
  assert.strictEqual(validateCategory(undefined), false);
});

// ─── QR Code URL validation ───────────────────────────────────────────────────

console.log('\n--- validateQRCodeURL ---');

test('URL HTTPS válida é aceita', () => {
  assert.strictEqual(
    validateQRCodeURL('https://nfce.sefaz.ce.gov.br/pages/showNFCe.html?p=chave123'),
    true
  );
});

test('URL HTTPS simples é aceita', () => {
  assert.strictEqual(validateQRCodeURL('https://example.com/nfce'), true);
});

test('URL HTTP é rejeitada', () => {
  assert.strictEqual(validateQRCodeURL('http://example.com/nfce'), false);
});

test('string vazia é rejeitada', () => {
  assert.strictEqual(validateQRCodeURL(''), false);
});

test('texto sem protocolo é rejeitado', () => {
  assert.strictEqual(validateQRCodeURL('example.com/nfce'), false);
});

test('null é rejeitado', () => {
  assert.strictEqual(validateQRCodeURL(null), false);
});

// ─── CPF validation ───────────────────────────────────────────────────────────

console.log('\n--- validarCPF ---');

test('CPF válido com formatação é aceito', () => {
  assert.strictEqual(validarCPF('529.982.247-25'), true);
});

test('CPF válido sem formatação é aceito', () => {
  assert.strictEqual(validarCPF('52998224725'), true);
});

test('CPF com todos dígitos iguais é rejeitado', () => {
  assert.strictEqual(validarCPF('111.111.111-11'), false);
});

test('CPF com zeros repetidos é rejeitado', () => {
  assert.strictEqual(validarCPF('00000000000'), false);
});

test('CPF com dígito verificador errado é rejeitado', () => {
  assert.strictEqual(validarCPF('529.982.247-35'), false);
});

test('CPF incompleto é rejeitado', () => {
  assert.strictEqual(validarCPF('123.456.789'), false);
});

test('CPF vazio é rejeitado', () => {
  assert.strictEqual(validarCPF(''), false);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Resultado: ${passed} passou, ${failed} falhou`);
if (failed > 0) process.exit(1);
