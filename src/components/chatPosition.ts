export const BOT_SIZE = 96;
export function clampPosition(position: { x: number; y: number }, width: number, height: number) {
  return {
    x: Math.max(0, Math.min(position.x, width - BOT_SIZE)),
    y: Math.max(0, Math.min(position.y, height - BOT_SIZE)),
  };
}

const MARGIN = 8;
const COMPACT = { width: 360, height: 460 };
const EXPANDED = { width: 760, height: 760 };
const MIN_HEIGHT = 220;

/**
 * Places the chat panel next to the bot without covering it: above the bot when it sits in the
 * lower half of the screen, below otherwise. Expanded mode only raises the size limits.
 */
export function panelLayout(bot: { x: number; y: number }, width: number, height: number, expanded: boolean) {
  const size = expanded ? EXPANDED : COMPACT;
  const panelWidth = Math.max(0, Math.min(size.width, width - MARGIN * 2));
  const above = bot.y > height / 2;
  const room = above ? bot.y - MARGIN * 2 : height - (bot.y + BOT_SIZE) - MARGIN * 2;
  const panelHeight = Math.max(Math.min(MIN_HEIGHT, height - MARGIN * 2), Math.min(size.height, room));
  const x = Math.max(MARGIN, Math.min(bot.x + BOT_SIZE / 2 - panelWidth / 2, width - panelWidth - MARGIN));
  const y = above
    ? Math.max(MARGIN, bot.y - panelHeight - MARGIN)
    : Math.min(bot.y + BOT_SIZE + MARGIN, height - panelHeight - MARGIN);
  return { x, y, width: panelWidth, height: panelHeight };
}

const BUBBLE_GAP = 10;
const BUBBLE_MAX_WIDTH = 244;
const BUBBLE_DEFAULT_SIZE = { width: 228, height: 58 };

/**
 * Places a compact pop-up speech bubble next to the bot without covering it: above the bot when
 * its center sits in the lower half of the screen, below otherwise, clamped inside viewport margins.
 */
export function bubbleLayout(
  bot: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
  bubbleSize: { width: number; height: number } = BUBBLE_DEFAULT_SIZE,
) {
  const maxWidth = Math.max(0, Math.min(BUBBLE_MAX_WIDTH, viewportWidth - MARGIN * 2));
  const width = Math.min(bubbleSize.width > 0 ? bubbleSize.width : BUBBLE_DEFAULT_SIZE.width, maxWidth);
  const height = Math.min(
    bubbleSize.height > 0 ? bubbleSize.height : BUBBLE_DEFAULT_SIZE.height,
    Math.max(0, viewportHeight - MARGIN * 2),
  );
  const above = bot.y + BOT_SIZE / 2 > viewportHeight / 2;
  const rightAligned = bot.x + BOT_SIZE / 2 > viewportWidth / 2;
  const rawX = rightAligned ? bot.x + BOT_SIZE - width : bot.x;
  const x = Math.max(MARGIN, Math.min(rawX, viewportWidth - width - MARGIN));
  const rawY = above ? bot.y - height - BUBBLE_GAP : bot.y + BOT_SIZE + BUBBLE_GAP;
  const y = Math.max(MARGIN, Math.min(rawY, viewportHeight - height - MARGIN));
  const side: 'above' | 'below' = above ? 'above' : 'below';
  const tailX = Math.max(18, Math.min(Math.max(18, width - 18), bot.x + BOT_SIZE / 2 - x));
  return { x, y, maxWidth, side, tailX };
}
