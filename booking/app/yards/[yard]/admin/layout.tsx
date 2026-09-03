import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import './admin.css';

type Props = { children: React.ReactNode; params: Promise<{ yard: string }> };

/**
 * The nav used to live here. It is in the shared header now, so every
 * yard screen has the same one and the admin pages are not a separate
 * place with their own way out.
 */
export default async function AdminLayout({ children, params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();

  await requireAdmin(yard, found.id);

  return <main className="admin-main">{children}</main>;
}
