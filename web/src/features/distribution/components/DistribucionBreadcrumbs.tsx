import { Breadcrumbs, BreadcrumbItem } from '@heroui/react';
import { useNavigate } from 'react-router-dom';

interface DistribucionBreadcrumbsProps {
  /** Label + path of the list level (Regionales / Vendedores / Clientes). */
  listLabel: string;
  listPath: string;
  /** When set, renders a detail level (the list becomes a link) with this label. */
  current?: string;
}

/**
 * Breadcrumbs for the distribution workspace. "Distribución" links to Inicio
 * (the distribution role's home dashboard); the list level links to its listing.
 */
export function DistribucionBreadcrumbs({ listLabel, listPath, current }: DistribucionBreadcrumbsProps) {
  const navigate = useNavigate();

  return (
    <Breadcrumbs
      size="sm"
      onAction={(key) => {
        if (key === 'inicio') navigate('/dashboard');
        else if (key === 'list') navigate(listPath);
      }}
    >
      <BreadcrumbItem key="inicio">Distribución</BreadcrumbItem>
      {current ? (
        <BreadcrumbItem key="list">{listLabel}</BreadcrumbItem>
      ) : (
        <BreadcrumbItem key="current">{listLabel}</BreadcrumbItem>
      )}
      {current ? <BreadcrumbItem key="current">{current}</BreadcrumbItem> : null}
    </Breadcrumbs>
  );
}
