import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { importJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getImportQueue } from '@/lib/queue';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const job = await getImportQueue().getJob(id);
  if (job) {
    const state = await job.getState();
    if (state === 'active') {
      return NextResponse.json({ error: 'Import en cours — impossible de supprimer' }, { status: 409 });
    }
    await job.remove().catch(() => {});
  }

  await db.delete(importJobs).where(eq(importJobs.id, id));
  return new NextResponse(null, { status: 204 });
}
