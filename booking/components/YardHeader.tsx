'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from './SignOutButton';

export type Role = 'owner' | 'admin' | 'rider';

type Item = { href: string; label: string; note?: string };

/**
 * A menu that behaves like one.
 *
 * Not a <details>, which reads as a disclosure rather than navigation,
 * and not the native popover, which lands in the top layer where it
 * cannot be positioned against its own button without CSS anchoring.
 * So: a button that says whether it is open, a panel, and the three
 * things people expect of an open menu, which are Escape, a click
 * outside, and focus coming back afterwards.
 */
function Menu({
  name,
  label,
  items,
  footer,
  wide = false,
  burger = false,
  openMenu,
  setOpenMenu,
}: {
  /** Which menu this is, since the header only allows one open. */
  name: string;
  label: string;
  items: Item[];
  footer?: React.ReactNode;
  wide?: boolean;
  /** Draws three lines instead of the label, and keeps the label for
   *  anybody who cannot see them. */
  burger?: boolean;
  openMenu: string | null;
  setOpenMenu: (name: string | null) => void;
}) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const open = openMenu === name;

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenMenu(null);
      button.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpenMenu(null);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, setOpenMenu]);

  return (
    <div className="menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={burger ? 'menu-trigger is-burger' : 'menu-trigger'}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpenMenu(open ? null : name)}
      >
        {burger ? (
          <>
            <span className="sr">{label}</span>
            {/* Three strokes rather than an icon font, each sitting at
                its own slight angle so it belongs with a wordmark whose
                letters are drawn by hand. They fold into a cross when
                the panel is open. */}
            <span className="burger" aria-hidden="true">
              <span /><span /><span />
            </span>
          </>
        ) : (
          <>
            <span className="menu-label">{label}</span>
            <span className="menu-caret" aria-hidden="true" />
          </>
        )}
      </button>

      {/* Kept in the tree while closed so the panel's ids stay stable. */}
      <div className={`menu-panel${wide ? ' is-wide' : ''}`} id={id} hidden={!open}>
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="menu-item"
            aria-current={pathname === i.href ? 'page' : undefined}
            // Closes on the way out, including a tap on the page you are
            // already on, which would otherwise leave the panel hanging.
            onClick={() => setOpenMenu(null)}
          >
            <span className="menu-item-name">{i.label}</span>
            {i.note && <span className="menu-item-note">{i.note}</span>}
          </Link>
        ))}
        {footer}
      </div>
    </div>
  );
}

/**
 * The one header every yard screen uses. The yard name is a link to the
 * root, which works out where somebody belongs, so it does the right
 * thing for a rider and for whoever runs the place.
 *
 * The day to day sits in the bar. Everything you set up once and then
 * forget lives behind the Yard menu, which is why Facilities and Plan
 * are not competing with Diary for the same row.
 */
export default function YardHeader({
  yardName,
  personName,
  role,
}: {
  yardName: string;
  /** Their own name, or their email until they have set one. */
  personName: string;
  role: Role;
}) {
  const pathname = usePathname();
  const runsIt = role === 'owner' || role === 'admin';

  /**
   * One menu open at a time, held here rather than in each menu.
   *
   * Left to themselves they both stayed open: closing on an outside
   * mousedown never fires for a keyboard user, because Enter on a button
   * dispatches click and nothing else.
   *
   * The page it was opened on is stored alongside, so navigating closes
   * it. Adjusting state during render is React's own answer to resetting
   * when something outside changes, and unlike an effect it also covers
   * arriving here by back or forward with a panel still open.
   */
  const [menu, setMenu] = useState<{ open: string | null; at: string }>({
    open: null,
    at: pathname,
  });
  if (menu.at !== pathname) setMenu({ open: null, at: pathname });

  const openMenu = menu.at === pathname ? menu.open : null;
  const setOpenMenu = useCallback(
    (name: string | null) => setMenu({ open: name, at: pathname }),
    [pathname],
  );

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className="bar-link"
      aria-current={pathname === href ? 'page' : undefined}
    >
      {label}
    </Link>
  );

  return (
    <header className="bar">
      <Link href="/" className="bar-yard">
        <span className="bar-yard-name">{yardName}</span>
        <span className="bar-yard-tag">Arena booking</span>
      </Link>

      {/* Everything behind one button on a phone. The bar below wrapped
          onto a second row there and stood a third of the screen tall,
          above the grid people had come for. Both are always rendered
          and CSS picks: measuring the width would mean a first paint
          that disagrees with the second. */}
      <nav className="bar-menu" aria-label={yardName}>
        <Menu
          name="all"
          label="Menu"
          wide
          burger
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          items={[
            { href: '/book', label: 'Book' },
            ...(runsIt
              ? [
                  { href: '/admin/diary', label: 'Diary' },
                  { href: '/admin/riders', label: 'Riders' },
                  // Noted, which both explains them and sets the
                  // set-up-once group apart from the daily three
                  // without needing a rule between them.
                  { href: '/admin', label: 'Overview', note: 'How the yard is doing' },
                  { href: '/admin/facilities', label: 'Facilities', note: 'What can be booked' },
                  { href: '/admin/settings', label: 'Settings', note: 'Name, address, timezone' },
                  { href: '/admin/plan', label: 'Plan', note: 'Billing and allowances' },
                ]
              : []),
          ]}
          footer={
            <>
              <p className="menu-who">{personName}</p>
              <Link
                href="/me"
                className="menu-item"
                aria-current={pathname === '/me' ? 'page' : undefined}
                onClick={() => setOpenMenu(null)}
              >
                <span className="menu-item-name">Your details</span>
              </Link>
              <SignOutButton className="menu-item menu-out">
                <span className="menu-item-name">Sign out</span>
              </SignOutButton>
            </>
          }
        />
      </nav>

      <nav className="bar-nav" aria-label={yardName}>
        {link('/book', 'Book')}

        {runsIt && (
          <>
            {link('/admin/diary', 'Diary')}
            {link('/admin/riders', 'Riders')}
            <Menu
              name="yard"
              label="Yard"
              wide
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              items={[
                { href: '/admin', label: 'Overview', note: 'How the yard is doing' },
                { href: '/admin/facilities', label: 'Facilities', note: 'What can be booked' },
                { href: '/admin/settings', label: 'Settings', note: 'Name, address, timezone' },
                { href: '/admin/plan', label: 'Plan', note: 'Billing and allowances' },
              ]}
            />
          </>
        )}

        <Menu
          name="person"
          label={personName}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          items={[{ href: '/me', label: 'Your details' }]}
          footer={
            <SignOutButton className="menu-item menu-out">
              <span className="menu-item-name">Sign out</span>
            </SignOutButton>
          }
        />
      </nav>
    </header>
  );
}
