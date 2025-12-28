import { supabase } from '../services/supabaseClient';

export interface Notification {
    id: string;
    user_id: string;
    type: 'alert' | 'info' | 'success' | 'warning';
    title: string;
    message: string;
    is_read: boolean;
    link?: string;
    created_at: string;
}

export const notificationService = {
    /**
     * Sends a notification to a specific user or broadcasts to a role if logic permits.
     * Currently inserts explicitly for user_id.
     */
    sendNotification: async (
        userId: string,
        title: string,
        message: string,
        type: 'alert' | 'info' | 'success' | 'warning' = 'info',
        link?: string
    ) => {
        try {
            const { error } = await supabase.from('notifications').insert({
                user_id: userId,
                title,
                message,
                type,
                link,
                is_read: false
            });
            if (error) throw error;
        } catch (e) {
            console.error("Failed to send notification", e);
        }
    },

    /**
     * Broadcasts a notification to all users with a specific role
     */
    notifyRole: async (
        role: 'manager' | 'admin' | 'logistics',
        title: string,
        message: string,
        type: 'alert' | 'info' | 'success' | 'warning' = 'info',
        link?: string
    ) => {
        try {
            // 1. Fetch users with role
            const { data: users, error } = await supabase
                .from('users')
                .select('id')
                .eq('role', role);

            if (error || !users) {
                console.error("Failed to fetch users for role broadcast", error);
                return;
            }

            // 2. Insert for each
            const notifications = users.map(u => ({
                user_id: u.id,
                title,
                message,
                type,
                link,
                is_read: false
            }));

            if (notifications.length > 0) {
                await supabase.from('notifications').insert(notifications);
            }

        } catch (e) {
            console.error("Broadcast failed", e);
        }
    },

    /**
     * Marks specific notifications as read based on title pattern.
     * Useful for clearing old requests when a new one is sent.
     */
    markNotificationsAsRead: async (userId: string, titlePattern: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .ilike('title', titlePattern)
                .eq('is_read', false);

            if (error) throw error;
        } catch (e) {
            console.error("Failed to mark notifications as read", e);
        }
    }
};
