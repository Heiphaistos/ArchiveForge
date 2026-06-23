import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { exportJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, id));

  if (!job || job.status !== 'completed' || !job.zipPath) {
    return NextResponse.json({ error: 'Export non disponible' }, { status: 404 });
  }

  if (!fs.existsSync(job.zipPath)) {
    return NextResponse.json({ error: 'Fichier ZIP introuvable sur le disque' }, { status: 404 });
  }

  const stat = fs.statSync(job.zipPath);
  const stream = fs.createReadStream(job.zipPath);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="archiveforge-${id}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
