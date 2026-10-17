import { requireEnv, openBrowser, collectConsole, login } from "./lib.mjs";
const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
await login(page, env);
try {
  const out = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const actor = await Actor.create({ name: "[TEST] Scratch", type: "crew" });
    await actor.createEmbeddedDocuments("Item", [
      { name: "A Dist", type: "distinction" }, { name: "Sig", type: "asset", system: { duration: "signature", die: 8 } },
      { name: "Sc", type: "asset", system: { duration: "scene", die: 6 } }, { name: "Tal", type: "talent" }
    ]);
    await actor.sheet.render({ force: true }); await wait(1200);
    const el = actor.sheet.element; const o = {};
    const nameSpan = el.querySelector('.lv-asset .lv-row-name[role="button"]');
    nameSpan.focus();
    nameSpan.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await wait(500);
    o.pressedAfterEnter = nameSpan.getAttribute("aria-pressed");
    o.dieBtnPressed = el.querySelector('.lv-asset .lv-die-btn').getAttribute("aria-pressed");
    o.attrBtnPressedAttr = el.querySelector('.lv-attributes .lv-name-btn').getAttribute("aria-pressed");
    // talent keyboard open
    const tal = el.querySelector('.lv-talents .lv-row-name[role="button"]');
    tal.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await wait(800);
    o.talentSheetOpened = [...foundry.applications.instances.values()].some((a) => a.document?.type === "talent");
    for (const a of [...foundry.applications.instances.values()]) if (a.document?.documentName === "Item") await a.close();
    // delete dist: no dialog
    el.querySelector('.lv-distinctions [data-action="deleteTraitItem"]').click(); await wait(800);
    o.distLeft = actor.itemTypes.distinction.length;
    o.dialogOpenAfterDist = Boolean(document.querySelector("dialog.dialog-v2, .application.dialog-v2"));
    // delete scene asset: no dialog
    const rows = [...el.querySelectorAll(".lv-asset")];
    const sc = rows.find((r) => r.textContent.includes("Sc"));
    const sig = rows.find((r) => r.textContent.includes("Sig"));
    sc.querySelector('[data-action="deleteAsset"]').click(); await wait(800);
    o.sceneLeft = actor.itemTypes.asset.length;
    sig.querySelector('[data-action="deleteAsset"]').click(); await wait(800);
    o.dialogOpenAfterSig = Boolean(document.querySelector(".application.dialog-v2, dialog.application"));
    document.querySelector('.application button[data-action="no"]')?.click(); await wait(500);
    o.sigLeft = actor.itemTypes.asset.length;
    // role menu closes with the sheet
    actor.sheet.element.querySelector('[data-action="addDie"]').click(); await wait(300);
    o.menuOpen = Boolean(actor.sheet.element.querySelector(".lv-pool-menu"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wait(300);
    o.menuAfterEsc = Boolean(actor.sheet.element.querySelector(".lv-pool-menu"));
    await actor.sheet.close(); await wait(300);
    await actor.sheet.render({ force: true }); await wait(1000);
    o.reopened = actor.sheet.rendered && actor.sheet.element.querySelectorAll(".lv-lock-seal").length;
    await actor.sheet.close(); await actor.delete();
    return o;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log("own errors:", log.own());
} finally {
  await page.evaluate(async () => { for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) await a.delete(); }).catch(() => {});
  await browser.close();
}
