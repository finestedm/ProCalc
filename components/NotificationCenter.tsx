import React, { useEffect, useState, useRef } from 'react';
import { Bell, Check, Trash2, ExternalLink, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
    id: string;
    type: 'alert' | 'info' | 'success' | 'warning';
    title: string;
    message: string;
    is_read: boolean;
    link?: string;
    created_at: string;
}

export const NotificationCenter: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();

            // Real-time subscription
            const subscription = supabase
                .channel('public:notifications')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
                    const newNotif = payload.new as Notification;
                    setNotifications(prev => [newNotif, ...prev]);
                    setUnreadCount(prev => prev + 1);
                    // Optional: Play sound
                })
                .subscribe();

            return () => {
                supabase.removeChannel(subscription);
            };
        }
    }, [user]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        const ids = notifications.filter(n => !n.is_read).map(n => n.id);
        if (ids.length === 0) return;

        await supabase.from('notifications').update({ is_read: true }).in('id', ids);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const deleteNotification = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await supabase.from('notifications').delete().eq('id', id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle size={16} className="text-green-500" />;
            case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
            case 'alert': return <AlertTriangle size={16} className="text-red-500" />;
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'success': return 'bg-green-50 dark:bg-green-900/20';
            case 'warning': return 'bg-amber-50 dark:bg-amber-900/20';
            case 'alert': return 'bg-red-50 dark:bg-red-900/20';
            default: return 'bg-blue-50 dark:bg-blue-900/20';
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors relative"
                title="Powiadomienia"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-white dark:border-zinc-900">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden animate-scaleIn origin-top-right">
                    <div className="flex items-center justify-between p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Powiadomienia</span>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-[10px] text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1">
                                <Check size={12} /> Oznacz wszystkie
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-zinc-400 text-xs italic">
                                Brak nowych powiadomień
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {notifications.map(n => (
                                    <div
                                        key={n.id}
                                        className={`p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group relative ${!n.is_read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => !n.is_read && markAsRead(n.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${getBgColor(n.type)}`}>
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h4 className={`text-xs font-bold mb-0.5 ${!n.is_read ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                                        {n.title}
                                                    </h4>
                                                    <span className="text-[9px] text-zinc-400 whitespace-nowrap ml-2">
                                                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mb-1.5 break-words">
                                                    {n.message}
                                                </p>

                                                {n.link && (
                                                    <a
                                                        href={n.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline mb-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        Otwórz <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => deleteNotification(n.id, e)}
                                            className="absolute top-1 right-1 p-1.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                                            title="Usuń powiadomienie"
                                        >
                                            <Trash2 size={12} />
                                        </button>

                                        {!n.is_read && (
                                            <div className="absolute bottom-3 right-3 w-2 h-2 bg-blue-500 rounded-full"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
