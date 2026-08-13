/**
 * Gera todos os ícones do Valida a partir da mesma geometria do selo
 * (client/public/favicon.svg): retângulo arredondado verde + checkmark branco.
 *
 *   node scripts/gerar-favicons.mjs
 *
 * Não usa nenhuma dependência: rasteriza por campo de distância (com
 * anti-aliasing) e escreve PNG/ICO com o zlib nativo do Node. Assim o ícone
 * nunca sai do lugar em relação ao SVG — os dois vêm dos mesmos números.
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

// ---------------------------------------------------------------------------
// Geometria, no mesmo sistema do SVG (viewBox 0 0 64 64)
// ---------------------------------------------------------------------------
const CAIXA = 64;
const RAIO_CANTO = 16;
const VERDE = [0x1a, 0x9c, 0x62]; // #1a9c62 — mesma cor de --primary
const BRANCO = [0xff, 0xff, 0xff];

// path "M46 21 27.5 39.5 18 30" com stroke-width 7, linecap/linejoin round
const TRACO = [
  [[46, 21], [27.5, 39.5]],
  [[27.5, 39.5], [18, 30]],
];
const ESPESSURA = 7;

/** Distância de um ponto ao segmento AB (a "cápsula" dá o linecap redondo). */
function distSegmento(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const c2 = vx * vx + vy * vy;
  const t = c2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / c2));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

/** Distância assinada ao retângulo arredondado (negativa = dentro). */
function distRetArredondado(px, py, lado, raio) {
  const meio = lado / 2;
  const qx = Math.abs(px - meio) - (meio - raio);
  const qy = Math.abs(py - meio) - (meio - raio);
  const fx = Math.max(qx, 0), fy = Math.max(qy, 0);
  return Math.hypot(fx, fy) + Math.min(Math.max(qx, qy), 0) - raio;
}

/** Cobertura do pixel a partir da distância assinada: AA de ~1px. */
const cobertura = (d) => Math.max(0, Math.min(1, 0.5 - d));

/**
 * Rasteriza o selo em RGBA.
 * @param n tamanho em pixels
 * @param opts.raio raio dos cantos em unidades de 64 (0 = quadrado cheio)
 * @param opts.margem recuo APENAS do checkmark, em unidades de 64. O fundo
 *   sempre preenche a área toda — é o que um ícone maskable exige: o sistema
 *   recorta as bordas, então quem precisa caber na safe zone é o desenho, não
 *   o fundo. Encolher os dois deixaria uma moldura transparente que o
 *   recorte transformaria em cantos vazados.
 */
export function rasterizar(n, { raio = RAIO_CANTO, margem = 0 } = {}) {
  const buf = Buffer.alloc(n * n * 4);
  const escala = n / CAIXA;
  const k = (CAIXA - margem * 2) / CAIXA; // encolhimento do checkmark

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // centro do pixel, convertido para o sistema do SVG
      const sx = (x + 0.5) / escala;
      const sy = (y + 0.5) / escala;

      // coordenadas do checkmark, encolhidas para dentro da margem
      const gx = (sx - margem) / k;
      const gy = (sy - margem) / k;

      const dFundo = distRetArredondado(sx, sy, CAIXA, raio);
      let dCheck = Infinity;
      for (const [a, b] of TRACO) dCheck = Math.min(dCheck, distSegmento(gx, gy, a, b));
      dCheck = (dCheck - ESPESSURA / 2) * k;

      const aFundo = cobertura(dFundo * escala);
      const aCheck = cobertura(dCheck * escala);

      // compõe branco sobre verde, e o conjunto sobre transparente
      const alpha = aFundo;
      let r = VERDE[0], g = VERDE[1], b2 = VERDE[2];
      if (aCheck > 0) {
        r = r * (1 - aCheck) + BRANCO[0] * aCheck;
        g = g * (1 - aCheck) + BRANCO[1] * aCheck;
        b2 = b2 * (1 - aCheck) + BRANCO[2] * aCheck;
      }

      const i = (y * n + x) * 4;
      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b2);
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Escrita de PNG
// ---------------------------------------------------------------------------
const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

export function paraPNG(rgba, largura, altura = largura) {
  // filtro 0 (None) em cada linha
  const passo = largura * 4;
  const bruto = Buffer.alloc(altura * (passo + 1));
  for (let y = 0; y < altura; y++) {
    bruto[y * (passo + 1)] = 0;
    rgba.copy(bruto, y * (passo + 1) + 1, y * passo, (y + 1) * passo);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;  // bits por canal
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(bruto, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO com PNGs embutidos (suportado desde o Vista; é o formato usual hoje). */
function paraICO(pngs) {
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(0, 0);
  cab.writeUInt16LE(1, 2);          // tipo 1 = ícone
  cab.writeUInt16LE(pngs.length, 4);
  let deslocamento = 6 + pngs.length * 16;
  const entradas = [];
  for (const { n, dados } of pngs) {
    const e = Buffer.alloc(16);
    e[0] = n >= 256 ? 0 : n;        // 0 significa 256
    e[1] = n >= 256 ? 0 : n;
    e[4] = 1;                        // planos
    e.writeUInt16LE(32, 6);          // bits por pixel
    e.writeUInt32BE(0, 8);
    e.writeUInt32LE(dados.length, 8);
    e.writeUInt32LE(deslocamento, 12);
    entradas.push(e);
    deslocamento += dados.length;
  }
  return Buffer.concat([cab, ...entradas, ...pngs.map((p) => p.dados)]);
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------
const DESTINO = 'client/public';

export const png = (n, opts) => paraPNG(rasterizar(n, opts), n);

// Só grava quando executado direto (`node scripts/gerar-favicons.mjs`);
// importado, expõe apenas as funções.
const executadoDireto =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
const arquivos = {
  // Compatibilidade: nome já referenciado no JSON-LD e em links antigos.
  'favicon.png': png(512),
  'favicon-96.png': png(96),
  // PWA (manifest)
  'icon-192.png': png(192),
  'icon-512.png': png(512),
  // Maskable: o sistema recorta em círculo/squircle, então o desenho precisa
  // caber na "safe zone" (~80% central) e o fundo vai até a borda.
  'icon-maskable-512.png': png(512, { raio: 0, margem: 6.4 }),
  // iOS aplica a própria máscara de canto: o ícone tem que ser quadrado cheio,
  // senão sobram cantos transparentes por baixo do arredondamento do sistema.
  'apple-touch-icon.png': png(180, { raio: 0 }),
};

for (const [nome, dados] of Object.entries(arquivos)) {
  const caminho = join(DESTINO, nome);
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, dados);
  console.log(`${nome.padEnd(26)} ${(dados.length / 1024).toFixed(1)} KB`);
}

// /favicon.ico é pedido automaticamente por navegadores e por vários agregadores
const ico = paraICO([16, 32, 48].map((n) => ({ n, dados: png(n) })));
writeFileSync(join(DESTINO, 'favicon.ico'), ico);
console.log(`${'favicon.ico'.padEnd(26)} ${(ico.length / 1024).toFixed(1)} KB (16/32/48)`);
}
