import type { Metadata } from 'next';
import Wordmark from '@/components/Wordmark';
import ResetConfirm from '@/components/ResetConfirm';

export const metadata: Metadata = {
  title: 'New password · Facility Booking',
};

export default function ResetConfirmPage() {
  return (
    <main className="gate">
      <Wordmark tag="FACILITY BOOKING" />
      <ResetConfirm doneHref="/account" />
    </main>
  );
}
