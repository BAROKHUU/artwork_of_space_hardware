export const MEDIA_ROOTS: string[];
export function listMediaFiles(publicDir: string, roots?: string[], onMissing?: (dir: string) => void): Promise<string[]>;
