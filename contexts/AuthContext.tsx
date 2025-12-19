import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService, UserProfile, AuthState } from '../services/authService';

interface AuthContextType extends AuthState {
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, fullName: string, role: 'engineer' | 'specialist' | 'manager') => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    updateProfile: (updates: { full_name?: string; role?: 'engineer' | 'specialist' | 'manager' }) => Promise<{ error: Error | null }>;
    approveRoleChange: (userId: string) => Promise<{ error: Error | null }>;
    rejectRoleChange: (userId: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        profile: null,
        session: null,
        loading: true,
    });

    const refreshProfile = async () => {
        const user = await authService.getCurrentUser();
        if (user) {
            const profile = await authService.getUserProfile(user.id);
            setAuthState(prev => ({ ...prev, profile }));
        }
    };

    const signIn = async (email: string, password: string) => {
        const { user, error } = await authService.signIn(email, password);

        if (error) {
            return { error };
        }

        if (user) {
            const profile = await authService.getUserProfile(user.id);
            const session = await authService.getSession();
            setAuthState({ user, profile, session, loading: false });
        }

        return { error: null };
    };

    const signUp = async (email: string, password: string, fullName: string, role: 'engineer' | 'specialist' | 'manager') => {
        const { user, error } = await authService.signUp(email, password, fullName, role);

        if (error) {
            return { error };
        }

        // Po rejestracji użytkownik musi poczekać na zatwierdzenie
        // Więc nie ustawiamy go jako zalogowanego
        return { error: null };
    };

    const updateProfile = async (updates: { full_name?: string; role?: 'engineer' | 'specialist' | 'manager' }) => {
        const user = await authService.getCurrentUser();
        if (!user) {
            return { error: new Error('User not authenticated') };
        }

        const result = await authService.updateUserProfile(user.id, updates);

        if (!result.error) {
            await refreshProfile();
        }

        return result;
    };

    const approveRoleChange = async (userId: string) => {
        const result = await authService.approveRoleChange(userId);
        if (!result.error && authState.user?.id === userId) {
            await refreshProfile(); // Refresh profile if the current user's role was approved
        }
        return result;
    };

    const rejectRoleChange = async (userId: string) => {
        const result = await authService.rejectRoleChange(userId);
        if (!result.error && authState.user?.id === userId) {
            await refreshProfile(); // Refresh profile if the current user's role was rejected
        }
        return result;
    };

    const signOut = async () => {
        await authService.signOut();
        setAuthState({ user: null, profile: null, session: null, loading: false });
    };

    useEffect(() => {
        // Sprawdź czy użytkownik jest już zalogowany
        const initAuth = async () => {
            const session = await authService.getSession();
            if (session?.user) {
                const profile = await authService.getUserProfile(session.user.id);
                setAuthState({
                    user: session.user,
                    profile,
                    session,
                    loading: false,
                });
            } else {
                setAuthState(prev => ({ ...prev, loading: false }));
            }
        };

        initAuth();

        // Nasłuchuj zmian w stanie uwierzytelniania
        const unsubscribe = authService.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const profile = await authService.getUserProfile(session.user.id);
                setAuthState({
                    user: session.user,
                    profile,
                    session,
                    loading: false,
                });
            } else {
                setAuthState({ user: null, profile: null, session: null, loading: false });
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ ...authState, signIn, signUp, signOut, refreshProfile, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
