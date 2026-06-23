import { discordClient } from './client.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { startExportWorker } from './workers/export.worker.js';

process.on('uncaughtException', (err) => logger.error('[process] uncaughtException', { err }));
process.on('unhandledRejection', (reason) => logger.error('[process] unhandledRejection', { reason }));

discordClient.once('ready', (client) => {
  logger.info(`[bot] Connecté en tant que ${client.user.tag}`);
  logger.info(`[bot] Guilds: ${client.guilds.cache.size}`);
  startExportWorker();
  logger.info('[worker] Export worker démarré (concurrency=2)');
});

discordClient.on('error', (err) => logger.error('[discord] Erreur client', { err }));
discordClient.on('warn', (info) => logger.warn('[discord]', { info }));

logger.info('[bot] Connexion à Discord…');
discordClient.login(config.DISCORD_TOKEN);
