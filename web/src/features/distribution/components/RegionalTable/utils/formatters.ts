const numberFormatters = new Map<string, Intl.NumberFormat>();
const percentFormatters = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, locale: string): string {
  if (!numberFormatters.has(locale)) {
    numberFormatters.set(
      locale,
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    );
  }
  return numberFormatters.get(locale)!.format(value);
}

export function formatPercent(value: number, locale: string, decimals: number = 2): string {
  const key = `${locale}-${decimals}`;
  if (!percentFormatters.has(key)) {
    percentFormatters.set(
      key,
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    );
  }
  return percentFormatters.get(key)!.format(value);
}
