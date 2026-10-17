/**
 * Socket channel `system.leverage-gta` (docs/04 "Sockets e permissões"). Actions that a player cannot do alone are
 * sent to the Fixer; only the active GM with the lowest id processes them. `game.socket.emit` does not reach the
 * sender, so `executeAsGM` runs the action locally when the sender is that GM.
 */
import { SYSTEM_ID } from "./config.mjs";
import { logger } from "./logger.mjs";

/** Socket channel name (needs `"socket": true` in system.json). */
export const SOCKET_CHANNEL = `system.${SYSTEM_ID}`;

/** @type {Map<string, (data: object, userId: string) => Promise<void>|void>} */
const HANDLERS = new Map();

/**
 * Registers the GM-side handler of an action.
 * @param {string} action
 * @param {(data: object, userId: string) => Promise<void>|void} handler `userId` is the requesting user.
 */
export function registerSocketAction(action, handler) {
  HANDLERS.set(action, handler);
}

/**
 * The GM that processes socket actions: the active GM with the lowest id.
 * @param {{id: string, active: boolean, isGM: boolean}[]} users
 * @returns {string|null} user id
 */
export function lowestActiveGM(users) {
  const ids = [...users].filter((u) => u.active && u.isGM).map((u) => u.id).sort();
  return ids[0] ?? null;
}

/**
 * Routes one incoming packet. Pure: the caller says whether this client is the processing GM.
 * @param {{action?: string, data?: object, userId?: string}} packet
 * @param {{isProcessor: boolean, handlers?: Map<string, Function>}} context
 * @returns {Promise<boolean>} true when a handler ran
 */
export async function routePacket(packet, { isProcessor, handlers = HANDLERS }) {
  const handler = isProcessor && packet?.action ? handlers.get(packet.action) : null;
  if (!handler) return false;
  await handler(packet.data ?? {}, packet.userId ?? "");
  return true;
}

const isProcessingGM = () => game.user.isGM && lowestActiveGM(game.users) === game.user.id;

/** Registers the channel listener (call once, from `ready`). */
export function registerSocket() {
  game.socket.on(SOCKET_CHANNEL, (packet) => {
    routePacket(packet, { isProcessor: isProcessingGM() }).catch((err) => logger.error("Socket action failed", err));
  });
}

/**
 * Runs an action as the Fixer: locally when this user is the processing GM, otherwise through the socket.
 * @param {string} action
 * @param {object} data
 * @returns {Promise<boolean>} false when no GM is connected to process it
 */
export async function executeAsGM(action, data) {
  const packet = { action, data, userId: game.user.id };
  if (isProcessingGM()) return routePacket(packet, { isProcessor: true });
  if (!lowestActiveGM(game.users)) {
    ui.notifications.warn(game.i18n.localize("LEVERAGE.Socket.noGM"));
    return false;
  }
  game.socket.emit(SOCKET_CHANNEL, packet);
  return true;
}
