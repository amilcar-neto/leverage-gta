/**
 * Leverage: Liberty City — system entry point.
 *
 * Skeleton only: it loads, logs, and lets you create a world. The real registration
 * (data models, sheets, settings, HUD) is built by the tasks in docs/10-backlog.md.
 */

const SYSTEM_ID = "leverage-gta";

Hooks.once("init", () => {
  console.log(`Leverage | Initializing ${SYSTEM_ID} (skeleton)`);
});

Hooks.once("ready", () => {
  console.log("Leverage | Ready");
});
