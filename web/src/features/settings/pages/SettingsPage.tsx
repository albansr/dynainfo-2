import { useState } from 'react';
import { toast } from 'sonner';
import { SelectItem, Input, Button, Chip } from '@heroui/react';
import { AppSelect } from '@/core/components/AppSelect';
import { PageHeader } from '@/core/components/PageHeader';
import { useAuthStore } from '@/core/store/authStore';
import { DEMO_ROLE_EMAIL } from '@/core/config/constants';
import { REGIONAL_GROUPS } from '@/core/config/access';

const DEMO_ROLES: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Gerencia General' },
  { value: 'MANAGER', label: 'Gerencias' },
  { value: 'BOARD', label: 'Junta General' },
  { value: 'RETAIL', label: 'Dirección Retail' },
  { value: 'NEW_CHANNELS', label: 'Dirección Nuevos Canales' },
  { value: 'DISTRIBUTION', label: 'Directores' },
  { value: 'SELLER', label: 'Vendedores' },
];

function DemoRoleSwitcher() {
  const user = useAuthStore((s) => s.user);
  const setDemoRole = useAuthStore((s) => s.setDemoRole);
  const [role, setRole] = useState<string>(user?.dynaRole ?? 'MANAGER');
  const [scope, setScope] = useState<string>(user?.scope ?? '');

  const needsGroup = role === 'DISTRIBUTION';
  const needsSeller = role === 'SELLER';

  const apply = () => {
    const nextScope = needsGroup || needsSeller ? scope.trim() || null : null;
    setDemoRole(role, nextScope);
    toast.success(`Rol de demo aplicado: ${DEMO_ROLES.find((r) => r.value === role)?.label ?? role}`);
  };

  return (
    <div className="border border-amber-300 bg-amber-50/50 rounded-lg p-4 sm:p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-zinc-700">Simulador de roles (demo)</h2>
        <Chip size="sm" color="warning" variant="flat">solo demo</Chip>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Cambia tu rol temporalmente para ver cómo cambian el menú, la temporalidad, los años,
        la descarga de Excel y el recorte de datos. Se aplica solo en tu sesión.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <AppSelect
          label="Rol"
          className="max-w-xs"
          selectedKeys={[role]}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as string;
            if (v) { setRole(v); setScope(''); }
          }}
        >
          {DEMO_ROLES.map((r) => (
            <SelectItem key={r.value}>{r.label}</SelectItem>
          ))}
        </AppSelect>

        {needsGroup && (
          <AppSelect
            label="Grupo regional"
            className="max-w-xs"
            selectedKeys={scope ? [scope] : []}
            onSelectionChange={(keys) => setScope((Array.from(keys)[0] as string) ?? '')}
          >
            {Object.keys(REGIONAL_GROUPS).map((g) => (
              <SelectItem key={g}>{`Grupo ${g} (${REGIONAL_GROUPS[g]!.join(', ')})`}</SelectItem>
            ))}
          </AppSelect>
        )}

        {needsSeller && (
          <Input
            label="seller_id"
            variant="bordered"
            className="max-w-xs"
            placeholder="Código de vendedor"
            value={scope}
            onValueChange={setScope}
          />
        )}

        <Button color="primary" onPress={apply}>Aplicar rol</Button>
      </div>

      <p className="text-xs text-zinc-400 mt-3">
        Rol activo: <span className="font-medium">{user?.dynaRole ?? '—'}</span>
        {user?.scope ? ` · scope: ${user.scope}` : ''}
      </p>
    </div>
  );
}

export function SettingsPage() {
  const email = useAuthStore((s) => s.user?.email);
  const isDemoUser = email === DEMO_ROLE_EMAIL;

  return (
    <div>
      <PageHeader title="Configuración" showDateFilter={false} />

      {isDemoUser && <DemoRoleSwitcher />}

      <div className="border border-zinc-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-1">Presupuesto</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Recarga los datos de presupuesto desde la fuente de datos. Úsalo cuando se hayan
          actualizado los archivos de presupuesto y quieras reflejar los cambios en los informes.
        </p>
        <button
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
          onClick={() =>
            toast('Se ha iniciado la tarea, en unos minutos se recargará el presupuesto')
          }
        >
          Recargar presupuesto
        </button>
      </div>
    </div>
  );
}
