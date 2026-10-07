import { Card, CardBody, Skeleton } from '@heroui/react';
import { useChangelogEntries } from '../hooks/useChangelog';
import { ChangelogEntryCard } from '../components/ChangelogEntryCard';
import { PublicPageShell } from '../components/PublicPageShell';
import { SubscribeForm } from '../components/SubscribeForm';

function EntriesList() {
  const { data: entries, isLoading, isError } = useChangelogEntries();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando novedades">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">
        No hemos podido cargar las novedades. Vuelve a intentarlo más tarde.
      </p>
    );
  }
  if (!entries?.length) {
    return <p className="text-sm text-default-500">Todavía no hay novedades publicadas.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => (
        <ChangelogEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

/** Public "what's new" page: subscribe form + published entries, newest first. */
export function NovedadesPage() {
  return (
    <PublicPageShell>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Novedades</h1>
        <p className="text-default-600">Las mejoras de DynaInfo, de la más reciente a la más antigua.</p>
      </header>
      <Card shadow="none" className="bg-default-50">
        <CardBody className="gap-3 p-6">
          <h2 className="text-base font-semibold text-foreground">Recibe las novedades por correo</h2>
          <SubscribeForm />
        </CardBody>
      </Card>
      <EntriesList />
    </PublicPageShell>
  );
}
