import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Listbox, ListboxSection, ListboxItem, User, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { NAVIGATION_SECTIONS } from '@/core/config/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLogout } from '@/features/auth/hooks/useLogout';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const { logout } = useLogout();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#f8f8f8]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#f8f8f8] flex flex-col">
        <div className="p-6">
          <img src="/brand.png" alt="DynaInfo" className="w-[95px] h-auto" />
        </div>

        <nav className="px-4 flex-1 overflow-y-auto py-4 border-t border-gray-200">
          <Listbox
            variant="light"
            aria-label="Navigation menu"
            className="space-y-6"
            selectionMode="none"
          >
            <>
              {/* Compañía General - sin sección */}
              <ListboxItem
                key="/dashboard"
                href="/dashboard"
                className={`cursor-pointer mb-4 ${location.pathname === '/dashboard' ? 'bg-gray-200/60' : ''}`}
              >
                Compañía General
              </ListboxItem>

              {/* Resto de secciones */}
              {NAVIGATION_SECTIONS.filter(section => section.title !== 'General').map((section) => (
                <ListboxSection
                  key={section.title}
                  title={section.title}
                  classNames={{
                    heading: "text-xs font-normal text-default-400 px-2 pb-1 uppercase",
                  }}
                >
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <ListboxItem
                        key={item.href}
                        href={item.href}
                        className={`cursor-pointer ${isActive ? 'bg-gray-200/60' : ''}`}
                      >
                        {item.label}
                      </ListboxItem>
                    );
                  })}
                </ListboxSection>
              ))}
            </>
          </Listbox>
        </nav>

        <div className="mt-auto border-t border-gray-200 p-3">
          {user && (
            <Dropdown placement="top-start">
              <DropdownTrigger>
                <div className="cursor-pointer">
                  <User
                    name={user.name || 'Usuario'}
                    description={user.email}
                    avatarProps={{
                      size: 'sm',
                      name: user.name || 'Usuario',
                      showFallback: true,
                    }}
                    classNames={{
                      name: 'text-xs font-semibold',
                      description: 'text-[10px] text-default-500 truncate',
                    }}
                  />
                </div>
              </DropdownTrigger>
              <DropdownMenu aria-label="User menu" disabledKeys={["profile"]}>
                <DropdownItem
                  key="profile"
                  textValue="Perfil"
                  className="cursor-default opacity-100"
                  classNames={{
                    base: "cursor-default data-[hover=true]:bg-transparent",
                  }}
                >
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white font-semibold text-sm">
                      {(user.name || 'Usuario').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{user.name || 'Usuario'}</span>
                      <span className="text-xs text-default-500">{user.email}</span>
                    </div>
                  </div>
                </DropdownItem>
                <DropdownItem
                  key="divider"
                  isReadOnly
                  className="p-0 cursor-default opacity-100 hover:bg-transparent"
                >
                  <div className="border-t border-divider" />
                </DropdownItem>
                <DropdownItem
                  key="logout"
                  textValue="Cerrar Sesión"
                  color="danger"
                  className="text-danger cursor-pointer"
                  startContent={<ArrowRightOnRectangleIcon className="h-5 w-5" />}
                  onPress={() => { void logout(); }}
                >
                  Cerrar Sesión
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto py-4 px-10 m-2 bg-white shadow rounded-xl">
        {children}
      </main>
    </div>
  );
}
