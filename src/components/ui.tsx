import { useEffect, useRef, useState, type ReactNode } from "react";

/* =============== hooks =============== */

/** Cuenta animada hacia el valor objetivo (ease-out cúbico). */
export function useCountUp(target: number, duration = 850): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      setValue(v);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Revela su contenido al entrar al viewport (con retardo opcional). */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${on ? "on" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

/* =============== anillo de progreso =============== */

export function ProgressRing({
  pct,
  size = 150,
  stroke = 11,
  children,
}: {
  pct: number; // 0..1
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, pct)));
  const done = pct >= 0.999;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#143024" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "#6fddab" : "#f2c14e"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="ring-fg"
          style={{ filter: `drop-shadow(0 0 6px ${done ? "rgba(111,221,171,.45)" : "rgba(242,193,78,.4)"})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* =============== gráfica del saldo =============== */

export function Sparkline({
  saldos,
  pagadasSeguidas,
}: {
  /** saldo inicial + saldo después de cada cuota */
  saldos: number[];
  /** cuotas pagadas en orden, desde la primera */
  pagadasSeguidas: number;
}) {
  const W = 340;
  const H = 104;
  const PAD = 8;
  const max = saldos[0] || 1;
  const n = saldos.length - 1;
  const pts = saldos.map((v, i) => [
    PAD + (i * (W - PAD * 2)) / n,
    PAD + (1 - v / max) * (H - PAD * 2),
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n][0].toFixed(1)},${H - PAD} L${pts[0][0].toFixed(1)},${H - PAD} Z`;
  const clipX = pts[Math.min(pagadasSeguidas, n)][0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución del saldo de la deuda">
      <defs>
        <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2c14e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#f2c14e" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="areaMint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6fddab" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#6fddab" stopOpacity="0.03" />
        </linearGradient>
        <clipPath id="clipPagado">
          <rect x="0" y="0" width={clipX} height={H} style={{ transition: "width .8s cubic-bezier(.22,1,.36,1)" }} />
        </clipPath>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={PAD}
          x2={W - PAD}
          y1={PAD + f * (H - PAD * 2)}
          y2={PAD + f * (H - PAD * 2)}
          stroke="#1d4232"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
      ))}
      <path d={area} fill="url(#areaGold)" />
      <g clipPath="url(#clipPagado)">
        <path d={area} fill="url(#areaMint)" />
      </g>
      <path d={line} fill="none" stroke="#f2c14e" strokeWidth="2.2" strokeLinecap="round" className="spark-line" />
      <line
        x1={clipX}
        x2={clipX}
        y1={PAD - 2}
        y2={H - PAD}
        stroke="#6fddab"
        strokeWidth="1.4"
        strokeDasharray="4 4"
        opacity={pagadasSeguidas > 0 ? 0.9 : 0}
        style={{ transition: "x1 .8s cubic-bezier(.22,1,.36,1), x2 .8s cubic-bezier(.22,1,.36,1), opacity .4s" }}
      />
      {pts.map(([x, y], i) => {
        if (i === 0 || i % 3 !== 0) return null;
        const pagado = i <= pagadasSeguidas;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.6"
            fill={pagado ? "#6fddab" : "#0f241c"}
            stroke={pagado ? "#6fddab" : "#f2c14e"}
            strokeWidth="1.4"
          />
        );
      })}
      <circle cx={pts[n][0]} cy={pts[n][1]} r="3.4" fill="#071410" stroke="#6fddab" strokeWidth="1.8" />
    </svg>
  );
}

/* =============== iconos (SVG propios) =============== */

type IconProps = { className?: string };

export function IconSol({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.6 9.1c-.55-.85-1.5-1.35-2.6-1.35-1.6 0-2.85.85-2.85 2.15 0 2.9 5.7 1.5 5.7 4.45 0 1.35-1.2 2.2-2.9 2.2-1.3 0-2.35-.55-2.95-1.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M9.3 7.2 14.9 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="m4.5 12.8 4.6 4.7L19.5 6.9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevron({ dir, className = "w-4 h-4" }: IconProps & { dir: "l" | "r" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d={dir === "l" ? "m14.5 5.5-6.5 6.5 6.5 6.5" : "m9.5 5.5 6.5 6.5-6.5 6.5"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconReset({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.2 9.5A7.6 7.6 0 1 1 4.4 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 4.5v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendar({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.8h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function IconStack({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <ellipse cx="12" cy="6.6" rx="7.4" ry="3.1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.6 6.8v5c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4.6 11.9v5c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconFlag({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.5 21V3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5.5 4.5c3.2-1.9 6 1.7 9.3 0 1.1-.5 2.2-.6 3.7-.2v8.4c-1.5-.4-2.6-.3-3.7.2-3.3 1.7-6.1-1.9-9.3 0" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function IconWallet({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 7.2A2.7 2.7 0 0 1 6.7 4.5h11.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="4" y="7" width="16.5" height="12.5" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="13.2" r="1.5" fill="currentColor" />
    </svg>
  );
}
