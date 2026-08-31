import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RESPONSE_WINDOW_LABEL,
  RESPONSE_WINDOW_MARKER,
  RESPONSE_WINDOW_FOOTNOTE,
} from '@/lib/responseWindow';
import './Home.css';

// ─── Static content ──────────────────────────────────────────────────────────

const CARDS = [
  { role: 'Investment Banking Associate', meta: 'TMT · NYC · 2 yrs',           code: '#A-1392' },
  { role: 'Private Equity Associate',     meta: 'MM Buyout · NYC · 4 yrs',      code: '#A-2207' },
  { role: 'Management Consultant',        meta: 'Strategy · Chicago · 5 yrs',   code: '#A-1955' },
  { role: 'FP&A Manager',            meta: 'SaaS · Remote · 7 yrs',        code: '#A-1841' },
  { role: 'VP, Corporate Finance',        meta: 'Healthcare · Boston · 10 yrs', code: '#A-1107' },
];
const PROTAG = 1;                 // the candidate the demo settles on
const SCAN_MS = 520;              // per-card scan dwell
const FIRE_MS = 4200;             // how long the matched state holds
const REST_MS = 1400;             // pause before the loop restarts

// Placement logos, original colors, from the alumni page. Heights are
// tuned per mark so the row reads optically level.
const LOGOS: Array<{ name: string; file: string; h: number }> = [
  { name: 'Uber',              file: 'uber.png',      h: 34 },
  { name: 'Amazon',            file: 'amazon.png',    h: 39 },
  { name: 'DoorDash',          file: 'doordash.png',  h: 34 },
  { name: 'Microsoft',         file: 'microsoft.png', h: 39 },
  { name: 'Pinterest',         file: 'pinterest.png', h: 44 },
  { name: 'Intuit',            file: 'intuit.png',    h: 34 },
  { name: 'J.P. Morgan Chase', file: 'jpmc.svg',      h: 36 },
  { name: 'Anduril',           file: 'anduril.png',   h: 31 },
  { name: 'Aurora',            file: 'aurora.png',    h: 34 },
  { name: 'DailyPay',          file: 'dailypay.png',  h: 39 },
  { name: 'Gem',               file: 'gem.png',       h: 39 },
  { name: 'Coast',             file: 'coast.svg',     h: 34 },
  { name: 'Neo',               file: 'neo.png',       h: 34 },
  { name: 'Venn',              file: 'venn.svg',      h: 34 },
  { name: 'Tala',              file: 'tala.png',      h: 42 },
  { name: 'Molg',              file: 'molg.png',      h: 34 },
  { name: 'PalmTree',          file: 'palmtree.jpg',  h: 57 },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'How are professionals vetted?',
    a: 'Every application is reviewed by the SFC team before it goes live. We know Strategic Finance talent better than anyone — SFC is a world-leading academy. We parse the resume, confirm experience and areas of expertise, and write the profile summary recruiters see. Profiles that do not meet the bar are not published.',
  },
  {
    q: 'How fast is an introduction?',
    a: 'You request an introduction the moment you see a fit. The professional has ' + RESPONSE_WINDOW_LABEL + RESPONSE_WINDOW_MARKER + ' to accept or decline, and contact details are exchanged immediately on acceptance — there is no scheduling round-trip in between.',
  },
  {
    q: 'What does it cost?',
    a: 'Free for professionals — the application takes about five minutes. Recruiters join by application from $100 per month (billed annually; $150 month-to-month) plus a flat placement fee — about 70% cheaper than a traditional recruiting firm.',
  },
  {
    q: 'Will a professional’s employer find out?',
    a: 'No. Profiles are anonymous by default — recruiters see role, experience, expertise, and a written summary, never a name, employer, resume file, or contact details. Those are released only when the professional accepts.',
  },
];

// ─── Inline SVG helpers ──────────────────────────────────────────────────────

const Arrow = () => (
  <svg className="arr" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Caret = () => (
  <svg className="cv" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const Check = ({ w = 2.4 }: { w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} aria-hidden="true">
    <path d="M5 12l5 5L20 6" />
  </svg>
);
const Lock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const Person = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const Briefcase = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 9h18M8 6V4h8v2" />
  </svg>
);
const Plus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Walking-figures hero scene ──────────────────────────────────────────────
// Two boiling-line sketch figures walk in from the edges, meet, and shake
// hands; a green pulse marks the introduction. Pure canvas, no deps.

function useMeetScene(
  wrapRef: React.RefObject<HTMLDivElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  chipRef: React.RefObject<HTMLSpanElement>,
  reduceMotion: boolean,
) {
  useEffect(() => {
    const wrap = wrapRef.current, cv = canvasRef.current, chip = chipRef.current;
    if (!wrap || !cv || !chip) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    const size = () => {
      const d = window.devicePixelRatio || 1;
      W = wrap.clientWidth; H = wrap.clientHeight;
      cv.width = W * d; cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      if (reduceMotion) drawStill();      // resizing clears the canvas
    };

    const INK = '#131313', GREEN = '#008037', DIV = '#e8e8e8';
    const Lt = 20, Ls = 18, TOR = 27, HR = 8.5, Ua = 15, Fa = 14;

    // boiling-line jitter, re-sampled ~9×/s for the hand-drawn feel
    let jit: number[] = [];
    const reroll = () => { jit = Array.from({ length: 64 }, () => (Math.random() - 0.5) * 2.4); };
    reroll();
    const jx = (i: number) => jit[(i * 2) % 64];
    const jy = (i: number) => jit[(i * 2 + 1) % 64];

    const seg = (ax: number, ay: number, bx: number, by: number) => {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    };
    const ease = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

    function walker(x: number, d: number, p: number, reach: number, tx: number, ty: number, jb: number) {
      const g = H - 14, bob = 1.6 * Math.sin(2 * p) * (1 - reach);
      const hipY = g - (Lt + Ls) + 4 + bob, hx = x;
      ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < 2; i++) {
        const ph = p + i * Math.PI;
        const a = d * 0.62 * Math.sin(ph) * (1 - reach * 0.85);
        const kb = 0.85 * Math.max(0, Math.sin(ph - 0.9)) * (1 - reach * 0.85);
        const b = a - d * kb;
        const kx = hx + Lt * Math.sin(a) + jx(jb + i), ky = hipY + Lt * Math.cos(a) + jy(jb + i);
        const fx = kx + Ls * Math.sin(b) + jx(jb + i + 2), fy = ky + Ls * Math.cos(b) + jy(jb + i + 2);
        seg(hx, hipY, kx, ky); seg(kx, ky, fx, Math.min(fy, g));
      }
      const shx = hx + jx(jb + 8), shy = hipY - TOR + jy(jb + 8);
      seg(hx, hipY, shx, shy);
      const hcx = shx + d * 1.5 + jx(jb + 9), hcy = shy - HR - 3.5 + jy(jb + 9);
      ctx.beginPath(); ctx.arc(hcx, hcy, HR, 0, 7); ctx.fillStyle = INK; ctx.fill();
      for (let i = 0; i < 2; i++) {
        const ph = p + i * Math.PI + Math.PI;
        const aa = d * 0.5 * Math.sin(ph) * (1 - (i === 0 ? reach : reach * 0.5));
        let ex = shx + Ua * Math.sin(aa), ey = shy + Ua * Math.cos(aa);
        let wx = ex + Fa * Math.sin(aa + d * 0.45), wy = ey + Fa * Math.cos(aa + d * 0.45);
        if (i === 0 && reach > 0) {
          const r2 = ease(reach);
          const tex = (shx + tx) / 2, tey = (shy + ty) / 2 + 6;
          ex += (tex - ex) * r2; ey += (tey - ey) * r2;
          wx += (tx - wx) * r2; wy += (ty - wy) * r2;
        }
        seg(shx, shy, ex + jx(jb + 12 + i), ey + jy(jb + 12 + i));
        seg(ex + jx(jb + 12 + i), ey + jy(jb + 12 + i), wx + jx(jb + 14 + i), wy + jy(jb + 14 + i));
      }
    }

    // one full cycle; returns true when the cycle is over
    function frame(t: number): boolean {
      ctx.clearRect(0, 0, W, H);
      const g = H - 14, cx = W / 2, v = 130, GAP = 27;
      const tArr = (cx - GAP + 34) / v;
      const xL = Math.min(-34 + v * t, cx - GAP), xR = Math.max(W + 34 - v * t, cx + GAP);
      const reach = ease((t - tArr) / 0.5);
      const hx = cx, hy = g - 40;
      const tEnd = tArr + 2.6, fade = 1 - ease((t - tEnd) / 0.6);
      ctx.globalAlpha = Math.max(0, fade);
      ctx.strokeStyle = DIV; ctx.lineWidth = 1; seg(0, g + 7, W, g + 7);
      if (reach > 0) {
        const gr = ctx.createRadialGradient(cx, g, 0, cx, g, 95);
        gr.addColorStop(0, 'rgba(0,128,55,' + 0.13 * reach + ')');
        gr.addColorStop(1, 'rgba(0,128,55,0)');
        ctx.fillStyle = gr; ctx.fillRect(cx - 100, g - 30, 200, 40);
      }
      walker(xL, 1, xL * 0.101, reach, hx - 2, hy, 0);
      walker(xR, -1, xR * 0.101, reach, hx + 2, hy, 20);
      for (let k = 0; k < 2; k++) {
        const r = (t - tArr - 0.15 - k * 0.5) * 95;
        if (r > 0 && r < 75) {
          ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7);
          ctx.strokeStyle = 'rgba(0,128,55,' + 0.55 * (1 - r / 75) + ')';
          ctx.lineWidth = 2; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      chip.classList.toggle('show', t > tArr + 0.35 && t < tEnd);
      return t > tEnd + 1.0;
    }

    function drawStill() {
      const cx = W / 2, v = 130, tA = (cx - 27 + 34) / v;
      frame(tA + 0.6);
      chip.classList.add('show');
    }

    size();
    window.addEventListener('resize', size);

    let raf = 0, t0: number | null = null, lastJ = 0, running = false;
    let io: IntersectionObserver | null = null;
    const loop = (ts: number) => {
      if (t0 === null) t0 = ts;
      if (ts - lastJ > 110) { reroll(); lastJ = ts; }
      if (frame((ts - t0) / 1000)) t0 = ts;
      raf = requestAnimationFrame(loop);
    };

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      drawStill();
    } else {
      io = new IntersectionObserver((es, o) => {
        if (es.some(e => e.isIntersecting) && !running) {
          running = true;
          raf = requestAnimationFrame(loop);
          o.disconnect();
        }
      }, { threshold: 0.25 });
      io.observe(wrap);
    }

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      window.removeEventListener('resize', size);
    };
  }, [wrapRef, canvasRef, chipRef, reduceMotion]);
}

// ─── Component ───────────────────────────────────────────────────────────────

type DemoPhase = 'wait' | 'scan' | 'fire' | 'rest';

export default function Home() {
  const navigate = useNavigate();
  const [reduceMotion] = useState(prefersReducedMotion);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const meetWrapRef = useRef<HTMLDivElement>(null);
  const meetCvRef = useRef<HTMLCanvasElement>(null);
  const meetChipRef = useRef<HTMLSpanElement>(null);

  useMeetScene(meetWrapRef, meetCvRef, meetChipRef, reduceMotion);

  // ── Login dropdown ──────────────────────────────────────────────────────
  const [loginOpen, setLoginOpen] = useState(false);
  const loginBtnRef = useRef<HTMLButtonElement>(null);
  const loginPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loginOpen) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!loginPanelRef.current?.contains(t) && !loginBtnRef.current?.contains(t)) setLoginOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLoginOpen(false); loginBtnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [loginOpen]);

  // ── Mobile nav ──────────────────────────────────────────────────────────
  const [navOpen, setNavOpen] = useState(false);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNavOpen(false); navToggleRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => { if (e.matches) setNavOpen(false); };
    onChange(mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const goAndClose = (to: string) => { setLoginOpen(false); setNavOpen(false); navigate(to); };

  // ── Scroll reveal ───────────────────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [reduceMotion]);

  // ── Demo loop ───────────────────────────────────────────────────────────
  // scan (cards highlight one by one) → fire (protagonist locked, beam pulse,
  // node flips to a check) → rest → scan again. Accept/Pass on the intro card
  // steer the same machine.
  const [phase, setPhase] = useState<DemoPhase>(() => (prefersReducedMotion() ? 'fire' : 'wait'));
  const [scanIdx, setScanIdx] = useState(-1);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {                       // start when the stage first scrolls into view
    if (reduceMotion || phase !== 'wait') return;
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setPhase('scan'); return; }
    const io = new IntersectionObserver((es, o) => {
      if (es.some(e => e.isIntersecting)) { setPhase('scan'); o.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    if (phase === 'scan') {
      let i = 0;
      setScanIdx(0);
      const iv = window.setInterval(() => {
        i += 1;
        if (i < CARDS.length) { setScanIdx(i); return; }
        window.clearInterval(iv);
        window.setTimeout(() => setPhase('fire'), 420);
      }, SCAN_MS);
      return () => window.clearInterval(iv);
    }
    if (phase === 'fire') {
      setScanIdx(-1);
      const t = window.setTimeout(() => setPhase('rest'), FIRE_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'rest') {
      const t = window.setTimeout(() => { setCycle(c => c + 1); setPhase('scan'); }, REST_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase, cycle, reduceMotion]);

  const handleAccept = useCallback(() => { if (phase !== 'fire') setPhase('fire'); }, [phase]);
  const handlePass = useCallback(() => { setCycle(c => c + 1); setPhase('scan'); }, []);

  const fired = phase === 'fire';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="sfc-home" ref={rootRef}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="wrap nav-in">
          <Link className="logo" to="/" aria-label="SFC Talent — home">
            <img src="/brand/sfc-wordmark.png" alt="strategic finance careers" height={26} />
          </Link>
          <span className="tagm">TALENT</span>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#why">Why SFC</a>
            <a href="#faq">Questions</a>
          </div>
          <div className="nav-log">
            <button
              ref={loginBtnRef}
              type="button"
              className="login-btn"
              aria-haspopup="menu"
              aria-expanded={loginOpen}
              aria-controls="sfcHome-loginMenu"
              onClick={() => setLoginOpen(o => !o)}
            >
              Log in <Caret />
            </button>
            {loginOpen && (
              <div ref={loginPanelRef} id="sfcHome-loginMenu" className="login-panel" role="menu" aria-label="Log in">
                <a
                  href="/signup?mode=signin"
                  role="menuitem"
                  onClick={e => { e.preventDefault(); goAndClose('/signup?mode=signin'); }}
                >
                  <b>Recruiter login</b>
                  <span>Search talent &amp; request intros</span>
                </a>
                <a
                  href="/apply?mode=signin"
                  role="menuitem"
                  onClick={e => { e.preventDefault(); goAndClose('/apply?mode=signin'); }}
                >
                  <b>Professional login</b>
                  <span>Manage your profile &amp; intros</span>
                </a>
              </div>
            )}
          </div>
          <Link className="btn btn-primary" to="/apply">Join the Network</Link>
          <button
            ref={navToggleRef}
            type="button"
            className="nav-toggle"
            aria-expanded={navOpen}
            aria-controls="sfcHome-mobileNav"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setNavOpen(o => !o)}
          >
            <span className="bars" aria-hidden="true"><i /><i /><i /></span>
          </button>
        </div>
        <div className="mobile-nav" id="sfcHome-mobileNav" hidden={!navOpen}>
          <div className="wrap mobile-nav-inner">
            <a className="mn-link" href="#how" onClick={closeNav}>How it works</a>
            <a className="mn-link" href="#why" onClick={closeNav}>Why SFC</a>
            <a className="mn-link" href="#faq" onClick={closeNav}>Questions</a>
            <div className="mn-sep" />
            <Link className="mn-cta forest" to="/signup" onClick={closeNav}>Hire finance talent <Arrow /></Link>
            <Link className="mn-cta ghost" to="/apply" onClick={closeNav}>Join the Talent Network <Arrow /></Link>
            <div className="mn-sep" />
            <div className="mn-logins">
              <Link className="mn-login" to="/signup?mode=signin" onClick={closeNav}>Recruiter login</Link>
              <Link className="mn-login" to="/apply?mode=signin" onClick={closeNav}>Professional login</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="hero">
        <h1 className="rise d1">
          The modern way to hire{' '}
          <span className="u">
            Strategic Finance talent
            <svg viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
              <path d="M5,11 C70,7.5 150,6 218,8.5 C252,9.8 280,10.5 295,9" />
            </svg>
          </span>.
        </h1>
        <div className="frac"><span>at a fraction of the cost of a traditional recruiting firm</span></div>
        <p className="hero-sub rise d2">
          Every professional here has <b>already been screened by SFC</b>. Search anonymous profiles,
          request an introduction, and connect in days — not months of sourcing.
        </p>
        <div className="hero-cta rise d3">
          <Link className="btn btn-primary" to="/signup">Hire finance talent <Arrow /></Link>
          <Link className="btn btn-outline" to="/apply">Join the Talent Network <Arrow /></Link>
        </div>
        <div className="trust rise d4">
          <span className="t-chip">Screened by SFC</span>
          <span className="t-chip">Intros in days</span>
          <span className="t-chip">Free for professionals</span>
        </div>
        <div className="meet rise d4" ref={meetWrapRef}>
          <canvas ref={meetCvRef} aria-hidden="true" />
          <span className="tagm meet-chip" ref={meetChipRef}>Introduction made</span>
        </div>
      </header>

      {/* ── Placements marquee ───────────────────────────────────────────── */}
      <section className="logos" data-reveal>
        <div className="wrap">
          <div className="ll">Placements at</div>
          <div className="marq">
            <div className="marq-track">
              {[0, 1].map(dup => (
                <div className="marq-set" key={dup} aria-hidden={dup === 1}>
                  {LOGOS.map(l => (
                    <img
                      key={l.name}
                      src={'/brand/placements/' + l.file}
                      alt={dup === 0 ? l.name : ''}
                      style={{ height: l.h }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works: demo ───────────────────────────────────────────── */}
      <section className="sec" id="how" style={{ paddingTop: 6 }}>
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <div className="kicker"><i />How it works<i /></div>
            <h2>Search. Request. Connect.</h2>
            <p>
              We&rsquo;re not just a fancy professional search tool. SFC is a world class academy, and we
              know what good Finance talent looks like. You will have access to professionals from our
              academy and outside of our academy.
            </p>
          </div>
          <div className="canvas" data-reveal style={{ ['--r' as string]: 1 } as React.CSSProperties}>
            <div className={'stage' + (fired ? ' fire' : '')} ref={stageRef}>
              <div>
                <div className="lane-head"><Briefcase /><span>Recruiter — search vetted talent</span></div>
                <div className="pool">
                  {CARDS.map((card, i) => {
                    const cls = ['tcard'];
                    if (phase === 'scan') cls.push(i === scanIdx ? 'scan' : 'dim');
                    if (fired) cls.push(i === PROTAG ? 'on' : 'dim');
                    return (
                      <div className={cls.join(' ')} key={card.code}>
                        <span className="ava"><Person /></span>
                        <div className="info">
                          <div className="role">{card.role}</div>
                          <div className="meta">{card.meta}</div>
                        </div>
                        <span className="code">{card.code}</span>
                        {i === PROTAG && <span className="req">Intro requested</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="spine">
                <div className="beam"><div className="pulse" /></div>
                <div className="node">
                  {fired ? <Check /> : <Lock />}
                </div>
                <div className="node-cap">
                  {fired ? <>Approved —<br />introduction made</> : <>Hidden until<br />they approve</>}
                </div>
              </div>
              <div>
                <div className="lane-head"><Person /><span>Professional — open, anonymously</span></div>
                <div className="panel">
                  <div className="p-top">
                    <span className="ava">MR</span>
                    <div>
                      <div className="p-name">Marcus Reyes</div>
                      <div className="p-meta">Private Equity Associate · MM Buyout · NYC · 4 yrs</div>
                      <span className="pill-hidden"><Lock />Hidden from recruiters until matched</span>
                    </div>
                  </div>
                  <div className="p-blurb">
                    Four years in middle-market private equity — diligence, operating models, and
                    board-level work. Thinks like an operator, not just an investor.
                  </div>
                  <div className="intro">
                    <div className="i-head">
                      <span className="i-logo">A</span>
                      <div className="i-co"><b>Affirm</b><span>Hiring · MD, Talent</span></div>
                      <span className="i-when">Just now</span>
                    </div>
                    <div className="i-role">Strategic Finance Manager</div>
                    <div className="i-terms">$170k · Remote</div>
                    <div className="i-act">
                      <button className="mini go" type="button" onClick={handleAccept}>
                        <span style={{ width: 14, height: 14, display: 'inline-flex' }}><Check /></span>
                        Accept introduction
                      </button>
                      <button className="mini alt" type="button" onClick={handlePass}>Pass</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why SFC Talent: bento ────────────────────────────────────────── */}
      <section className="sec" id="why">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <div className="kicker"><i />Why SFC Talent<i /></div>
            <h2>The screening is already done.</h2>
            <p>By the time a profile reaches you, SFC has parsed the resume, verified the experience, and written the summary.</p>
          </div>
          <div className="bento">
            <div className="bcell tall" data-reveal>
              <span className="b-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                </svg>
              </span>
              <h3>Vetted before you see them</h3>
              <p>Every application is reviewed by the SFC team before it goes live. If a profile does not meet the bar, it never reaches the network.</p>
              <div className="pipe in">
                {['Resume parsed', 'Experience verified', 'Profile approved & live'].map(step => (
                  <div className="pr" key={step}>
                    <span className="pk"><Check w={3} /></span>
                    <b>{step}</b>
                    <span>Done</span>
                  </div>
                ))}
              </div>
              <div className="pcap">The screen is finished before your search begins</div>
            </div>
            <div className="bcell" data-reveal style={{ ['--r' as string]: 1 } as React.CSSProperties}>
              <span className="b-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                </svg>
              </span>
              <h3>Days, not months</h3>
              <p>
                Professionals respond to every introduction within {RESPONSE_WINDOW_LABEL}
                {RESPONSE_WINDOW_MARKER}. Contact details are exchanged the moment they accept — no
                scheduling round-trips.
              </p>
              <p className="fn">{RESPONSE_WINDOW_FOOTNOTE}</p>
            </div>
            <div className="bcell" data-reveal style={{ ['--r' as string]: 2 } as React.CSSProperties}>
              <span className="b-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
                </svg>
              </span>
              <h3>Only mutual interest</h3>
              <p>An introduction happens only when the professional says yes. No ghosted outreach, no wasted first calls, no cold pipelines.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="sec" id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <div className="kicker"><i />Common questions<i /></div>
            <h2>Straight answers.</h2>
          </div>
          <div className="faq" data-reveal style={{ ['--r' as string]: 1 } as React.CSSProperties}>
            {FAQS.map((f, i) => (
              <details className="fi" key={f.q} open={i === 0}>
                <summary className="fq">
                  <span>{f.q}</span>
                  <span className="sign"><Plus /></span>
                </summary>
                <div className="fa">{f.a}</div>
              </details>
            ))}
            <p className="faq-fn">{RESPONSE_WINDOW_FOOTNOTE}</p>
          </div>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────────── */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="band">
            <div className="bc green" data-reveal>
              <div className="kicker"><i />For recruiters</div>
              <h3>Your next hire is already vetted.</h3>
              <p>Search pre-screened, passive finance operators and request warm introductions — surfaced only when there is mutual interest.</p>
              <div className="row">
                <Link className="btn btn-primary" to="/signup">Hire Strategic Finance Talent <Arrow /></Link>
                <span className="note">By application</span>
              </div>
            </div>
            <div className="bc" data-reveal style={{ ['--r' as string]: 1 } as React.CSSProperties}>
              <div className="kicker"><i />For professionals</div>
              <h3>Start being approached — privately.</h3>
              <p>Be open to opportunities without your employer or network ever knowing. You stay anonymous until you choose to say yes.</p>
              <div className="row">
                <Link className="btn btn-outline" to="/apply">Join the Talent Network <Arrow /></Link>
                <span className="note">5-min form · free</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer>
        <div className="wrap foot">
          <img src="/brand/sfc-wordmark.png" alt="strategic finance careers" height={24} />
          <div className="foot-links">
            <a href="#how">How it works</a>
            <a href="#faq">Questions</a>
            <Link to="/apply">For professionals</Link>
            <Link to="/signup">For recruiters</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
