import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { exportJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getExportQueue } from '@/lib/queue';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, id));
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(job);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const bullJob = await getExportQueue().getJob(id);
  if (bullJob) await bullJob.remove();
  await db.delete(exportJobs).where(eq(exportJobs.id, id));

  return new NextResponse(null, { status: 204 });
}
