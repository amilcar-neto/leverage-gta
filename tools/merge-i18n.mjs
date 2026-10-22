// Junta docs/log/tmp-i18n-*.json (campo opcional "_delete": chaves a apagar) em lang/en.json e lang/pt-BR.json (mescla profunda) e apaga os temporários.
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";

const merge = (a, b) => {
  for (const [rawKey, v] of Object.entries(b)) {
    if (rawKey.startsWith("_")) continue;
    const path = rawKey.split(".");
    const k = path.pop();
    const target = path.reduce((node, part) => (node[part] ??= {}), a);
    if (v && typeof v === "object" && !Array.isArray(v)) merge((target[k] ??= {}), v);
    else target[k] = v;
  }
  return a;
};
const files = readdirSync("docs/log").filter((f) => /^tmp-i18n-.*\.json$/.test(f));
for (const lang of ["en", "pt-BR"]) {
  const path = `lang/${lang}.json`;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const f of files) {
    const part = JSON.parse(readFileSync(`docs/log/${f}`, "utf8"));
    merge(data, part[lang] ?? {});
    for (const key of part._delete ?? []) {
      const path = key.split(".");
      const leaf = path.pop();
      const parent = path.reduce((node, k) => node?.[k], data);
      if (parent) delete parent[leaf];
    }
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}
for (const f of files) rmSync(`docs/log/${f}`);
console.log(`mesclados: ${files.join(", ") || "nada"}`);
