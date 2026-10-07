import { Card, CardBody, Chip } from '@heroui/react';
import type { ChangelogEntry } from '../hooks/useChangelog';
import { CATEGORY_DISPLAY, formatEntryDate, splitBold } from '../utils/changelogFormat';

function RichItem({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((segment, i) =>
        segment.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {segment.text}
          </strong>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function ChangelogEntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <Card as="article" shadow="none" className="border border-default-200">
      <CardBody className="gap-4 p-6">
        <header className="flex flex-col gap-1">
          <time dateTime={entry.date} className="text-xs text-default-500">
            {formatEntryDate(entry.date)}
          </time>
          <h2 className="text-lg font-semibold text-foreground">{entry.title}</h2>
          {entry.summary && <p className="text-sm text-default-600">{entry.summary}</p>}
        </header>
        {entry.image && (
          <img
            src={entry.image.src}
            alt={entry.image.alt}
            loading="lazy"
            className="h-auto w-full rounded-lg border border-default-200"
          />
        )}
        {entry.changes.map((group) => {
          const { label, color } = CATEGORY_DISPLAY[group.category];
          return (
            <section key={group.category} className="flex flex-col gap-2">
              <Chip size="sm" variant="flat" color={color} className="w-fit">
                {label}
              </Chip>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-default-700">
                {group.items.map((item) => (
                  <li key={item}>
                    <RichItem text={item} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </CardBody>
    </Card>
  );
}
