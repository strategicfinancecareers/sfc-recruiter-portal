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

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('browse');
  const [scanIndex, setScanIndex] = useState<number>(0);
  // Bumping runId on a Pass/Replay forces the scanner useEffect to
  // re-run even when we're already in 'browse' (otherwise React would
  // skip the state update and the timers wouldn't reset).
  const [runId, setRunId] = useState<number>(0);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // ── Nav "Join the Network" dropdown ──────────────────────────────────────
  // Click to toggle, outside-click / Escape / item-select close it. Arrow
  // keys move focus between items; Enter activates. Works on touch (we
  // don't use :hover for the open state, just aria-expanded). Mobile-safe
  // because the trigger is a button — taps register as clicks.
  const [ddOpen, setDdOpen] = useState(false);
  const ddTriggerRef = useRef<HTMLButtonElement | null>(null);
  const ddPanelRef = useRef<HTMLDivElement | null>(null);
  const ddItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

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
    navigate(to);
  };

  // ── Detect prefers-reduced-motion on mount ──────────────────────────────
  // If set, jump straight to 'request' (intro visible, no scan, no auto-
  // advance). The user still has to click Accept to reach 'match'.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReduceMotion(true);
      setPhase('request');
      setScanIndex(PROTAG);
    }
  }, []);

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
  }, [phase, runId, reduceMotion]);

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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="sfc-home">
      {/* Noise overlay (was body::before in the source). Scoped to this
          route via the .sfc-home tree so it vanishes on navigation. */}
      <div className="sfc-home-noise" aria-hidden="true" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="bar">
        <div className="wrap bar-inner">
          <Link className="brand" to="/" data-route="home">
            <span className="mark">S</span>
            <span className="name">
              Strategic Finance
              <b>SFC&nbsp;Talent</b>
            </span>
          </Link>

          <div className="nav-mid">
            <a href="#flow">How It Works</a>
            <a href="#join">Talent</a>
            <a href="#join">Companies</a>
          </div>

          <div className="nav-right">
            {/* Recruiter login → /login (Login.tsx, hardcoded to the
                recruiter context). Professional login → /apply?mode=signin
                which opens the existing auth screen on the Sign-in tab
                via the URL-param hook in CandidateApply.tsx — works for
                returning users (whose only previous destination,
                /candidate-dashboard, dead-ended for anyone not already
                authenticated). */}
            <Link className="login" to="/login" data-route="recruiter-login">
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
      </header>

      {/* ── Flow section ─────────────────────────────────────────────────── */}
      <section className="flow-sec wrap rise d4" id="flow">
        <div className="flow-head">
          <span className="hr" />
          <span className="mono-label">How an introduction happens</span>
          <span className="hr" />
        </div>

        <div className="stage" id="stage" data-state={phase}>

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
              <div className="pool-more">+ 240 vetted professionals</div>
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

      {/* ── Band ─────────────────────────────────────────────────────────── */}
      <section className="band" id="join">
        <div className="band-grid">
          <div className="band-cell">
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
          <div className="band-cell">
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
            <Link to="/apply">For professionals</Link>
            <Link to="/signup">For recruiters</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
