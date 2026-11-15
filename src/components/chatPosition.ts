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
