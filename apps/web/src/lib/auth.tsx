import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const TOKEN_KEY = 'ff_token';

type AuthContextValue = {
  token: string | null;
  setToken: (value: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(() => readToken());

  const setToken = (value: string | null) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (value) {
      window.localStorage.setItem(TOKEN_KEY, value);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(value);
  };

  useEffect(() => {
    const handler = () => setTokenState(readToken());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo(
    () => ({
      token,
      setToken,
      logout: () => setToken(null),
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const getStoredToken = () => readToken();
