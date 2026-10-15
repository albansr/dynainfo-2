import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { EyeIcon } from '@heroicons/react/24/outline';
import { getRoleLabel } from '@/core/config/access';
import { useAuthStore } from '@/core/store/authStore';
import { useViewAsStore } from '@/core/store/viewAsStore';

/** Permanent notice while a support agent views DynaInfo as a requester's role. */
export function ViewAsBanner() {
  const viewAs = useViewAsStore((s) => s.viewAs);
  const stop = useViewAsStore((s) => s.stop);
  const isRealAdmin = useAuthStore((s) => s.realDynaRole === 'ADMIN');
  const navigate = useNavigate();

  if (!viewAs || !isRealAdmin) return null;
  const role = getRoleLabel(viewAs.dynaRole) || 'Sin rol';

  return (
    <div
      role="status"
      className="mx-2 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-300 bg-warning-50 px-4 py-2 text-sm text-warning-800"
    >
      <span className="flex items-center gap-2">
        <EyeIcon className="h-4 w-4" aria-hidden="true" />
        Estás viendo DynaInfo como {role}
        {viewAs.scope ? ` · ${viewAs.scope}` : ''} (solicitud #{viewAs.ticketNumber})
      </span>
      <Button
        size="sm"
        variant="flat"
        color="warning"
        className="cursor-pointer"
        onPress={() => {
          stop();
          navigate(`/soporte/${viewAs.ticketNumber}`);
        }}
      >
        Salir
      </Button>
    </div>
  );
}
