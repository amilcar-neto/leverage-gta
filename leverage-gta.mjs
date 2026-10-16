/**
 * Leverage: Liberty City - system entry point.
 * Registers only what already exists; later tasks (docs/10-backlog.md) add the rest.
 */

import { LEVERAGE, SYSTEM_ID } from "./module/config.mjs";
import { logger } from "./module/logger.mjs";
import { registerSettings } from "./module/settings.mjs";
import * as actorModels from "./module/data/actor/_module.mjs";
import * as itemModels from "./module/data/item/_module.mjs";
import * as documents from "./module/documents/_module.mjs";

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
  CONFIG.Actor.documentClass = documents.LeverageActor;
  CONFIG.Item.documentClass = documents.LeverageItem;
  // TODO(T-301/T-202): sheet registration, Handlebars helpers and partials.
  // TODO(T-104): sheet registration, Handlebars helpers and partials.
});

Hooks.once("setup", () => {
  // TODO(T-103): game.leverage = api (before macros run).
});

Hooks.once("ready", () => {
  logger.info("Ready");
  // TODO(T-103): socket listener, migration check.
});
