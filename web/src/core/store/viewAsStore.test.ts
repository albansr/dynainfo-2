import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, type User } from '@/core/store/authStore';
import { useViewAsStore } from './viewAsStore';

const realAdmin: User = {
  id: 'u1', email: 'admin@dyna.co', emailVerified: true, name: 'Admin', image: null,
  dynaRole: 'ADMIN', scope: null, createdAt: new Date(), updatedAt: new Date(),
};

describe('useViewAsStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useViewAsStore.setState({ viewAs: null });
    useAuthStore.setState({ user: realAdmin, realDynaRole: 'ADMIN', realScope: null, realRole: 'user', demoRole: null, demoScope: null });
  });

  it('lets a real ADMIN view as a requester role and go back', () => {
    useViewAsStore.getState().start({ dynaRole: 'SELLER', scope: 'MD14', ticketNumber: 12 });

    expect(useAuthStore.getState().user).toMatchObject({ dynaRole: 'SELLER', scope: 'MD14' });
    expect(JSON.parse(sessionStorage.getItem('support-view-as') ?? '{}').state.viewAs.ticketNumber).toBe(12);

    useViewAsStore.getState().stop();

    expect(useAuthStore.getState().user).toMatchObject({ dynaRole: 'ADMIN', scope: null });
    expect(useViewAsStore.getState().viewAs).toBeNull();
  });

  it('lets a superadmin view as a role too', () => {
    useAuthStore.setState({ realDynaRole: null, realRole: 'superadmin' });

    useViewAsStore.getState().start({ dynaRole: 'SELLER', scope: 'MD14', ticketNumber: 4 });

    expect(useAuthStore.getState().user).toMatchObject({ dynaRole: 'SELLER', scope: 'MD14' });
  });

  it('does nothing when the real role is not an agent (even if the UI shows ADMIN)', () => {
    useAuthStore.setState({ realDynaRole: 'SELLER', realScope: 'MD14', realRole: 'user' });

    useViewAsStore.getState().start({ dynaRole: 'BOARD', scope: null, ticketNumber: 3 });

    expect(useViewAsStore.getState().viewAs).toBeNull();
    expect(useAuthStore.getState().user?.dynaRole).toBe('ADMIN');
  });
});
