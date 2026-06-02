import { redirect } from 'next/navigation';

// Middleware in middleware.ts handles auth redirect:
// - logged in  → /dashboard
// - logged out → /auth/sign-in
export default function HomePage() {
  redirect('/auth/sign-in');
}
