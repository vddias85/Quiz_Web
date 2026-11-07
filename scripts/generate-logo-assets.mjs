// Gera as versões do logo usadas pelo site a partir de logo/logo.jpg.
// Uso: npm run logo:build (rode de novo sempre que o logo mudar).
import sharp from "sharp";

const SRC = "logo/logo.jpg";

const meta = await sharp(SRC).metadata();
console.log(`Origem: ${SRC} (${meta.width} × ${meta.height})`);

// Logo no topo das páginas (mantém a proporção original).
for (const width of [256, 512]) {
  const out = `public/logo-${width}.webp`;
  await sharp(SRC).resize({ width }).webp({ quality: 82 }).toFile(out);
  console.log("→", out);
}

// Ícones quadrados (aba e atalho no celular): o logo inteiro, com as sobras
// preenchidas pela cor média da borda, para não cortar o texto.
const { dominant } = await sharp(SRC).extract({ left: 0, top: 0, width: meta.width, height: 8 }).stats();
for (const [out, size] of [
  ["src/app/icon.png", 192],
  ["src/app/apple-icon.png", 180],
]) {
  await sharp(SRC)
    .resize({ width: size, height: size, fit: "contain", background: { ...dominant, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("→", out);
}
