"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, X } from 'lucide-react';

type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  unread?: boolean;
  created_at?: string;
};

export default function NotificationBell() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;

    let mounted = true;
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/notifications');
        if (!res.ok) return;
        const data = await res.json();
        const nextItems = Array.isArray(data)
          ? data
          : Array.isArray(data?.notifications)
            ? data.notifications
            : [];
        if (mounted) setItems(nextItems);
      } catch (err) {
        // noop
      }
    }
    fetchNotifications();
    return () => {
      mounted = false;
    };
  }, [isLoaded, user?.id]);

  // Return placeholder during SSR to prevent hydration mismatch
  if (!mounted || !isLoaded || !user) {
    return (
      <div className={pathname === '/create' ? 'fixed top-4 right-[5.5rem] z-50' : 'relative'}>
        <div className="p-2 text-gray-300 flex items-center opacity-50">
          <Bell className="w-5 h-5" />
        </div>
      </div>
    );
  }

  const unreadCount = items.filter((i) => i.unread).length;

  const openSettings = () => router.push('/settings?tab=notifications');

  // Render floating bell on create page to sit near CreditBadge
  const isCreate = pathname === '/create';

  return (
    <div
      ref={ref}
      className={isCreate ? 'fixed top-4 right-[5.5rem] z-50' : 'relative'}
    >
      <button
        onClick={() => setOpen((s) => !s)}
        aria-label="Notifications"
        className="p-2 text-gray-300 hover:text-white transition-colors flex items-center"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] w-4 h-4">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-lg overflow-hidden"
          style={{ position: 'absolute', right: 0, top: '100%' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <div className="text-sm font-medium">Notifications</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setItems((s) => s.map((i) => ({ ...i, unread: false })))}
                className="text-xs text-gray-400 hover:text-white"
              >
                Mark all read
              </button>
              <button onClick={() => setOpen(false)} className="p-1">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto">
            {items.length === 0 && (
              <div className="p-4 text-sm text-gray-400">No notifications</div>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`px-3 py-2 hover:bg-gray-800 cursor-pointer ${n.unread ? 'bg-gray-800' : ''}`}
                onClick={() => {
                  // simple local mark-as-read
                  setItems((s) => s.map((it) => (it.id === n.id ? { ...it, unread: false } : it)));
                }}
              >
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-gray-400">{n.body}</div>}
              </div>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-gray-800">
            <button onClick={openSettings} className="w-full text-sm text-gray-300 hover:text-white">
              Open notification settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
