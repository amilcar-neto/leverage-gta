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
  registerDieHelper();
  CONFIG.Actor.documentClass = documents.LeverageActor;
  CONFIG.Item.documentClass = documents.LeverageItem;
  CONFIG.Actor.trackableAttributes = {
    crew: { bar: ["life", "vest"], value: ["plotPoints.value", "money.steps"] },
    npc: { bar: ["life", "vest"], value: [] },
    location: { bar: [], value: [] }
  };
  // Part templates are loaded by ApplicationV2 itself; no shared partials exist yet (add loadTemplates here if one appears).
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, sheets.CrewSheet, {
    types: ["crew"], makeDefault: true, label: "LEVERAGE.Sheet.Crew"
  });
});

Hooks.once("setup", () => {
  // TODO(T-505): game.leverage = api (before macros run).
});

Hooks.once("ready", async () => {
  logger.info("Ready");
  await migrateWorld();
  // TODO(T-503): socket listener.
});
