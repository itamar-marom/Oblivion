"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  authenticate,
  getToken,
  isTokenExpired,
  clearToken,
} from "@/lib/api-client";

/**
 * Auth state
 */
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Auth context value
 */
interface AuthContextValue extends AuthState {
  login: (clientId: string, clientSecret: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Default credentials for Observer Dashboard
 * In production, these would come from environment variables or a login form
 */
const DEFAULT_CLIENT_ID = "observer-dashboard";
const DEFAULT_CLIENT_SECRET = "observer_secret";

/**
 * Auth Provider component
 *
 * Wraps the app to provide authentication state and methods.
 * Auto-authenticates using Observer Dashboard credentials on mount.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  /**
   * Check if current auth is valid
   */
  const checkAuth = useCallback((): boolean => {
    const token = getToken();
    if (!token) return false;
    return !isTokenExpired();
  }, []);

  /**
   * Login with client credentials
   */
  const login = useCallback(
    async (clientId: string, clientSecret: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await authenticate(clientId, clientSecret);
        setState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        setState({
          isAuthenticated: false,
          isLoading: false,
          error: message,
        });
        return false;
      }
    },
    []
  );

  /**
   * Logout and clear token
   */
  const logout = useCallback(() => {
    clearToken();
    setState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Auto-authenticate on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      // Check if already authenticated
      if (checkAuth()) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Auto-login with default credentials
      await login(DEFAULT_CLIENT_ID, DEFAULT_CLIENT_SECRET);
    };

    initAuth();
  }, [checkAuth, login]);

  /**
   * Token refresh interval (every 4 minutes, token expires in 5 minutes)
   */
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const refreshInterval = setInterval(async () => {
      if (isTokenExpired()) {
        // Re-authenticate with default credentials
        await login(DEFAULT_CLIENT_ID, DEFAULT_CLIENT_SECRET);
      }
    }, 4 * 60 * 1000); // 4 minutes

    return () => clearInterval(refreshInterval);
  }, [state.isAuthenticated, login]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
