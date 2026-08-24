import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Variable fonts via @fontsource-variable/* — loaded at module-import
// time so they're cached for repeat visits. CSS in Home.css references
// the family names ('Newsreader', 'Manrope', 'Geist Mono') with the
// 'Variable' suffix preferred, falling back to the non-variable family
// in case the variable file isn't picked up.
import '@fontsource-variable/newsreader';
import '@fontsource-variable/manrope';
import '@fontsource-variable/geist-mono';

import './Home.css';

// ─── Static content ──────────────────────────────────────────────────────────

interface Card {
  role: string;
  meta: string;
  code: string;
}

const CARDS: Card[] = [
  { role: 'Investment Banking Associate', meta: 'TMT · NYC · 2 yrs',           code: '#A-1392' },
  { role: 'Private Equity Associate',     meta: 'MM Buyout · NYC · 4 yrs',      code: '#A-2207' },
  { role: 'Management Consultant',        meta: 'Strategy · Chicago · 5 yrs',   code: '#A-1955' },
  { role: 'FP&A Manager',            meta: 'SaaS · Remote · 7 yrs',        code: '#A-1841' },
  { role: 'VP, Corporate Finance',        meta: 'Healthcare · Boston · 10 yrs', code: '#A-1107' },
];

const PROTAG = 1;                       // index of the candidate the flow settles on
const SCAN_INTERVAL_MS = 850;           // matches original JS
const REQUEST_DELAY_MS = 2900;          // browse → request hand-off

type Phase = 'browse' | 'request' | 'match';

// Value props — wording mirrors the live /apply page so the two front
// doors make the same promises in the same words.
const VALUES = [
  {
    key: 'anonymous',
    title: 'You stay anonymous',
    body: 'Your name, employer, résumé file, and contact details are never shown to a recruiter without your explicit consent.',
  },
  {
    key: 'curated',
    title: 'Curated, not broadcast',
    body: 'Every introduction is reviewed and selective. You are never mass-applied to roles, and never cold-called by recruiters.',
  },
  {
    key: 'control',
    title: 'You control every intro',
    body: 'Accept or decline any introduction request within 48 hours. No pressure, no obligation, no awkward calls.',
  },
] as const;

// Objection handling. Every answer here is a description of what the
// product actually does — the review workflow, the 48-hour window, and
// the recruiter pricing in PricingModal.tsx. Keep them in sync.
const FAQS = [
  {
    q: 'Will my current employer find out?',
    a: 'No. Your profile is anonymous by default. Recruiters browsing the network see your role, years of experience, areas of expertise, and a written summary — never your name, your employer, your résumé file, or any way to contact you. Those are released at the moment you accept an introduction, and not before.',
  },
  {
    q: 'How are professionals vetted?',
    a: 'Every application is reviewed by the SFC team before it goes live. We parse your résumé, confirm your experience and areas of expertise, and write a short profile summary that recruiters see in place of your identity. Profiles that do not meet the bar are not published.',
  },
  {
    q: 'What does it cost?',
    a: 'Free for professionals — the application takes about five minutes. Recruiters join by application at $500 per month, or $300 per month billed annually.',
  },
  {
    q: 'How long does an introduction take?',
    a: 'A recruiter requests an introduction as soon as they see a fit. You have 48 hours to accept or decline. Contact details are exchanged the moment you accept — there is no scheduling round-trip in between.',
  },
  {
    q: 'What if I am not actively looking?',
    a: 'That is who the network is built for. Staying in it costs nothing and keeps you invisible until something genuinely worth your time appears. Most people here are employed and exploring quietly.',
  },
] as const;

// ─── Reusable inline SVGs (kept inline to match the source HTML fidelity) ────

const RecruiterIcon = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 9h18M8 6V4h8v2" />
  </svg>
);
const ProfessionalIcon = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const PersonAva = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12l5 5L20 6" />
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const ArrowRight = () => (
  <svg className="arr" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const FunnelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const ApproveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const ShieldLockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const VALUE_ICONS: Record<string, () => JSX.Element> = {
  anonymous: ShieldLockIcon,
  curated: FunnelIcon,
  control: ApproveIcon,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Read the motion preference synchronously so the very first paint is
// already correct — doing this in an effect caused a frame of animation
// to play before we could cancel it.
const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();

  const [reduceMotion] = useState(prefersReducedMotion);
  // With reduced motion we skip the scan entirely and open on the
  // 'request' phase — the intro is visible, nothing moves, and the user
  // still has to click Accept to reach 'match'.
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'request' : 'browse'));
  const [scanIndex, setScanIndex] = useState<number>(() => (prefersReducedMotion() ? PROTAG : 0));
  // Bumping runId on a Pass/Replay forces the scanner useEffect to
  // re-run even when we're already in 'browse' (otherwise React would
  // skip the state update and the timers wouldn't reset).
  const [runId, setRunId] = useState<number>(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // The demo used to start its 2.9s run on mount, so on any viewport
  // where the stage sits below the fold it had already played itself out
  // before the visitor scrolled down to it. Gate the state machine on
  // the stage actually being on screen.
  const [stageSeen, setStageSeen] = useState(false);

  // ── Nav "Join the Network" dropdown ──────────────────────────────────────
  // Click to toggle, outside-click / Escape / item-select close it. Arrow
  // keys move focus between items; Enter activates. Works on touch (we
  // don't use :hover for the open state, just aria-expanded). Mobile-safe
  // because the trigger is a button — taps register as clicks.
  const [ddOpen, setDdOpen] = useState(false);
  const ddTriggerRef = useRef<HTMLButtonElement | null>(null);
  const ddPanelRef = useRef<HTMLDivElement | null>(null);
  const ddItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  // ── Mobile menu ──────────────────────────────────────────────────────────
  // Under 860px the mid-nav links and the login labels used to simply
  // disappear with nothing replacing them, so How It Works / Talent /
  // Companies and both logins were unreachable on a phone. This panel is
  // the small-screen home for all of it.
  const [navOpen, setNavOpen] = useState(false);
  const navToggleRef = useRef<HTMLButtonElement | null>(null);

  const closeDd = useCallback(() => setDdOpen(false), []);

  useEffect(() => {
    if (!ddOpen) return;
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        ddPanelRef.current && !ddPanelRef.current.contains(target) &&
        ddTriggerRef.current && !ddTriggerRef.current.contains(target)
      ) closeDd();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDd();
        // Return focus to trigger for keyboard users
        ddTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('touchstart', onDocPointer);
    document.addEventListener('keydown', onKey);
    // Move focus to the first menu item on open for keyboard users.
    // Defer one tick so the panel is mounted before we try to focus.
    const t = window.setTimeout(() => ddItemRefs.current[0]?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('touchstart', onDocPointer);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [ddOpen, closeDd]);

  // Escape closes the mobile menu and hands focus back to the toggle.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false);
        navToggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  // Close the mobile menu if the viewport grows past the breakpoint while
  // it's open — otherwise the panel lingers over the restored desktop nav.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setNavOpen(false);
    };
    onChange(mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Arrow-key navigation within the panel.
  const handleDdItemKey = (e: React.KeyboardEvent<HTMLAnchorElement>, i: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (i + 1) % ddItemRefs.current.length;
      ddItemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (i - 1 + ddItemRefs.current.length) % ddItemRefs.current.length;
      ddItemRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      ddItemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      ddItemRefs.current[ddItemRefs.current.length - 1]?.focus();
    }
  };

  const goAndClose = (to: string) => {
    closeDd();
    setNavOpen(false);
    navigate(to);
  };

  // ── Scroll reveal ───────────────────────────────────────────────────────
  // One observer for every [data-reveal] in the tree. Elements start
  // translated + transparent in CSS and get .is-revealed on first entry;
  // we unobserve immediately so nothing re-animates on scroll-back.
  // Under reduced motion (or without IntersectionObserver) everything is
  // marked revealed up front and the CSS transition is a no-op.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      els.forEach(el => el.classList.add('is-revealed'));
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [reduceMotion]);

  // ── Start the demo when the stage scrolls into view ─────────────────────
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      setStageSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setStageSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  // ── State-machine effect ────────────────────────────────────────────────
  // Mirrors the original browse() → request() flow:
  //   browse  — scanIndex cycles every 850ms; after 2900ms total → request
  //   request — scanIndex locked to PROTAG; intro slid in via CSS; waits
  //   match   — nothing to do here; CSS handles the layout shift
  //
  // Cleanup tears down both the interval and the hand-off timeout so
  // unmount can't leak timers.
  useEffect(() => {
    if (reduceMotion) return;            // skip auto-motion entirely
    if (!stageSeen) return;              // hold at the first frame until visible
    if (phase !== 'browse') {
      if (phase === 'request') setScanIndex(PROTAG);
      return;
    }
    let i = 0;
    setScanIndex(0);
    const interval = window.setInterval(() => {
      i = (i + 1) % CARDS.length;
      setScanIndex(i);
    }, SCAN_INTERVAL_MS);
    const handoff = window.setTimeout(() => setPhase('request'), REQUEST_DELAY_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(handoff);
    };
  }, [phase, runId, reduceMotion, stageSeen]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleAccept = useCallback(() => {
    // Per source: only the Accept button advances browse → match. If
    // somehow clicked outside the request phase, no-op.
    if (phase === 'request') setPhase('match');
  }, [phase]);

  const handleRestart = useCallback(() => {
    // Pass and Replay both go back to the browse phase. runId bump
    // guarantees the scanner restarts even if we were already there.
    setPhase('browse');
    setScanIndex(0);
    setRunId(n => n + 1);
  }, []);

  const closeNav = useCallback(() => setNavOpen(false), []);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="sfc-home" ref={rootRef}>
      {/* Noise overlay (was body::before in the source). Scoped to this
          route via the .sfc-home tree so it vanishes on navigation. */}
      <div className="sfc-home-noise" aria-hidden="true" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="bar" data-open={navOpen ? 'true' : 'false'}>
        <div className="wrap bar-inner">
          <Link className="brand" to="/" data-route="home" aria-label="SFC Talent — home">
            <img className="mark" src="/brand/sfc-mark.png" alt="" width={29} height={29} />
            <span className="name">
              Strategic Finance
              <b>SFC&nbsp;Talent</b>
            </span>
          </Link>

          <div className="nav-mid">
            <a href="#flow">How it works</a>
            <a href="#why">Why SFC</a>
            <a href="#faq">Questions</a>
          </div>

          <div className="nav-right">
            {/* Recruiter login → /signup?mode=signin (the recruiter
                signup page now hosts both Create Account + Sign In via
                a tab toggle; /signup is the single recruiter front
                door). Professional login → /apply?mode=signin which
                opens that page's auth screen on the Sign-in tab via
                the URL-param hook in CandidateApply.tsx. */}
            <Link className="login" to="/signup?mode=signin" data-route="recruiter-login">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 9h18M8 6V4h8v2" />
              </svg>
              <span>Recruiter login</span>
            </Link>
            <Link className="login" to="/apply?mode=signin" data-route="professional-login">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              <span>Professional login</span>
            </Link>
            {/* Nav CTA dropdown — Click toggles. Two routes:
                  I'm a professional → /apply
                  I'm a recruiter    → /signup
                Closes on outside-click, Escape, or selecting an item.
                Keyboard: Tab to focus, Enter/Space to open, Arrow keys
                between items, Escape to close. Touch-safe (no hover gate). */}
            <div className="join-dd">
              <button
                ref={ddTriggerRef}
                type="button"
                className="btn forest join-dd-trigger"
                aria-haspopup="menu"
                aria-expanded={ddOpen}
                aria-controls="sfcHome-joinMenu"
                onClick={() => setDdOpen(o => !o)}
              >
                Join the Network
                <svg
                  className="caret"
                  width="12" height="12"
                  viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {ddOpen && (
                <div
                  ref={ddPanelRef}
                  id="sfcHome-joinMenu"
                  role="menu"
                  aria-label="Join the Network"
                  className="join-dd-panel"
                >
                  <a
                    ref={el => { ddItemRefs.current[0] = el; }}
                    href="/apply"
                    role="menuitem"
                    className="join-dd-item"
                    onClick={(e) => { e.preventDefault(); goAndClose('/apply'); }}
                    onKeyDown={(e) => handleDdItemKey(e, 0)}
                  >
                    <span className="lbl">For professionals</span>
                    <span className="txt-row">
                      <span className="txt">I&rsquo;m a professional</span>
                      <ArrowRight />
                    </span>
                  </a>
                  <a
                    ref={el => { ddItemRefs.current[1] = el; }}
                    href="/signup"
                    role="menuitem"
                    className="join-dd-item"
                    onClick={(e) => { e.preventDefault(); goAndClose('/signup'); }}
                    onKeyDown={(e) => handleDdItemKey(e, 1)}
                  >
                    <span className="lbl">For recruiters</span>
                    <span className="txt-row">
                      <span className="txt">I&rsquo;m a recruiter</span>
                      <ArrowRight />
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Hamburger — only rendered as visible under the 860px
              breakpoint (see Home.css). Toggles the panel below. */}
          <button
            ref={navToggleRef}
            type="button"
            className="nav-toggle"
            aria-expanded={navOpen}
            aria-controls="sfcHome-mobileNav"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setNavOpen(o => !o)}
          >
            <span className="bars" aria-hidden="true">
              <i /><i /><i />
            </span>
          </button>
        </div>

        {/* ── Mobile menu panel ──────────────────────────────────────────── */}
        <div className="mobile-nav" id="sfcHome-mobileNav" hidden={!navOpen}>
          <div className="wrap mobile-nav-inner">
            <a className="mn-link" href="#flow" onClick={closeNav}>How it works</a>
            <a className="mn-link" href="#why" onClick={closeNav}>Why SFC</a>
            <a className="mn-link" href="#faq" onClick={closeNav}>Questions</a>

            <div className="mn-sep" />

            <Link className="mn-cta forest" to="/apply" onClick={closeNav}>
              Join the Talent Network
              <ArrowRight />
            </Link>
            <Link className="mn-cta ghost" to="/signup" onClick={closeNav}>
              Hire Strategic Finance Talent
              <ArrowRight />
            </Link>

            <div className="mn-sep" />

            <div className="mn-logins">
              <Link className="mn-login" to="/apply?mode=signin" onClick={closeNav}>
                Professional login
              </Link>
              <Link className="mn-login" to="/signup?mode=signin" onClick={closeNav}>
                Recruiter login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="hero wrap">
        <div className="eyebrow rise d1">
          <span className="dot" />
          <span className="mono-label">The modern way to hire finance talent</span>
        </div>
        <h1 className="hero-title rise d2">
          Where elite finance talent and top firms meet <em>quietly</em>.
        </h1>
        <p className="hero-sub rise d3">
          Professional profiles remain anonymous until an introduction is made.
        </p>
        <div className="hero-cta rise d4">
          <Link className="btn forest" to="/apply">
            Join the Talent Network
            <ArrowRight />
          </Link>
          <Link className="btn ghost" to="/signup">
            Hire finance talent
            <ArrowRight />
          </Link>
        </div>
        <p className="hero-note rise d4">
          Free for professionals · 5-minute application · Recruiter membership by application
        </p>
      </header>

      {/* ── Flow section ─────────────────────────────────────────────────── */}
      <section className="flow-sec wrap rise d4" id="flow">
        <div className="flow-head">
          <span className="hr" />
          <span className="mono-label">How an introduction happens</span>
          <span className="hr" />
        </div>

        <div className="stage" id="stage" data-state={phase} ref={stageRef}>

          {/* RECRUITER */}
          <div className="rcol">
            <div className="lane-head">
              <RecruiterIcon />
              <span className="mono-label">Recruiter — search vetted talent</span>
            </div>

            <div className="pool" id="pool">
              {CARDS.map((card, i) => {
                const isScanned = phase === 'browse' && scanIndex === i;
                const isDimmed = phase === 'browse' && scanIndex >= 0 && scanIndex !== i;
                const isProtag = i === PROTAG;
                const cls = [
                  'tcard',
                  isProtag ? 'protag' : '',
                  isScanned ? 'scan' : '',
                  isDimmed ? 'dimmed' : '',
                ].filter(Boolean).join(' ');
                return (
                  <div key={card.code} className={cls}>
                    <span className="ava"><PersonAva /></span>
                    <div className="info">
                      <div className="role">{card.role}</div>
                      <div className="meta">{card.meta}</div>
                    </div>
                    <span className="code">{card.code}</span>
                    {isProtag && <span className="req-tag">Intro requested</span>}
                  </div>
                );
              })}
            </div>

            <div className="r-reveal">
              <div className="got"><CheckIcon />Introduction accepted — you can now see</div>
              <div className="reveal-name">Marcus Reyes</div>
              <div className="reveal-tagline">Private Equity Associate · MM Buyout · 4 yrs</div>
              <ul className="reveal-list">
                <li><CheckIcon /><span>Full name &amp; <b>resume</b></span></li>
                <li><CheckIcon /><span>marcus.reyes@gmail.com</span></li>
                <li><CheckIcon /><span>+1 (415) 555-0182</span></li>
                <li><CheckIcon /><span>linkedin.com/in/marcusreyes</span></li>
              </ul>
            </div>
          </div>

          {/* CENTER SPINE */}
          <div className="spine">
            <div className="track" />
            <svg className="link-svg" viewBox="0 0 100 2" preserveAspectRatio="none">
              <line className="ln" x1="0" y1="1" x2="100" y2="1" />
            </svg>
            <div className="node">
              <span className="lock"><LockIcon /></span>
              <span className="check"><CheckIcon /></span>
            </div>
            <div className="node-cap">
              <span className="a">Hidden until<br />you approve</span>
              <span className="b">You approved —<br />introduction made</span>
            </div>
          </div>

          {/* PROFESSIONAL */}
          <div className="pcol">
            <div className="lane-head">
              <ProfessionalIcon />
              <span className="mono-label">Professional — open, anonymously</span>
            </div>

            <div className="panel">
              <div className="p-current">
                <span className="ava">MR</span>
                <div className="p-id">
                  <div className="p-name">Marcus Reyes</div>
                  <div className="meta">Private Equity Associate · MM Buyout · NYC · 4 yrs</div>
                  <div className="hidden-pill">
                    <LockIcon />
                    Hidden from recruiters until matched
                  </div>
                </div>
              </div>
              <div className="p-blurb">
                Four years in middle-market private equity — diligence, operating models, and board-level work.
                Thinks like an operator, not just an investor: built to run strategic finance at a high-growth company.
              </div>
              <div className="p-status">
                <span className="pdot" />
                Open to opportunities · invisible to your employer &amp; network
              </div>

              <div className="intro">
                <div className="ihead">
                  <span className="logo">A</span>
                  <div className="co">
                    <b>Affirm</b>
                    <span>Hiring · MD, Talent</span>
                  </div>
                  <span className="tag">just now</span>
                </div>
                <div className="irole">Strategic Finance Manager</div>
                <div className="iterms">$170k · Remote</div>
                <div className="iact">
                  <button className="mini go" id="sfcHome-acceptBtn" onClick={handleAccept} type="button">
                    <CheckIcon />Accept introduction
                  </button>
                  <button className="mini alt" id="sfcHome-passBtn" onClick={handleRestart} type="button">
                    Pass
                  </button>
                </div>
              </div>

              <div className="p-reveal">
                <div className="got"><CheckIcon />You&rsquo;re connected — you can now see</div>
                <div className="reveal-name">Affirm — Strategic Finance Manager</div>
                <div className="reveal-tagline">$170k · Remote</div>
                <ul className="reveal-list">
                  <li><CheckIcon /><span>Company &amp; <b>full role detail</b></span></li>
                  <li><CheckIcon /><span>Dana Okafor · MD, Talent</span></li>
                  <li><CheckIcon /><span>Comp &amp; scope detail</span></li>
                  <li><CheckIcon /><span>Next steps to connect</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="controls">
          <button className="replay" id="sfcHome-replayBtn" onClick={handleRestart} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 1 3 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Replay
          </button>
        </div>
      </section>

      {/* ── Value props ──────────────────────────────────────────────────── */}
      <section className="value-sec" id="why">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="mono-label">Why SFC Talent</span>
            <h2>
              Not a job board. Not a recruiter.<br />
              <em>A private introduction network.</em>
            </h2>
          </div>

          <div className="value-grid">
            {VALUES.map((v, i) => {
              const Icon = VALUE_ICONS[v.key];
              return (
                <article
                  className="value-card"
                  key={v.key}
                  data-reveal
                  style={{ '--r': i } as React.CSSProperties}
                >
                  <span className="v-ic" aria-hidden="true"><Icon /></span>
                  <h3>{v.title}</h3>
                  <p>{v.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="faq-sec" id="faq">
        <div className="wrap faq-inner">
          <div className="faq-aside" data-reveal>
            <span className="mono-label">Common questions</span>
            <h2>Your privacy is <em>the product</em>.</h2>
            <p>
              Most people in this network are employed and exploring discreetly.
              Everything below follows from that one constraint.
            </p>
          </div>

          <div className="faq-list">
            {FAQS.map((item, i) => (
              <details
                className="faq-item"
                key={item.q}
                data-reveal
                style={{ '--r': i } as React.CSSProperties}
              >
                <summary>
                  <span className="q">{item.q}</span>
                  <span className="sign" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <div className="faq-a"><p>{item.a}</p></div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Band ─────────────────────────────────────────────────────────── */}
      <section className="band" id="join">
        <div className="band-grid">
          <div className="band-cell" data-reveal>
            <span className="mono-label">For recruiters</span>
            <h3>Hire vetted finance talent.</h3>
            <p>Request warm introductions to pre-screened, passive operators — surfaced only when there&rsquo;s mutual interest.</p>
            <div className="row">
              <Link className="btn ghost" to="/signup">
                Hire Strategic Finance Talent
                <ArrowRight />
              </Link>
              <span className="note">Membership · by application</span>
            </div>
          </div>
          <div className="band-cell" data-reveal style={{ '--r': 1 } as React.CSSProperties}>
            <span className="mono-label">For professionals</span>
            <h3>Start being approached — privately.</h3>
            <p>Be open to opportunities without your employer or network ever knowing. You stay anonymous until you choose to say yes.</p>
            <div className="row">
              <Link className="btn forest" to="/apply">
                Join the Talent Network
                <ArrowRight />
              </Link>
              <span className="note">5-minute form · free</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="wrap">
        <div className="foot-inner">
          <span className="fbrand">SFC Talent — Strategic Finance Careers</span>
          <div className="foot-links">
            {/* Footer Log-in link intentionally removed — the two top-right
                nav logins remain the only login affordance on the page. */}
            <a href="#flow">How it works</a>
            <a href="#faq">Questions</a>
            <Link to="/apply">For professionals</Link>
            <Link to="/signup">For recruiters</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
