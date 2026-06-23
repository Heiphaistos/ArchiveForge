import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ClientDashboard } from './ClientDashboard';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="page">
      <header className="header">
        <div className="header-brand">
          <div className="header-icon">⚓</div>
          <div>
            <div className="header-title">ArchiveForge</div>
            <div className="header-sub">Connecté : {session.user?.name ?? 'Admin'}</div>
          </div>
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button type="submit" className="btn-logout">Déconnexion</button>
        </form>
      </header>

      <ClientDashboard />
    </div>
  );
}
