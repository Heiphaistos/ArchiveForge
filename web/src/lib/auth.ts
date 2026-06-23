import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID;

if (!ADMIN_DISCORD_ID) {
  console.error('[auth] ADMIN_DISCORD_ID non défini — accès bloqué pour tous');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const id = (profile as { id?: string } | undefined)?.id;
      if (!id || id !== ADMIN_DISCORD_ID) {
        console.warn(`[auth] Accès refusé pour Discord ID: ${id ?? 'inconnu'}`);
        return false;
      }
      return true;
    },
    async session({ session, token }) {
      return { ...session, user: { ...session.user, discordId: token.sub } };
    },
    async jwt({ token, profile }) {
      if (profile) token.discordId = (profile as { id?: string }).id;
      return token;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
});
