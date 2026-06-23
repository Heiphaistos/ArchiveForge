import { z } from 'zod';

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN requis'),
  REDIS_URL: z.string().url('REDIS_URL invalide'),
  EXPORTS_DIR: z.string().default('/app/exports'),
  LOGS_DIR: z.string().default('/app/.logs'),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error('[config] Variables d\'environnement manquantes:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = result.data;
