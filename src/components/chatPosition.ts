export const BOT_SIZE = 96;
export function clampPosition(position: { x: number; y: number }, width: number, height: number) {
  return {
    x: Math.max(0, Math.min(position.x, width - BOT_SIZE)),
    y: Math.max(0, Math.min(position.y, height - BOT_SIZE)),
  };
}
