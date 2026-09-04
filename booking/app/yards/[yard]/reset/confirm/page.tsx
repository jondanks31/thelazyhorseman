import { notFound } from 'next/navigation';
import { getYard } from '@/lib/yard';
import ResetConfirm from '@/components/ResetConfirm';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `New password · ${found.name}` : 'New password' };
}

export default async function YardResetConfirmPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{found.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>
      {/* The yard's front door, which works out whether they are a rider
          or run the place. Same reason sign in goes there. */}
      <ResetConfirm doneHref="/" />
    </main>
  );
}
