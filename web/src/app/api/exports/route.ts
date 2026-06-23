import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { exportJobs } from '@/db/schema';
import { getExportQueue } from '@/lib/queue';
import { randomUUID } from 'crypto';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  guildId: z.string().min(17).max(20),
  format: z.enum(['json', 'html', 'spa', 'markdown']),
  includeAttachments: z.boolean().default(false),
  channelIds: z.array(z.string()).optional(),
  afterDate: z.string().datetime().optional(),
  beforeDate: z.string().datetime().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobs = await db
    .select()
    .from(exportJobs)
    .orderBy(desc(exportJobs.createdAt))
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

  const id = randomUUID();
  const now = new Date();

  await db.insert(exportJobs).values({
    id,
    guildId: parsed.data.guildId,
    format: parsed.data.format,
    status: 'pending',
    createdAt: now,
    options: JSON.stringify(parsed.data),
  });

  await getExportQueue().add('export', parsed.data, { jobId: id });

  return NextResponse.json({ id }, { status: 201 });
}
