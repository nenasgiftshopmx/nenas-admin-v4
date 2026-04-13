'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface UsuarioData {
  email: string;
  nombre: string;
  rol: 'admin' | 'colaboradora' | 'solo_lectura';
  color: string;
}

interface AuthContextType {
  user: User | null;
  usuarioData: UsuarioData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USUARIOS: Record<string, UsuarioData> = {
  'tere@nenasgiftshop.com': {
    email: 'tere@nenasgiftshop.com',
    nombre: 'Tere',
    rol: 'admin',
    color: '#9333EA'
  },
  'cinthia@nenasgiftshop.com': {
    email: 'cinthia@nenasgiftshop.com',
    nombre: 'Cinthia',
    rol: 'admin',
    color: '#10B981'
  },
  'veronica@nenasgiftshop.com': {
    email: 'veronica@nenasgiftshop.com',
    nombre: 'Vero',
    rol: 'colaboradora',
    color: '#F59E0B'
  },
  'empleada@nenasgiftshop.com': {
    email: 'empleada@nenasgiftshop.com',
    nombre: 'Empleada',
    rol: 'solo_lectura',
    color: '#6B7280'
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuarioData, setUsuarioData] = useState<UsuarioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user && user.email) {
        setUsuarioData(USUARIOS[user.email] || null);
      } else {
        setUsuarioData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, usuarioData, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
