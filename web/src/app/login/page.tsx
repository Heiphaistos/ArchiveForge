import { signIn } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  if (session) redirect('/dashboard');

  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#5865f2] rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            ⚓
          </div>
          <h1 className="text-2xl font-bold text-white">ArchiveForge</h1>
          <p className="text-gray-400 text-sm mt-1">Portail administrateur</p>
        </div>

        {error === 'AccessDenied' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-center">
            <p className="text-red-400 text-sm">Accès refusé — compte non autorisé</p>
          </div>
        )}

        <form
          action={async () => {
            'use server';
            await signIn('discord', { redirectTo: '/dashboard' });
          }}
        >
          <button
            type="submit"
            className="w-full bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.028.015.057.034.073a19.986 19.986 0 0 0 5.993 3.03.078.078 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.201 13.201 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Connexion via Discord
          </button>
        </form>

        <p className="text-center text-xs text-gray-600">Accès restreint à l&apos;administrateur</p>
      </div>
    </div>
  );
}
