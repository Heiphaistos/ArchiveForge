import fs from 'fs/promises';
import { logger } from './logger.js';

export async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.info(`[cleanup] Supprimé: ${dirPath}`);
  } catch (err) {
    logger.error(`[cleanup] Échec suppression ${dirPath}`, { err });
  }
}
