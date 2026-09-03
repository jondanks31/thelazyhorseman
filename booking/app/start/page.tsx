import type { Metadata } from 'next';
import Link from 'next/link';
import Wizard from './Wizard';
import './start.css';

export const metadata: Metadata = {
  title: 'Set up your yard · Facility Booking',
  description: 'Get your yard taking arena bookings. Four questions, and free for one facility.',
};

export default function StartPage() {
  return (
    <main className="start">
      <header className="start-head">
        <a className="logo" href="https://www.thelazyhorseman.com/">
          The<svg className="mark" aria-hidden="true" focusable="false" viewBox="20 18 262 145">
            <g fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
              <g transform="rotate(-2 52 68)"><path d="M 40,28 C 48,24 52,30 52,44 L 52,92 C 52,106 60,112 70,108" /></g>
              <g transform="rotate(1.5 98 82)">
                <path d="M 118,62 C 104,52 80,56 74,76 C 68,96 84,110 102,104 C 114,100 121,86 118,70" />
                <path d="M 121,58 C 123,76 121,96 123,103 C 125,111 131,113 139,109" />
              </g>
              <g transform="rotate(-1.5 185 85)"><path d="M 155,70 C 170,60 190,60 204,64 C 208,65 208,69 204,73 L 165,102 C 162,105 164,108 169,107 C 184,104 200,102 214,106" /></g>
              <g transform="rotate(2 254 100)">
                <path d="M 234,66 C 234,82 238,98 248,104 C 256,108 264,102 268,90 C 271,80 273,70 273,64" />
                <path d="M 273,64 C 273,88 272,122 264,140 C 257,155 244,156 236,148" />
              </g>
            </g>
          </svg>Horseman.
        </a>
        <span className="start-tag">FACILITY BOOKING</span>
      </header>

      <Wizard />

      <p className="start-foot">
        Free for one facility. No card, and nothing to cancel.
        <br />
        Already on a yard? <Link href="/sign-in">Sign in</Link>.
      </p>
    </main>
  );
}
