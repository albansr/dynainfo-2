import { button } from '@heroui/react';
import { Link } from 'react-router-dom';
import { PublicPageShell } from '../components/PublicPageShell';

/**
 * Unsubscribe confirmation. GET /api/changelog/unsubscribe already opted the
 * subscriber out (token from the email link) and redirected here, so this page
 * is a plain confirmation — no token handling, no session.
 */
export function NovedadesBajaPage() {
  return (
    <PublicPageShell>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Te has dado de baja</h1>
        <p className="text-default-600">
          Ya no recibirás los correos de novedades de DynaInfo. Si fue sin querer, puedes volver a
          suscribirte desde la página de novedades.
        </p>
      </div>
      <Link
        to="/novedades"
        className={button({ color: 'primary', variant: 'flat', className: 'w-fit cursor-pointer' })}
      >
        Ver novedades
      </Link>
    </PublicPageShell>
  );
}
