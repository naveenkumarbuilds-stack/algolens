import { useCallback, useEffect, useRef, useState } from 'react';
import { api, onSessionExpired } from '../api/client';
import { AuthContext } from './context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setStatus('loading');
    setError('');
    try {
      const data = await api('/auth/me');
      if (current === generation.current) {
        setUser(data.user);
        setStatus('ready');
      }
    } catch (error) {
      if (current !== generation.current) return;
      setUser(null);
      setStatus(error.status === 401 ? 'ready' : 'error');
      if (error.status !== 401) setError(error.message);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const unsubscribe = onSessionExpired(() => setUser(null));
    const current = generation.current;
    api('/auth/me')
      .then((data) => {
        if (active && current === generation.current) {
          setUser(data.user);
          setStatus('ready');
        }
      })
      .catch((error) => {
        if (!active || current !== generation.current) return;
        setUser(null);
        setStatus(error.status === 401 ? 'ready' : 'error');
        if (error.status !== 401) setError(error.message);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  async function authenticate(mode, input) {
    const data = await api(`/auth/${mode}`, { method: 'POST', body: input });
    generation.current++;
    setUser(data.user);
    setStatus('ready');
    setError('');
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    generation.current++;
    setUser(null);
    setStatus('ready');
  }
  return (
    <AuthContext.Provider value={{ user, status, error, refresh, authenticate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
