import { requireEnv, openBrowser, relaunchWorld } from "./lib.mjs";
const env = requireEnv(["FOUNDRY_URL", "FOUNDRY_USER", "FOUNDRY_ADMIN_PASSWORD"]);
const { browser, page } = await openBrowser(env);
await relaunchWorld(page, env);
console.log("relaunched:", page.url().replace(/^https?:\/\/[^/]+/, ""));
await browser.close();
