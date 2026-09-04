import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import SignInForm from '@/components/SignInForm';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Sign in · ${found.name}` : 'Sign in' };
}

export default async function SignInPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();

  // Somebody already signed in has nothing to do here. Sending them to
  // the root puts them wherever they belong instead of showing a form
  // for an account they are already using.
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/');

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{found.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>
      <Suspense>
        {/* The yard's front door by default, which works out whether
            this is a rider or somebody who runs the place. Guessing here
            would mean two answers to the same question, drifting apart. */}
        <SignInForm heading={`Sign in to ${found.name}.`} fallback="/" />
      </Suspense>
    </main>
  );
}
