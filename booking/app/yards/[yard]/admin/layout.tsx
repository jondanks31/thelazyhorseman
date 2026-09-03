import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import '../yard.css';
import './admin.css';

type Props = { children: React.ReactNode; params: Promise<{ yard: string }> };

export default async function AdminLayout({ children, params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();

  await requireAdmin(yard, found.id);

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-bar-inner">
          <div>
            <p className="admin-yard">{found.name}</p>
            <p className="admin-role">Yard controls</p>
          </div>
          <nav className="admin-nav" aria-label="Yard controls">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/diary">Diary</Link>
            <Link href="/admin/facilities">Facilities</Link>
            <Link href="/admin/riders">Riders</Link>
            <Link href="/admin/settings">Settings</Link>
            <Link href="/admin/plan">Plan</Link>
            <Link href="/book">Book a slot</Link>
          </nav>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
