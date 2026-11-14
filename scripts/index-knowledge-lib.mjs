export function retryDelayMs(headers, attempt) {
  const retryAfter = headers.get('retry-after');
  if (retryAfter && Number.isFinite(Number(retryAfter))) return Math.max(1000, Number(retryAfter) * 1000);
  if (retryAfter) {
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(1000, retryAt - Date.now());
  }
  return Math.min(60000, 1000 * 2 ** attempt);
}
