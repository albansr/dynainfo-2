import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Standalone layout for the public Novedades pages (no session, no app sidebar). */
export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
        <Link to="/" className="w-fit cursor-pointer" aria-label="Ir a DynaInfo">
          <img src="/brand.png" alt="DynaInfo" className="h-auto w-[95px]" />
        </Link>
        {children}
      </div>
    </div>
  );
}
