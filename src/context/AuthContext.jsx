import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { db, session } from '../lib/store';
import { authenticate, groupsForUser } from '../lib/domain';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => session.get()?.userId || null);
  const [activeGroupId, setActiveGroupId] = useState(() => session.get()?.activeGroupId || null);
  // contador para forçar re-render após mutações no store
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const persist = useCallback((uId, gId) => {
    if (uId) session.set({ userId: uId, activeGroupId: gId || null });
    else session.clear();
  }, []);

  const login = useCallback((loginStr, password) => {
    const u = authenticate(loginStr, password);
    const groups = groupsForUser(u.id);
    const gId = groups[0]?.id || null;
    setUserId(u.id);
    setActiveGroupId(gId);
    persist(u.id, gId);
    return u;
  }, [persist]);

  const loginUser = useCallback((u) => {
    const groups = groupsForUser(u.id);
    const gId = groups[0]?.id || null;
    setUserId(u.id);
    setActiveGroupId(gId);
    persist(u.id, gId);
  }, [persist]);

  const logout = useCallback(() => {
    setUserId(null);
    setActiveGroupId(null);
    persist(null, null);
  }, [persist]);

  const selectGroup = useCallback((gId) => {
    setActiveGroupId(gId);
    persist(userId, gId);
    refresh();
  }, [userId, persist, refresh]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const user = useMemo(() => (userId ? db.byId('users', userId) : null), [userId, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => (userId ? groupsForUser(userId) : []), [userId, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeGroup = useMemo(
    () => (activeGroupId ? db.byId('groups', activeGroupId) : null),
    [activeGroupId, tick]
  );

  const value = {
    user,
    groups,
    activeGroup,
    activeGroupId,
    login,
    loginUser,
    logout,
    selectGroup,
    setActiveGroupId: selectGroup,
    refresh,
    tick,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
