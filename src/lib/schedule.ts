export const DEUDA_INICIAL = 2600;
export const CUOTA_MENSUAL = 150;
export const DIA_DE_PAGO = 16;

export interface Cuota {
  /** número de cuota, desde 1 */
  n: number;
  /** fecha de vencimiento (día 16 del mes que corresponda) */
  fecha: Date;
  /** monto a pagar en esta cuota */
  pago: number;
  /** saldo restante luego de pagar esta cuota */
  saldo: number;
  /** true si es la cuota final ajustada */
  esUltima: boolean;
}

export type Estado = "pagado" | "proximo" | "vencido" | "pendiente";

/** Primera fecha de pago del plan: 16 de setiembre de 2026. */
export function primerVencimiento(): Date {
  return new Date(2026, 8, DIA_DE_PAGO);
}

export function addMonths(d: Date, k: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + k, d.getDate());
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Construye el cronograma completo hasta llegar a saldo 0. */
export function buildSchedule(inicio: Date): Cuota[] {
  const cuotas: Cuota[] = [];
  let saldo = DEUDA_INICIAL;
  let n = 1;
  while (saldo > 0.001) {
    const pago = Math.min(CUOTA_MENSUAL, saldo);
    saldo = Math.round((saldo - pago) * 100) / 100;
    cuotas.push({
      n,
      fecha: addMonths(inicio, n - 1),
      pago,
      saldo,
      esUltima: false,
    });
    n += 1;
  }
  if (cuotas.length > 0 && cuotas[cuotas.length - 1].pago < CUOTA_MENSUAL) {
    cuotas[cuotas.length - 1].esUltima = true;
  }
  return cuotas;
}

const money = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(v: number): string {
  return `S/ ${money.format(v)}`;
}

export function fmtFechaLarga(d: Date): string {
  const t = d.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
