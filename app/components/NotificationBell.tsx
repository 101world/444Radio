"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Bell, X, Check, XCircle, Loader2, Swords } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────
interface Notification {
  id: string;
  title: string;
  body?: string;
  unread: boolean;
  created_at?: string;
  type?: string;
  data?: Record<string, any>;
}

type ActionState = { status: 'loading' | 'done' | 'error'; action?: string; msg?: string };

// ─── Component ──────────────────────────────────────────────
export default function NotificationBell() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [ready, setReady] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch notifications ──
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) { console.warn('[bell] fetch failed', res.status); return; }
      const json = await res.json();
      const list: Notification[] = (json?.notifications ?? json ?? []).map((n: any) => ({
        id: n.id ?? crypto.randomUUID(),
        title: n.title ?? 'Notification',
        body: n.body ?? n.message ?? undefined,
        unread: typeof n.unread === 'boolean' ? n.unread : true,
        created_at: n.created_at,
        type: n.type,
        data: n.data ?? n.metadata ?? undefined,
      }));
      setItems(list);
    } catch (err) {
      console.error('[bell] fetch error', err);
    }
  }, []);

  // ── Mount + hydration guard ──
  useEffect(() => { setReady(true); }, []);

  // ── Fetch on load and periodically ──
  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000); // poll every 30s
    return () => clearInterval(interval);
  }, [isLoaded, user?.id, fetchNotifications]);

  // ── Click outside to close ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && e.target instanceof Node && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Chess accept / decline ──
  const handleChessAction = async (notif: Notification, action: 'accept' | 'decline') => {
    const gameId = notif.data?.gameId;
    if (!gameId) return;

    setActionStates(prev => ({ ...prev, [notif.id]: { status: 'loading', action } }));

    try {
      const res = await fetch('/api/chess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, gameId }),
      });
      const result = await res.json();

      if (res.ok) {
        setActionStates(prev => ({
          ...prev,
          [notif.id]: { status: 'done', action, msg: action === 'accept' ? 'Accepted!' : 'Declined.' },
        }));
        // Mark as read locally
        setItems(prev => prev.map(it => it.id === notif.id ? { ...it, unread: false } : it));

        // If accepted, navigate to chess game after a brief moment
        if (action === 'accept') {
          setTimeout(() => {
            setOpen(false);
            router.push(`/assistant?chess=${gameId}`);
          }, 600);
        }
      } else {
        setActionStates(prev => ({
          ...prev,
          [notif.id]: { status: 'error', msg: result.error || 'Failed' },
        }));
      }
    } catch {
      setActionStates(prev => ({
        ...prev,
        [notif.id]: { status: 'error', msg: 'Network error' },
      }));
    }
  };

  // ── Mark all read ──
  const markAllRead = () => setItems(prev => prev.map(it => ({ ...it, unread: false })));

  // ── SSR placeholder ──
  if (!ready || !isLoaded || !user) {
    return (
      <div className="relative">
        <div className="p-2 text-gray-400">
          <Bell className="w-5 h-5" />
        </div>
      </div>
    );
  }

  const unreadCount = items.filter(i => i.unread).length;

  return (
    <div ref={panelRef} className="relative">
      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label="Notifications"
        className="p-2 text-gray-300 hover:text-white transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-gray-950 border border-white/10 rounded-xl shadow-2xl shadow-black/80 overflow-hidden z-[200]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/50">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-gray-500 hover:text-white transition-colors">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/5 rounded">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.03]">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-600">No notifications yet</p>
              </div>
            )}

            {items.map(n => {
              const isChessChallenge = n.type === 'chess_challenge';
              const isChessAccepted = n.type === 'chess_accepted' && n.data?.gameId;
              const state = actionStates[n.id];
              const resolved = state?.status === 'done';

              return (
                <div
                  key={n.id}
                  className={`px-4 py-3 transition-colors ${n.unread ? 'bg-cyan-500/[0.03]' : ''} hover:bg-white/[0.02]`}
                  onClick={() => {
                    if (!isChessChallenge && !isChessAccepted) {
                      setItems(prev => prev.map(it => it.id === n.id ? { ...it, unread: false } : it));
                    }
                  }}
                >
                  {/* Title + body */}
                  <p className={`text-sm font-medium ${n.unread ? 'text-white' : 'text-gray-400'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>}

                  {/* Chess challenge → Accept/Decline */}
                  {isChessChallenge && !resolved && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        disabled={state?.status === 'loading'}
                        onClick={(e) => { e.stopPropagation(); handleChessAction(n, 'accept'); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white transition-all"
                      >
                        {state?.status === 'loading' && state.action === 'accept'
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Check className="w-3 h-3" />
                        }
                        Accept
                      </button>
                      <button
                        disabled={state?.status === 'loading'}
                        onClick={(e) => { e.stopPropagation(); handleChessAction(n, 'decline'); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 disabled:opacity-40 text-xs font-semibold text-gray-400 hover:text-red-300 transition-all"
                      >
                        {state?.status === 'loading' && state.action === 'decline'
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <XCircle className="w-3 h-3" />
                        }
                        Decline
                      </button>
                      {n.data?.wager != null && n.data.wager > 0 && (
                        <span className="text-[10px] text-amber-400 ml-auto">{n.data?.wager} credits</span>
                      )}
                    </div>
                  )}

                  {/* Resolved state */}
                  {isChessChallenge && resolved && (
                    <div className={`mt-2 text-xs font-medium flex items-center gap-1.5 ${state.action === 'accept' ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {state.action === 'accept' ? <Swords className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {state.msg}
                      {state.action === 'accept' && (
                        <span className="text-[10px] text-emerald-500/60 ml-1">Joining game...</span>
                      )}
                    </div>
                  )}

                  {/* Chess accepted → Join Game button (for the challenger) */}
                  {isChessAccepted && n.unread && (
                    <div className="mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setItems(prev => prev.map(it => it.id === n.id ? { ...it, unread: false } : it));
                          setOpen(false);
                          router.push(`/assistant?chess=${n.data!.gameId}`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-all"
                      >
                        <Swords className="w-3 h-3" />
                        Join Game
                      </button>
                    </div>
                  )}

                  {/* Error state */}
                  {state?.status === 'error' && (
                    <p className="mt-1.5 text-[10px] text-red-400">{state.msg}</p>
                  )}

                  {/* Timestamp */}
                  {n.created_at && (
                    <p className="text-[10px] text-gray-700 mt-1.5">
                      {formatTime(n.created_at)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Time formatter ──────────────────────────────────────────
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}
