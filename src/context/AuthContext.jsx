import { createContext, useContext, useState, useEffect } from 'react';
import api, { setToken, setRefreshToken, clearTokens } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then(res => setUser(res.data))
      .catch(() => { clearTokens(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post('/api/auth/login', { email, password });
    const { user: u, accessToken, refreshToken } = res.data;
    setToken(accessToken);
    setRefreshToken(refreshToken);
    setUser(u);
    return u;
  }

  async function logout() {
    try { await api.post('/api/auth/logout'); } catch {}
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
