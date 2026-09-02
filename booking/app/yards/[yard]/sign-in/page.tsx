import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getYard } from '@/lib/yard';
import SignIn from './SignIn';
import '../yard.css';

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

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{found.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>
      <Suspense>
        <SignIn yardName={found.name} />
      </Suspense>
    </main>
  );
}
