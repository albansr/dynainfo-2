import type { SupportContext } from '../hooks/useSupport';
import { describeContext } from '../utils/describeContext';

/** The screen a request came from, in plain words (page, filters by label, dates, role). */
export function ContextFacts({ context }: { context: Partial<SupportContext> }) {
  // Requests store the summary built when sending; older ones are described now
  const summary = context.summary ?? describeContext(context);
  return (
    <dl className="flex flex-col gap-2">
      <div>
        <dt className="text-xs text-default-500">Pantalla</dt>
        <dd className="text-sm text-foreground">{summary.page}</dd>
      </div>
      {summary.items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-default-500">{item.label}</dt>
          <dd className="break-words text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
