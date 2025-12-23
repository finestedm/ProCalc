import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export const useNotifications = () => {
    const { profile } = useAuth();

    useEffect(() => {
        if (!profile) return;

        // 1. Request Notification Permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // 2. Subscribe to Real-time Changes
        const channel = supabase
            .channel('calculations_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'calculations'
                },
                (payload) => {
                    handlePayload(payload);
                }
            )
            .subscribe();

        const handlePayload = (payload: any) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;

            // Don't notify the person who made the change (if we can track it)
            // Note: Currently we don't have a 'last_edited_by' field, 
            // but we can check if the current user just saved a version from App.tsx.
            // For now, simpler: Notify if user is part of the project but not the one who saved it.
            // (Payload doesn't contain the shooter's ID unless we add it to the table)

            const userId = profile.id;
            const isEngineer = newRecord.engineer_id === userId;
            const isSpecialist = newRecord.specialist_id === userId;
            const isCreator = newRecord.user_id === userId;

            if (!isEngineer && !isSpecialist && !isCreator) return;

            let title = '';
            let body = '';

            if (eventType === 'INSERT') {
                title = `Nowa wersja projektu ${newRecord.project_id}`;
                body = `Użytkownik dodał nową kalkulację dla klienta ${newRecord.customer_name}.`;
            } else if (eventType === 'UPDATE') {
                // Check for logistics takeover
                if (newRecord.logistics_operator_id && !oldRecord?.logistics_operator_id) {
                    title = `Projekt ${newRecord.project_id} przejęty przez logistykę`;
                    body = `Ktoś z działu logistyki rozpoczął obsługę klienta ${newRecord.customer_name}.`;
                } else {
                    title = `Zmiany w projekcie ${newRecord.project_id}`;
                    body = `Zaktualizowano dane projektu dla klienta ${newRecord.customer_name}.`;
                }
            }

            if (title && Notification.permission === 'granted') {
                new Notification(title, {
                    body,
                    icon: '/favicon.ico' // Ensure valid icon path or relative to project
                });
            }
        };

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile]);

    return null;
};
