import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./auth-context";
import {
  getStoredSession,
  login as loginRequest,
  register as registerRequest,
  type SessionResponse,
} from "../api/client";

const sessionStorageKey = "car-dealership-session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionResponse | null>(() =>
    getStoredSession(),
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(sessionStorageKey);
    setSession(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("auth:unauthorized", clearSession);
    return () => window.removeEventListener("auth:unauthorized", clearSession);
  }, [clearSession]);

  const establishSession = useCallback((nextSession: SessionResponse) => {
    localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      establishSession(await loginRequest({ email, password }));
    },
    [establishSession],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      establishSession(await registerRequest({ email, password }));
    },
    [establishSession],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      login,
      register,
      logout,
    }),
    [session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
