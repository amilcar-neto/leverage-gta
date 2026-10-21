/**
 * Placement of the Pool builder window (pure maths, no Foundry globals so it can be unit tested).
 */

/** Window size (px), the narrowest it may get, and the gap kept between it and the sheet. */
export const WIDTH = 620;
export const HEIGHT = 580;
export const MIN_WIDTH = 340;
export const GAP = 8;

/**
 * Where the window goes so it does not cover the sheet: beside it, on the side with more free room (right first when
 * both fit). When neither side fits the full width the window narrows to the room there is (never below MIN_WIDTH);
 * when not even that fits it covers the left edge of the sheet (the Assets column is on the right).
 * @param {{left: number, right: number, top: number}} box The sheet's bounding box.
 * @param {{width: number, height: number}} view The viewport.
 * @returns {{left: number, top: number, width: number, height: number}}
 */
export function placeBeside(box, view) {
  const roomRight = view.width - box.right - GAP * 2;
  const roomLeft = box.left - GAP * 2;
  const onRight = roomRight >= MIN_WIDTH && (roomRight >= WIDTH || roomRight >= roomLeft);
  const room = onRight ? roomRight : roomLeft;
  const width = Math.max(MIN_WIDTH, Math.min(WIDTH, room));
  const left = onRight ? box.right + GAP : Math.max(GAP, box.left - GAP - width);
  const height = Math.min(HEIGHT, view.height - GAP * 2);
  return {
    left: Math.max(GAP, Math.min(left, view.width - width - GAP)),
    top: Math.max(GAP, Math.min(box.top, view.height - height - GAP)),
    width, height
  };
}
