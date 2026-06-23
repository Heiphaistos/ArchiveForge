import fs from 'fs/promises';
import path from 'path';
import type { GuildExport } from '../types.js';

export async function writeJsonExport(data: GuildExport, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'export.json'),
    JSON.stringify(data, null, 2),
    'utf-8'
  );
}
