import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ClientDashboard } from './ClientDashboard';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">ArchiveForge</h1>
          <p className="text-gray-500 text-sm">
            Connecté : {session.user?.name ?? 'Admin'}
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Déconnexion
          </button>
        </form>
      </header>

      <ClientDashboard />
    </div>
  );
}
