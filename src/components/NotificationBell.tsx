import {Bell, CheckCheck} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {apiFetch} from '../lib/apiClient';

export interface NotificationItem {
  id: string;
  recipientRole: 'admin' | 'customer';
  projectId: string | null;
  projectReferenceId: string | null;
  type: string;
  title: string;
  message: string;
  linkPath: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell({
  mode = 'customer',
  onSelectNotification,
}: {
  mode?: 'customer' | 'admin';
  onSelectNotification?: (notification: NotificationItem) => void;
}) {
  const {user, isAdmin} = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAdminMode = mode === 'admin' && isAdmin;
  const baseEndpoint = isAdminMode ? '/api/admin/notifications' : '/api/notifications';

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    if (mode === 'admin' && !isAdmin) return;
    try {
      const res = await apiFetch(baseEndpoint);
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: NotificationItem[];
        unreadCount?: number;
      };
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      // Non-blocking background sync
    }
  }, [user, mode, isAdmin, baseEndpoint]);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    }, 25000);
    function onFocus() {
      void loadNotifications();
    }
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (!user) return null;

  async function handleClickNotification(item: NotificationItem) {
    if (!item.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? {...n, read: true} : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await apiFetch(`${baseEndpoint}/${encodeURIComponent(item.id)}/read`, {
          method: 'POST',
        });
      } catch {
        // Ignore network transient error
      }
    }
    setOpen(false);
    if (onSelectNotification) {
      onSelectNotification(item);
    } else if (item.linkPath) {
      navigate(item.linkPath);
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({...n, read: true})));
    setUnreadCount(0);
    try {
      await apiFetch(`${baseEndpoint}/read-all`, {method: 'POST'});
    } catch {
      // Ignore network transient error
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void loadNotifications();
          }
        }}
        aria-expanded={open}
        aria-label={isAdminMode ? 'Administrator notifications' : 'Project notifications'}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E4E4E7] bg-white text-[#141416] transition-colors hover:border-[#141416]"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#1D4ED8] px-1 font-mono text-[10px] font-semibold text-white tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={isAdminMode ? 'Administrator alerts' : 'Customer notifications'}
          className="vtx-panel-enter absolute right-0 z-50 mt-2 w-80 rounded-lg border border-[#E4E4E7] bg-white shadow-lg sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-[#E4E4E7] px-4 py-3">
            <p className="font-display text-xs font-semibold text-[#141416]">
              {isAdminMode ? 'Admin Notifications' : 'Project Notifications'}
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 divide-y divide-[#E4E4E7] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#5A5A62]">
                No notifications yet.
              </p>
            ) : (
              notifications.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleClickNotification(item)}
                  className={`block w-full px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA] ${
                    item.read ? 'bg-white' : 'bg-[#1D4ED8]/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-xs ${
                        item.read ? 'font-medium text-[#141416]' : 'font-semibold text-[#141416]'
                      }`}
                    >
                      {item.title}
                    </p>
                    {!item.read && (
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1D4ED8]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#5A5A62]">
                    {item.message}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-[#5A5A62]">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
