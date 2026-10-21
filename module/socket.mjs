/**
 * Socket channel `system.leverage-gta` (docs/04 "Sockets e permissões"). Actions that a player cannot do alone are
 * sent to the Fixer; only the active GM with the lowest id processes them. `game.socket.emit` does not reach the
 * sender, so `executeAsGM` runs the action locally when the sender is that GM.
 *
 * Packets are processed one at a time (`createSerialQueue`), in the order they arrive.
 *
 * Authenticity: the Foundry server relays a package of a system channel as `(data, senderUserId)` and fills the
 * second argument itself from the session (checked in `dist/server/sockets.mjs`, `handleCustomSocket`). The requester
 * is therefore ONLY that argument; the package carries no user id, so a console cannot forge another player.
 */
import { SYSTEM_ID } from "./config.mjs";
import { logger } from "./logger.mjs";

/** Socket channel name (needs `"socket": true` in system.json). */
export const SOCKET_CHANNEL = `system.${SYSTEM_ID}`;

/**
 * A queue that runs tasks one after another. A task that throws rejects only its own promise; the next one still runs.
 * Socket handlers read the state, await a write and then write again, so two at once (two loans from the same
 * wallet) could both see the old state and create Money. The Fixer processes the packets through one queue.
 * @returns {<T>(task: () => Promise<T>|T) => Promise<T>} `enqueue`
 */
export function createSerialQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
}

/** The queue of the packets the Fixer processes (also used by the local path of `executeAsGM`). */
const packetQueue = createSerialQueue();

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
 * @param {{action?: string, data?: object}} packet
 * @param {{isProcessor: boolean, userId: string, handlers?: Map<string, Function>}} context `userId` is the sender as
 *   authenticated by the server (never read from the packet).
 * @returns {Promise<boolean>} true when a handler ran
 */
export async function routePacket(packet, { isProcessor, userId = "", handlers = HANDLERS }) {
  const handler = isProcessor && packet?.action ? handlers.get(packet.action) : null;
  if (!handler) return false;
  await handler(packet.data ?? {}, userId);
  return true;
}

const isProcessingGM = () => game.user.isGM && lowestActiveGM(game.users) === game.user.id;

/** Registers the channel listener (call once, from `ready`). */
export function registerSocket() {
  game.socket.on(SOCKET_CHANNEL, (packet, userId) => {
    packetQueue(() => routePacket(packet, { isProcessor: isProcessingGM(), userId }))
      .catch((err) => logger.error("Socket action failed", err));
  });
}

/**
 * Runs an action as the Fixer: locally when this user is the processing GM, otherwise through the socket.
 * @param {string} action
 * @param {object} data
 * @returns {Promise<boolean>} false when no GM is connected to process it
 */
export async function executeAsGM(action, data) {
  const packet = { action, data };
  if (isProcessingGM()) return packetQueue(() => routePacket(packet, { isProcessor: true, userId: game.user.id }));
  if (!lowestActiveGM(game.users)) {
    ui.notifications.warn(game.i18n.localize("LEVERAGE.Socket.noGM"));
    return false;
  }
  game.socket.emit(SOCKET_CHANNEL, packet);
  return true;
}
