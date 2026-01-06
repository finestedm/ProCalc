import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
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

    // Track active fetch to prevent double-firing (e.g. StrictMode or rapid events)
    const activeFetchPromise = useRef<Promise<UserProfile | null> | null>(null);

    const fetchUserProfile = async (userId: string, session: Session): Promise<UserProfile | null> => {
        const fetchStart = Date.now();

        // No loading state change here; UI proceeds immediately while profile loads in background

        if (activeFetchPromise.current) {
            console.log('[Auth] Profile fetch already in progress, awaiting...');
            try {
                const profile = await activeFetchPromise.current;
                setAuthState(prev => {
                    console.log(`[Auth] Reusing existing fetch result for ${userId}. Success: ${!!profile}`);
                    return { ...prev, user: session.user, profile, session, loading: false };
                });
                return profile;
            } catch (e) {
                console.warn('[Auth] Awaited profile fetch failed:', e);
                setAuthState(prev => ({ ...prev, user: session.user, session, loading: false }));
                return null;
            }
        }

        console.log('[Auth] Starting new profile fetch for:', userId);
        const fetchOp = authService.getUserProfile(userId)
            .then(p => {
                console.log(`[Auth] Profile retrieved for ${userId} in ${Date.now() - fetchStart}ms. Success: ${!!p}`);
                return p;
            })
            .catch(e => {
                console.error(`[Auth] Profile fetch FAILED for ${userId} after ${Date.now() - fetchStart}ms:`, e);
                return null;
            })
            .finally(() => {
                activeFetchPromise.current = null;
            });

        activeFetchPromise.current = fetchOp;

        const profile = await fetchOp;
        setAuthState(prev => {
            console.log(`[Auth] Atomic update for user ${userId}. Profile: ${!!profile}`);
            return {
                ...prev,
                user: session.user,
                profile,
                session,
                loading: false,
            };
        });
        return profile;
    };

    useEffect(() => {
        let isMounted = true;
        const initStart = Date.now();

        // Safety fallback: if no auth event happens in 2s, assume not logged in or stuck
        const safetyTimer = setTimeout(() => {
            if (isMounted) {
                setAuthState(prev => {
                    if (prev.loading && !prev.user) {
                        console.warn(`[Auth] No auth event after 2s. Unblocking as 'Not Logged In'.`);
                        return { ...prev, loading: false };
                    }
                    return prev;
                });
            }
        }, 2000);

        // Nasłuchuj zmian w stanie uwierzytelniania
        // onAuthStateChange fires INITIAL_SESSION automatically on startup
        const unsubscribe = authService.onAuthStateChange(async (event, session) => {
            const timeSinceStart = Date.now() - initStart;
            console.log(`[Auth] State change event [${timeSinceStart}ms]:`, event, session?.user?.id || 'No User');

            if (!isMounted) return;

            if (session?.user) {
                // Update user immediately and clear loading flag
                setAuthState(prev => ({
                    ...prev,
                    user: session.user,
                    session: session,
                    loading: false // UI can proceed now; profile will load in background
                }));
                // Fire-and-forget profile fetch; it will update profile when ready
                fetchUserProfile(session.user.id, session);
            } else {
                console.log('[Auth] No session found via event');
                setAuthState(prev => ({
                    ...prev,
                    user: null,
                    profile: null,
                    session: null,
                    loading: false
                }));
            }
        });

        // We NO LONGER call initAuth() here. 
        // We let Supabase push the INITIAL_SESSION event to us.

        return () => {
            console.log('[Auth] AuthProvider unmounting');
            isMounted = false;
            unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ ...authState, signIn, signUp, signOut, refreshProfile, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
