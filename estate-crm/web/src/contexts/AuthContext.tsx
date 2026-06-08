import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { authControllerLogin, authControllerLogout, authControllerMe } from "../api/sdk.gen";
import type { AuthResponseDto } from "../api/types.gen";

interface AuthContextValue {
  user: AuthResponseDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponseDto>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponseDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authControllerMe()
      .then(({ data }) => {
        if (data) setUser(data as AuthResponseDto);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await authControllerLogin({
      body: { email, password },
    });
    if (error || !data) throw new Error("Login failed");
    const userData = data as AuthResponseDto;
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authControllerLogout();
    } catch {
      // ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
