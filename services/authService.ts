/// <reference types="vite/client" />
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: 'engineer' | 'specialist' | 'admin';
    approved: boolean;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
}

export interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
}

export class AuthService {
    private supabase: SupabaseClient | null = null;

    constructor() {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        } else {
            console.warn('Supabase credentials not found. Authentication will not work.');
        }
    }

    /**
     * Rejestracja nowego użytkownika
     */
    async signUp(email: string, password: string, fullName: string, role: 'engineer' | 'specialist' | 'admin'): Promise<{ user: User | null; error: Error | null }> {
        if (!this.supabase) {
            return { user: null, error: new Error('Supabase client not initialized') };
        }

        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: role,
                },
            },
        });

        if (error) {
            return { user: null, error };
        }

        return { user: data.user, error: null };
    }

    /**
     * Logowanie użytkownika
     */
    async signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
        if (!this.supabase) {
            return { user: null, error: new Error('Supabase client not initialized') };
        }

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return { user: null, error };
        }

        return { user: data.user, error: null };
    }

    /**
     * Wylogowanie użytkownika
     */
    async signOut(): Promise<{ error: Error | null }> {
        if (!this.supabase) {
            return { error: new Error('Supabase client not initialized') };
        }

        const { error } = await this.supabase.auth.signOut();
        return { error };
    }

    /**
     * Pobranie aktualnie zalogowanego użytkownika
     */
    async getCurrentUser(): Promise<User | null> {
        if (!this.supabase) return null;

        const { data } = await this.supabase.auth.getUser();
        return data.user;
    }

    /**
     * Pobranie sesji użytkownika
     */
    async getSession(): Promise<Session | null> {
        if (!this.supabase) return null;

        const { data } = await this.supabase.auth.getSession();
        return data.session;
    }

    /**
     * Pobranie profilu użytkownika z tabeli users
     */
    async getUserProfile(userId: string): Promise<UserProfile | null> {
        if (!this.supabase) return null;

        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }

        return data as UserProfile;
    }

    /**
     * Nasłuchiwanie zmian w stanie uwierzytelniania
     */
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        if (!this.supabase) return () => { };

        const { data: { subscription } } = this.supabase.auth.onAuthStateChange(callback);
        return () => subscription.unsubscribe();
    }

    /**
     * Pobranie wszystkich użytkowników (tylko dla adminów)
     */
    async getAllUsers(): Promise<UserProfile[]> {
        if (!this.supabase) return [];

        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }

        return data as UserProfile[];
    }

    /**
     * Zatwierdzenie użytkownika (tylko dla adminów)
     */
    async approveUser(userId: string): Promise<{ error: Error | null }> {
        if (!this.supabase) {
            return { error: new Error('Supabase client not initialized') };
        }

        const { error } = await this.supabase
            .from('users')
            .update({ approved: true, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('Error approving user:', error);
            return { error };
        }

        return { error: null };
    }

    /**
     * Nadanie uprawnień admina (tylko dla adminów)
     */
    async makeAdmin(userId: string): Promise<{ error: Error | null }> {
        if (!this.supabase) {
            return { error: new Error('Supabase client not initialized') };
        }

        const { error } = await this.supabase
            .from('users')
            .update({ is_admin: true, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('Error making user admin:', error);
            return { error };
        }

        return { error: null };
    }

    /**
     * Cofnięcie zatwierdzenia użytkownika (tylko dla adminów)
     */
    async revokeApproval(userId: string): Promise<{ error: Error | null }> {
        if (!this.supabase) {
            return { error: new Error('Supabase client not initialized') };
        }

        const { error } = await this.supabase
            .from('users')
            .update({ approved: false, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('Error revoking approval:', error);
            return { error };
        }

        return { error: null };
    }

    /**
     * Aktualizacja profilu użytkownika
     */
    async updateUserProfile(userId: string, updates: { full_name?: string; role?: 'engineer' | 'specialist' | 'admin' }): Promise<{ error: Error | null }> {
        if (!this.supabase) {
            return { error: new Error('Supabase client not initialized') };
        }

        const { error } = await this.supabase
            .from('users')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user profile:', error);
            return { error };
        }

        return { error: null };
    }
}

// Singleton instance
export const authService = new AuthService();
