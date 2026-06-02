import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.googleId = profile.sub;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as any).googleId = token.googleId;
      (session.user as any).id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: '/auth/sign-in',
  },
});
