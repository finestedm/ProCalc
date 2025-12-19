/// <reference types="vite/client" />
import { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: 'engineer' | 'specialist' | 'manager' | 'logistics';
    pending_role: 'engineer' | 'specialist' | 'manager' | 'logistics' | null;
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
    private supabase: SupabaseClient = supabase;

    constructor() {
        // Client initialized via shared instance
    }

    /**
     * Rejestracja nowego użytkownika
     */
    async signUp(email: string, password: string, fullName: string, role: 'engineer' | 'specialist' | 'manager'): Promise<{ user: User | null; error: Error | null }> {


        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: role, // Default role
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


        const { error } = await this.supabase.auth.signOut();
        return { error };
    }

    /**
     * Pobranie aktualnie zalogowanego użytkownika
     */
    async getCurrentUser(): Promise<User | null> {


        const { data } = await this.supabase.auth.getUser();
        return data.user;
    }

    /**
     * Pobranie sesji użytkownika
     */
    async getSession(): Promise<Session | null> {


        const { data } = await this.supabase.auth.getSession();
        return data.session;
    }

    /**
     * Pobranie profilu użytkownika z tabeli users
     */
    async getUserProfile(userId: string): Promise<UserProfile | null> {


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


        const { data: { subscription } } = this.supabase.auth.onAuthStateChange(callback);
        return () => subscription.unsubscribe();
    }

    /**
     * Pobranie wszystkich użytkowników (tylko dla adminów)
     */
    async getAllUsers(): Promise<UserProfile[]> {


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
     * Jeśli zmieniana jest rola, ustawia ona pending_role zamiast bezpośredniej zmiany (chyba że robi to admin)
     */
    async updateUserProfile(userId: string, updates: { full_name?: string; role?: 'engineer' | 'specialist' | 'manager' | 'logistics' }): Promise<{ error: Error | null }> {

        // Jeśli użytkownik jest adminem, może zmienić rolę bezpośrednio
        // Jeśli nie, zmiana roli ustawia pending_role

        const payload: any = { updated_at: new Date().toISOString() };
        if (updates.full_name) payload.full_name = updates.full_name;

        // Sprawdź czy aktualnie zalogowany użytkownik jest adminem, aby pozwolić na bezpośrednią zmianę
        const currentUser = await this.getCurrentUser();
        const { data: requesterProfile } = await this.supabase
            .from('users')
            .select('is_admin')
            .eq('id', currentUser?.id)
            .single();

        if (updates.role) {
            if (requesterProfile?.is_admin) {
                payload.role = updates.role;
                payload.pending_role = null; // Clear pending if admin changes it
            } else {
                payload.pending_role = updates.role;
            }
        }

        const { error } = await this.supabase
            .from('users')
            .update(payload)
            .eq('id', userId);

        if (error) {
            console.error('Error updating user profile:', error);
            return { error };
        }

        return { error: null };
    }

    /**
     * Zatwierdzenie zmiany roli (tylko dla adminów/menadżerów)
     */
    async approveRoleChange(userId: string): Promise<{ error: Error | null }> {

        // Pobierz pending_role
        const { data: user } = await this.supabase
            .from('users')
            .select('pending_role')
            .eq('id', userId)
            .single();

        if (!user?.pending_role) {
            return { error: new Error('Brak oczekującej zmiany roli') };
        }

        const { error } = await this.supabase
            .from('users')
            .update({
                role: user.pending_role,
                pending_role: null
            })
            .eq('id', userId);

        return { error };
    }

    /**
     * Odrzucenie zmiany roli
     */
    async rejectRoleChange(userId: string): Promise<{ error: Error | null }> {
        const { error } = await this.supabase
            .from('users')
            .update({ pending_role: null })
            .eq('id', userId);

        return { error };
    }
}

// Singleton instance
export const authService = new AuthService();
