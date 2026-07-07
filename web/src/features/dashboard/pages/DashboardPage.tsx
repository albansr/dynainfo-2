import { useAuth } from '@/features/auth/hooks/useAuth';
import { getRoleChannelLabel } from '@/core/config/access';
import { DashboardView } from '../components/DashboardView';

export function DashboardPage() {
  const { user } = useAuth();
  const channelLabel = getRoleChannelLabel(user?.dynaRole);

  return (
    <DashboardView
      title={channelLabel ? 'Análisis General' : 'Análisis General de la compañía'}
      chip={channelLabel ? `Canal ${channelLabel}` : undefined}
    />
  );
}
