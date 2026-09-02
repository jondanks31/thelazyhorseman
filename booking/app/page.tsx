import { redirect } from 'next/navigation';

// Nothing lives at the root yet. Yard signup is the only way in, so
// send people there rather than showing an empty page.
export default function Home() {
  redirect('/start');
}
