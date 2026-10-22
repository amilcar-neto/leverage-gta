// Junta docs/log/tmp-i18n-*.json em lang/en.json e lang/pt-BR.json (mescla profunda) e apaga os temporários.
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";

const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v)) merge((a[k] ??= {}), v);
    else a[k] = v;
  }
  return a;
};
const files = readdirSync("docs/log").filter((f) => /^tmp-i18n-.*\.json$/.test(f));
for (const lang of ["en", "pt-BR"]) {
  const path = `lang/${lang}.json`;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const f of files) merge(data, JSON.parse(readFileSync(`docs/log/${f}`, "utf8"))[lang] ?? {});
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}
for (const f of files) rmSync(`docs/log/${f}`);
console.log(`mesclados: ${files.join(", ") || "nada"}`);
