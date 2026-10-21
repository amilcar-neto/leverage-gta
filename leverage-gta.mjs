/**
 * Leverage: Liberty City - system entry point.
 * Registers only what already exists; later tasks (docs/10-backlog.md) add the rest.
 */

import { LEVERAGE, SYSTEM_ID } from "./module/config.mjs";
import { logger } from "./module/logger.mjs";
import { registerSettings } from "./module/settings.mjs";
import { migrateWorld } from "./module/migration.mjs";
import { registerDieHelper } from "./module/applications/components/die.mjs";
import * as actorModels from "./module/data/actor/_module.mjs";
import * as itemModels from "./module/data/item/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as sheets from "./module/applications/actor/_module.mjs";
import { NpcSheet } from "./module/applications/actor/npc-sheet.mjs";
import { LocationSheet } from "./module/applications/actor/location-sheet.mjs";
import * as itemSheets from "./module/applications/item/_module.mjs";
import { registerDiceSoNice } from "./module/dice/dsn.mjs";
import { registerRollHandler } from "./module/dice/roll-handler.mjs";
import { registerSocket } from "./module/socket.mjs";
import { registerRollCard } from "./module/applications/chat/roll-card.mjs";
import { api, registerApi } from "./module/api.mjs";
import { registerSceneControls } from "./module/applications/gm/controls.mjs";
import { registerHud } from "./module/applications/hud/leverage-hud.mjs";

/** Registers one default sheet per Item type (T-401). */
function registerItemSheets() {
  const { DocumentSheetConfig } = foundry.applications.apps;
  const byType = {
    distinction: itemSheets.DistinctionSheet, talent: itemSheets.TalentSheet, specialty: itemSheets.SpecialtySheet,
    asset: itemSheets.AssetSheet, job: itemSheets.JobSheet
  };
  for (const [type, sheet] of Object.entries(byType)) {
    DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, sheet, { types: [type], makeDefault: true, label: "LEVERAGE.Sheet.Item" });
  }
}

Hooks.once("init", () => {
  logger.info(`Initializing ${SYSTEM_ID}`);
  CONFIG.LEVERAGE = LEVERAGE;
  CONFIG.Actor.dataModels = { crew: actorModels.CrewData, npc: actorModels.NpcData, location: actorModels.LocationData };
  CONFIG.Item.dataModels = {
    distinction: itemModels.DistinctionData,
    talent: itemModels.TalentData,
    specialty: itemModels.SpecialtyData,
    asset: itemModels.AssetData,
    job: itemModels.JobData
  };
  registerSettings();
  Hooks.on("hotbarDrop", sheets.onHotbarDrop);
  registerDieHelper();
  CONFIG.Actor.documentClass = documents.LeverageActor;
  CONFIG.Item.documentClass = documents.LeverageItem;
  CONFIG.Actor.trackableAttributes = {
    crew: { bar: ["life", "vest"], value: ["plotPoints.value", "money.steps"] },
    npc: { bar: ["life", "vest"], value: [] },
    location: { bar: [], value: [] }
  };
  // Part templates are loaded by ApplicationV2 itself; shared Handlebars partials are registered here.
  foundry.applications.handlebars.loadTemplates([`systems/${SYSTEM_ID}/templates/actor/crew/partials/x-button.hbs`]);
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, sheets.CrewSheet, {
    types: ["crew"], makeDefault: true, label: "LEVERAGE.Sheet.Crew"
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, LocationSheet, {
    types: ["location"], makeDefault: true, label: "LEVERAGE.LocationSheet.label"
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, NpcSheet, {
    types: ["npc"], makeDefault: true, label: "LEVERAGE.Sheet.Npc"
  });
  registerItemSheets();
  itemSheets.registerItemIcons();
  registerRollHandler();
  registerDiceSoNice();
  registerRollCard();
  registerSceneControls();
});

Hooks.once("setup", () => {
  registerApi();
});

Hooks.once("ready", async () => {
  logger.info("Ready");
  await migrateWorld();
  registerSocket();
  registerHud();
  Hooks.callAll("leverage.ready", api);
});
