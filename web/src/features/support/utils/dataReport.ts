/** Pre-filled draft for reporting a figure that doesn't add up ("¿Este dato no cuadra?"). */
export function dataReportDraft(metric: string, value?: string) {
  return {
    type: 'data' as const,
    subject: `${metric}: el dato no cuadra`,
    description: value ? `En «${metric}» veo ${value} y esperaba ` : `En «${metric}» `,
  };
}
