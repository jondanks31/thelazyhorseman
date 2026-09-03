import { notFound } from 'next/navigation';
import { getYard } from '@/lib/yard';
import Join from './Join';
import '../../yard.css';

type Props = { params: Promise<{ yard: string; token: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Join ${found.name}` : 'Join' };
}

export default async function JoinPage({ params }: Props) {
  const { yard, token } = await params;
  const found = await getYard(yard);
  if (!found) notFound();

  // The token is not checked here on purpose. Telling an anonymous
  // visitor whether a code is real, before they have an account, is a
  // way to test codes. join_yard() is the check, once they are signed in.
  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{found.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>
      <Join yardName={found.name} token={token} />
    </main>
  );
}
