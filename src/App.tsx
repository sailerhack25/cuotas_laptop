import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  CUOTA_MENSUAL,
  DEUDA_INICIAL,
  buildSchedule,
  daysBetween,
  fmtFechaLarga,
  fmtMoney,
  primerVencimiento,
  startOfDay,
  type Cuota,
  type Estado,
} from "./lib/schedule";
import {
  IconCalendar,
  IconCheck,
  IconFlag,
  IconReset,
  IconSol,
  IconStack,
  IconWallet,
  ProgressRing,
  Reveal,
  Sparkline,
  useCountUp,
} from "./components/ui";

const LS_PAGADAS = "planpagos.pagadas.v1";

const ESTADO_META: Record<Estado, { label: string; badge: string; dot: string }> = {
  pagado: { label: "Pagada", badge: "border-mint/40 bg-mint/10 text-mint", dot: "bg-mint" },
  proximo: { label: "Próxima", badge: "border-gold/45 bg-gold/10 text-gold", dot: "bg-gold dot-pulse" },
  pendiente: { label: "Pendiente", badge: "border-pine-600/60 bg-pine-800/50 text-fog", dot: "bg-fog-dim" },
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function mesCorto(d: Date) {
  return d.toLocaleDateString("es-PE", { month: "short" }).replace(".", "").toUpperCase();
}
function diaSemana(d: Date) {
  return cap(d.toLocaleDateString("es-PE", { weekday: "long" }));
}
function mesLargo(d: Date) {
  return cap(d.toLocaleDateString("es-PE", { month: "long" }));
}

function loadPagadas(): number[] {
  try {
    const raw = localStorage.getItem(LS_PAGADAS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}


/* ---------- fila del cronograma ---------- */

function CuotaRow({
  cuota,
  estado,
  total,
  pagada,
  onToggle,
  delay,
}: {
  cuota: Cuota;
  estado: Estado;
  total: number;
  pagada: boolean;
  onToggle: (n: number) => void;
  delay: number;
}) {
  const meta = ESTADO_META[estado];
  return (
    <Reveal as="li" delay={delay}>
      <div
        className={`row-sheen group grid grid-cols-[2.4rem_1fr_auto] items-center gap-x-3 px-3 py-3.5 border-b border-dashed border-pine-700/70 transition-colors duration-300 hover:bg-pine-800/40 sm:px-5 md:grid-cols-[3rem_1.3fr_7.6rem_8.6rem_auto] md:gap-x-4 ${
          pagada ? "opacity-75 hover:opacity-100" : ""
        }`}
      >
        {/* N° */}
        <div className="num text-sm text-fog-dim transition-colors group-hover:text-fog md:justify-self-start">
          {pagada ? (
            <span key={`chk-${cuota.n}`} className="inline-flex text-mint animate-pop">
              <IconCheck className="w-4 h-4" />
            </span>
          ) : (
            String(cuota.n).padStart(2, "0")
          )}
        </div>

        {/* fecha */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border transition-colors duration-300 ${
              pagada ? "border-mint/40 bg-mint/5" : estado === "proximo" ? "border-gold/50 bg-gold/5" : "border-pine-600/70 bg-pine-800/40"
            }`}
          >
            <span className={`num text-base font-semibold leading-none ${pagada ? "text-mint" : "text-ink"}`}>16</span>
            <span className={`mt-0.5 text-[9px] font-semibold tracking-[0.14em] ${pagada ? "text-mint/80" : "text-fog"}`}>
              {mesCorto(cuota.fecha)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-ink">
              {diaSemana(cuota.fecha)}
              {cuota.esUltima && (
                <span className="rounded-sm border border-gold/40 bg-gold/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-gold">
                  ÚLTIMA · AJUSTADA
                </span>
              )}
            </p>
            <p className="truncate text-xs text-fog">
              Cuota {cuota.n} de {total} · {mesLargo(cuota.fecha)} {cuota.fecha.getFullYear()}
            </p>
          </div>
        </div>

        {/* cuota */}
        <div className="text-right md:pr-1">
          <p className={`num text-sm font-semibold sm:text-[15px] ${cuota.esUltima ? "text-gold" : pagada ? "text-mint" : "text-ink"}`}>
            {fmtMoney(cuota.pago)}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-fog-dim">cuota</p>
        </div>

        {/* saldo tras pagar */}
        <div className="hidden text-right md:block">
          <p className={`num text-sm ${pagada ? "text-mint/90" : "text-fog"}`}>{fmtMoney(cuota.saldo)}</p>
          <p className="text-[10px] uppercase tracking-wider text-fog-dim">saldo</p>
        </div>

        {/* estado + acción */}
        <div className="flex items-center justify-end gap-2 md:gap-2.5">
          <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide sm:inline-flex ${meta.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <button
            onClick={() => onToggle(cuota.n)}
            aria-pressed={pagada}
            title={pagada ? "Quitar marca de pagada" : "Marcar como pagada"}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 sm:px-3 ${
              pagada
                ? "border-mint/45 bg-mint/15 text-mint hover:bg-mint/25"
                : "border-gold/50 text-gold hover:bg-gold hover:text-pine-950 hover:shadow-[0_0_18px_rgba(242,193,78,0.35)]"
            }`}
          >
            {pagada && (
              <span key={`pop-${cuota.n}`} className="animate-pop inline-flex">
                <IconCheck className="w-3.5 h-3.5" />
              </span>
            )}
            <span className="hidden sm:inline">{pagada ? "Pagada" : "Marcar pagada"}</span>
            <span className="sm:hidden">{pagada ? "✓" : "Pagar"}</span>
          </button>
        </div>
      </div>
    </Reveal>
  );
}

/* ---------- separador de año ---------- */

function YearDivider({ year, count }: { year: number; count: number }) {
  return (
    <Reveal as="li">
      <div className="flex items-center gap-4 px-3 pb-1 pt-7 sm:px-5">
        <span className="font-display text-xl font-bold tracking-tight text-gold">{year}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-pine-600/70 to-transparent" />
        <span className="num text-[11px] text-fog-dim">
          {count} {count === 1 ? "cuota" : "cuotas"}
        </span>
      </div>
    </Reveal>
  );
}

/* ==================================================================== */

export default function App() {
  const [pagadas, setPagadas] = useState<number[]>(loadPagadas);
  const [showBar, setShowBar] = useState(false);
  const [armReset, setArmReset] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const inicio = useMemo(() => primerVencimiento(), []);
  const cuotas = useMemo(() => buildSchedule(inicio), [inicio]);

  const paidSet = useMemo(
    () => new Set(pagadas.filter((n) => n >= 1 && n <= cuotas.length)),
    [pagadas, cuotas.length]
  );

  useEffect(() => {
    try {
      localStorage.setItem(LS_PAGADAS, JSON.stringify([...paidSet]));
    } catch {
      /* sin almacenamiento */
    }
  }, [paidSet]);

  useEffect(() => {
    if (!armReset) return;
    const t = setTimeout(() => setArmReset(false), 3000);
    return () => clearTimeout(t);
  }, [armReset]);

  /* totales */
  const totalPagado = useMemo(
    () => cuotas.reduce((acc, c) => acc + (paidSet.has(c.n) ? c.pago : 0), 0),
    [cuotas, paidSet]
  );
  const saldoActual = DEUDA_INICIAL - totalPagado;
  const pct = totalPagado / DEUDA_INICIAL;
  const liquidado = saldoActual <= 0.001;
  const contiguas = useMemo(() => {
    let c = 0;
    while (paidSet.has(c + 1)) c++;
    return c;
  }, [paidSet]);

  const proxima = cuotas.find((c) => !paidSet.has(c.n));
  const diasPara = proxima ? daysBetween(today, proxima.fecha) : null;

  const estadoDe = (c: Cuota): Estado => {
    if (paidSet.has(c.n)) return "pagado";
    if (proxima && c.n === proxima.n) return "proximo";
    return "pendiente";
  };

  /* barra fija al pasar el resumen */
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* confeti al liquidar */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (liquidado) {
      const colors = ["#f2c14e", "#6fddab", "#eaf4ee", "#ffd97a"];
      confetti({ particleCount: 150, spread: 78, origin: { y: 0.32 }, colors });
      const t = setTimeout(() => confetti({ particleCount: 90, spread: 110, origin: { y: 0.45 }, colors }), 280);
      return () => clearTimeout(t);
    }
  }, [liquidado]);

  const saldoAnim = useCountUp(saldoActual);
  const pagadoAnim = useCountUp(totalPagado);

  const toggle = (n: number) =>
    setPagadas((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const reiniciar = () => {
    if (!armReset) {
      setArmReset(true);
      return;
    }
    setPagadas([]);
    setArmReset(false);
  };

  /* grupos por año */
  const grupos = useMemo(() => {
    const out: { year: number; items: { c: Cuota; estado: Estado; idx: number }[] }[] = [];
    cuotas.forEach((c, idx) => {
      const year = c.fecha.getFullYear();
      const last = out[out.length - 1];
      if (!last || last.year !== year) out.push({ year, items: [{ c, estado: estadoDe(c), idx }] });
      else last.items.push({ c, estado: estadoDe(c), idx });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuotas, paidSet, proxima, today]);

  const saldosGrafica = useMemo(() => [DEUDA_INICIAL, ...cuotas.map((c) => c.saldo)], [cuotas]);
  const ultima = cuotas[cuotas.length - 1];

  const tickerItems = [
    `DEUDA INICIAL ${fmtMoney(DEUDA_INICIAL)}`,
    `CUOTA MENSUAL ${fmtMoney(CUOTA_MENSUAL)}`,
    "PAGO: DÍA 16 DE CADA MES",
    `${cuotas.length} CUOTAS · LIQUIDACIÓN ${mesLargo(ultima.fecha).toUpperCase()} ${ultima.fecha.getFullYear()}`,
    `SALDO ACTUAL ${fmtMoney(saldoActual)}`,
  ];

  return (
    <div className="min-h-screen overflow-x-clip font-body text-ink">
      {/* fondo ambiental */}
      <div className="bg-stage" aria-hidden="true">
        <div className="orb right-[-140px] top-[-120px] h-[420px] w-[420px] bg-gold/10" />
        <div className="orb bottom-[-160px] left-[-140px] h-[460px] w-[460px] bg-mint/10" style={{ animationDelay: "-4s" }} />
        <div className="orb left-1/2 top-1/3 h-[260px] w-[260px] bg-pine-600/25" style={{ animationDelay: "-7s" }} />
      </div>
      <div className="bg-noise" aria-hidden="true" />

      {/* cinta superior */}
      <div className="overflow-hidden border-b border-pine-800 bg-pine-900/70 py-2">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <div key={k} aria-hidden={k === 1} className="flex shrink-0 items-center">
              {tickerItems.map((item, i) => (
                <span key={i} className="flex items-center">
                  <span className="num whitespace-nowrap px-5 text-[11px] font-medium tracking-[0.18em] text-fog">
                    {item}
                  </span>
                  <span className="text-gold/70">
                    <IconSol className="h-3 w-3" />
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* barra fija de saldo */}
      <div
        className={`fixed inset-x-0 top-0 z-30 border-b border-pine-700/70 bg-pine-950/92 backdrop-blur-md transition-all duration-500 ${
          showBar ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5 sm:px-6">
          <span className="text-gold">
            <IconSol className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-fog-dim">Saldo pendiente</p>
            <p className="num truncate text-sm font-bold text-gold">{fmtMoney(saldoActual)}</p>
          </div>
          <div className="ml-auto flex flex-1 items-center justify-end gap-4 sm:flex-none">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-pine-800 sm:w-40">
              <div
                className="bar-fill h-full rounded-full bg-gradient-to-r from-gold to-mint"
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
            <p className="num hidden text-xs text-fog sm:block">{Math.round(pct * 100)}%</p>
            {proxima && (
              <p className="num hidden text-xs text-fog md:block">
                próx. {proxima.fecha.getDate()}/{proxima.fecha.getMonth() + 1}/{proxima.fecha.getFullYear()}
              </p>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* cabecera */}
        <header className="animate-rise flex flex-wrap items-center justify-between gap-4 pb-8 pt-9">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/45 bg-gold/10 text-gold shadow-[0_0_24px_rgba(242,193,78,0.18)]">
              <IconSol className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">Plan de Pagos</h1>
              <p className="text-xs text-fog">Cronograma en soles · día 16 de cada mes</p>
            </div>
          </div>
          <button
            onClick={reiniciar}
            disabled={pagadas.length === 0 && !armReset}
            className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              armReset
                ? "border-coral/60 bg-coral/15 text-coral"
                : "border-pine-600 text-fog hover:border-fog/60 hover:text-ink"
            }`}
          >
            <IconReset className="h-3.5 w-3.5" />
            {armReset ? "¿Confirmar reinicio?" : "Reiniciar plan"}
          </button>
        </header>

        {/* estado de cuenta */}
        <section ref={heroRef} className="animate-rise grid gap-5 lg:grid-cols-[1.22fr_1fr]" style={{ animationDelay: "90ms" }}>
          {/* saldo principal */}
          <div className="relative overflow-hidden rounded-xl border border-pine-700/80 bg-pine-850/85 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] sm:p-8">
            {/* marcas de esquina */}
            {["left-3 top-3 border-l-2 border-t-2", "right-3 top-3 border-r-2 border-t-2", "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"].map(
              (pos) => (
                <span key={pos} className={`pointer-events-none absolute h-3.5 w-3.5 border-gold/45 ${pos}`} />
              )
            )}
            <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="num text-[11px] font-medium tracking-[0.24em] text-fog">SALDO PENDIENTE DE PAGO</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${
                      liquidado ? "border-mint/50 bg-mint/10 text-mint" : "border-gold/45 bg-gold/10 text-gold"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${liquidado ? "bg-mint" : "bg-gold dot-pulse"}`} />
                    {liquidado ? "DEUDA LIQUIDADA" : "EN CURSO"}
                  </span>
                </div>
                <p className="num mt-3 text-[clamp(2.6rem,6.5vw,4.3rem)] font-bold leading-none tracking-tight text-gold [text-shadow:0_0_40px_rgba(242,193,78,0.22)]">
                  {fmtMoney(saldoAnim)}
                </p>
                <p className="mt-3 text-sm text-fog">
                  de <span className="num font-semibold text-ink">{fmtMoney(DEUDA_INICIAL)}</span> iniciales ·{" "}
                  <span className="text-mint">
                    has pagado <span className="num font-semibold">{fmtMoney(pagadoAnim)}</span>
                  </span>
                </p>
                <div className="mt-5 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-pine-800">
                  <div
                    className="bar-fill h-full rounded-full bg-gradient-to-r from-gold via-gold-soft to-mint shadow-[0_0_14px_rgba(242,193,78,0.5)]"
                    style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct * 100)}%` }}
                  />
                </div>
                <p className="num mt-2 text-[11px] tracking-wide text-fog-dim">
                  {Math.round(pct * 100)}% de la deuda pagada · {paidSet.size} de {cuotas.length} cuotas
                </p>
              </div>

              <ProgressRing pct={pct} size={150} stroke={11}>
                <span className="num text-2xl font-bold text-ink">{Math.round(pct * 100)}%</span>
                <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-fog">pagado</span>
              </ProgressRing>
            </div>

            {/* chips de contexto */}
            <div className="mt-7 flex flex-wrap gap-2.5 border-t border-dashed border-pine-700 pt-5">
              {liquidado ? (
                <span className="inline-flex items-center gap-2 rounded-md border border-mint/45 bg-mint/10 px-3 py-2 text-xs font-semibold text-mint">
                  <IconFlag className="h-4 w-4" />
                  Liquidada el {fmtFechaLarga(ultima.fecha)} · saldo final {fmtMoney(0)}
                </span>
              ) : (
                proxima && (
                  <span className="inline-flex items-center gap-2 rounded-md border border-gold/45 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">
                    <IconCalendar className="h-4 w-4" />
                    Próximo pago: {fmtFechaLarga(proxima.fecha)} ·{" "}
                    <span className="num">
                      {diasPara === null
                        ? ""
                        : diasPara > 1
                          ? `en ${diasPara} días`
                          : diasPara === 1
                            ? "¡es mañana!"
                            : "¡a pagar!"}
                    </span>
                  </span>
                )
              )}
              {proxima && !liquidado && (
                <span className="inline-flex items-center gap-2 rounded-md border border-pine-600/70 bg-pine-800/50 px-3 py-2 text-xs text-fog">
                  <IconStack className="h-4 w-4" />
                  Quedan <span className="num font-semibold text-ink">{cuotas.length - paidSet.size}</span>{" "}
                  {cuotas.length - paidSet.size === 1 ? "cuota" : "cuotas"} por pagar
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-md border border-pine-600/70 bg-pine-800/50 px-3 py-2 text-xs text-fog">
                <IconWallet className="h-4 w-4" />
                Cuota mensual: <span className="num font-semibold text-ink">{fmtMoney(CUOTA_MENSUAL)}</span>
              </span>
            </div>
          </div>

          {/* resumen del plan + gráfica */}
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-pine-700/80 bg-pine-850/85 p-6">
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-fog">Resumen del plan</h2>
              <dl className="mt-3">
                {[
                  { icon: <IconStack className="h-4.5 w-4.5" />, k: "Deuda inicial", v: fmtMoney(DEUDA_INICIAL) },
                  {
                    icon: <IconWallet className="h-4.5 w-4.5" />,
                    k: "Cuota mensual",
                    v: fmtMoney(CUOTA_MENSUAL),
                  },
                  {
                    icon: <IconCalendar className="h-4.5 w-4.5" />,
                    k: "Total de cuotas",
                    v: `${cuotas.length} (17 + 1 final)`,
                  },
                  {
                    icon: <IconFlag className="h-4.5 w-4.5" />,
                    k: "Liquidación",
                    v: `16 ${mesCorto(ultima.fecha)} ${ultima.fecha.getFullYear()}`,
                  },
                ].map((row) => (
                  <div
                    key={row.k}
                    className="flex items-center justify-between gap-3 border-b border-dashed border-pine-700/70 py-2.5 last:border-0"
                  >
                    <dt className="flex items-center gap-2.5 text-sm text-fog">
                      <span className="text-gold/80">{row.icon}</span>
                      {row.k}
                    </dt>
                    <dd className="num text-sm font-semibold text-ink">{row.v}</dd>
                  </div>
                ))}
              </dl>
              {/* primer pago: fecha fija del plan */}
              <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-pine-600/60 bg-pine-900/60 px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs text-fog">
                  <IconCalendar className="h-4 w-4 text-gold/80" />
                  Primer pago
                </span>
                <span className="num text-sm font-semibold text-gold">
                  16 {mesCorto(inicio)} {inicio.getFullYear()}
                </span>
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-pine-700/80 bg-pine-850/85 p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-fog">Trayectoria del saldo</h2>
                <span className="num text-[10px] text-fog-dim">S/ 2,600 → S/ 0.00</span>
              </div>
              <div className="mt-3">
                <Sparkline saldos={saldosGrafica} pagadasSeguidas={contiguas} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-fog">
                El saldo baja <span className="num font-semibold text-ink">{fmtMoney(CUOTA_MENSUAL)}</span> cada día 16. La zona{" "}
                <span className="font-semibold text-mint">verde</span> es lo que ya pagaste.
              </p>
            </div>
          </div>
        </section>

        {/* cronograma */}
        <section className="mt-12">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="num text-[11px] tracking-[0.24em] text-gold">LIBRO DE CUOTAS</p>
                <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Pagos pendientes, mes a mes
                </h2>
                <p className="mt-2 max-w-xl text-sm text-fog">
                  {cuotas.length} vencimientos cada día 16 hasta llevar la deuda a{" "}
                  <span className="num font-semibold text-mint">{fmtMoney(0)}</span>. Marca cada cuota cuando la pagues — tu
                  avance queda guardado en este navegador.
                </p>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(Object.keys(ESTADO_META) as Estado[]).map((e) => (
                  <li key={e} className="flex items-center gap-1.5 text-xs text-fog">
                    <span className={`h-2 w-2 rounded-full ${ESTADO_META[e].dot}`} />
                    {ESTADO_META[e].label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-6 overflow-hidden rounded-xl border border-pine-700/80 bg-pine-850/70">
              {/* encabezado de columnas */}
              <div className="num hidden grid-cols-[3rem_1.3fr_7.6rem_8.6rem_auto] gap-x-4 border-b border-pine-700 bg-pine-900/70 px-5 py-3 text-[10px] font-semibold tracking-[0.2em] text-fog-dim md:grid">
                <span>N°</span>
                <span>FECHA DE PAGO</span>
                <span className="text-right">CUOTA</span>
                <span className="text-right">SALDO TRAS PAGAR</span>
                <span className="text-right">ESTADO</span>
              </div>

              <ol>
                {grupos.map((g) => (
                  <Fragment key={g.year}>
                    <YearDivider year={g.year} count={g.items.length} />
                    {g.items.map(({ c, estado, idx }) => (
                      <CuotaRow
                        key={c.n}
                        cuota={c}
                        estado={estado}
                        total={cuotas.length}
                        pagada={paidSet.has(c.n)}
                        onToggle={toggle}
                        delay={(idx % 9) * 45}
                      />
                    ))}
                  </Fragment>
                ))}
              </ol>

              {/* pie del libro */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pine-700 bg-pine-900/70 px-5 py-4">
                <p className="text-xs text-fog">
                  17 cuotas de <span className="num font-semibold text-ink">{fmtMoney(CUOTA_MENSUAL)}</span> + 1 cuota final de{" "}
                  <span className="num font-semibold text-gold">{fmtMoney(ultima.pago)}</span>
                </p>
                <p className="num text-xs font-semibold text-mint">
                  Σ TOTAL PAGADO = {fmtMoney(totalPagado)} / {fmtMoney(DEUDA_INICIAL)}
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-pine-800 pt-6 text-xs text-fog-dim">
          <p>
            Cronograma referencial · montos en soles peruanos (S/) · sin intereses · pagos los día{" "}
            <span className="num font-semibold text-fog">16</span>
          </p>
          <p className="flex items-center gap-1.5">
            Hecho con <span className="text-gold"><IconSol className="h-3.5 w-3.5" /></span> para salir de la deuda
          </p>
        </footer>
      </main>

      {/* aviso de liquidación */}
      {liquidado && (
        <div className="pointer-events-none fixed inset-x-0 bottom-7 z-50 flex justify-center px-4">
          <div className="animate-pop flex items-center gap-2.5 rounded-full bg-mint px-6 py-3 font-display text-sm font-extrabold tracking-wide text-pine-950 shadow-[0_16px_50px_-10px_rgba(111,221,171,0.55)]">
            <IconCheck className="h-4.5 w-4.5" />
            ¡DEUDA SALDADA! PAGASTE LAS {cuotas.length} CUOTAS
          </div>
        </div>
      )}
    </div>
  );
}
