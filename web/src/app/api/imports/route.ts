import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { importJobs, exportJobs } from '@/db/schema';
import { getImportQueue } from '@/lib/queue';
import { randomUUID } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  sourceJobId: z.string().uuid(),
  targetGuildId: z.string().min(17).max(20),
  importCategories: z.boolean().default(true),
  importChannels: z.boolean().default(true),
  importRoles: z.boolean().default(false),
  importMessages: z.boolean().default(false),
  channelIds: z.array(z.string()).optional(),
  messageLimit: z.number().int().min(1).max(5000).default(200),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobs = await db
    .select()
    .from(importJobs)
    .orderBy(desc(importJobs.createdAt))
    .limit(50);

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [sourceJob] = await db.select().from(exportJobs).where(eq(exportJobs.id, parsed.data.sourceJobId));
  if (!sourceJob) {
    return NextResponse.json({ error: 'Export source introuvable' }, { status: 404 });
  }
  if (sourceJob.status !== 'completed' || !sourceJob.zipPath) {
    return NextResponse.json({ error: 'Export source non terminé' }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date();

  const payload = {
    zipPath: sourceJob.zipPath,
    sourceGuildName: sourceJob.guildName ?? sourceJob.guildId,
    targetGuildId: parsed.data.targetGuildId,
    importCategories: parsed.data.importCategories,
    importChannels: parsed.data.importChannels,
    importRoles: parsed.data.importRoles,
    importMessages: parsed.data.importMessages,
    channelIds: parsed.data.channelIds,
    messageLimit: parsed.data.messageLimit,
  };

  await db.insert(importJobs).values({
    id,
    sourceJobId: parsed.data.sourceJobId,
    sourceGuildName: sourceJob.guildName ?? null,
    targetGuildId: parsed.data.targetGuildId,
    status: 'pending',
    createdAt: now,
    options: JSON.stringify(payload),
  });

  await getImportQueue().add('import', payload, { jobId: id });

  return NextResponse.json({ id }, { status: 201 });
}
