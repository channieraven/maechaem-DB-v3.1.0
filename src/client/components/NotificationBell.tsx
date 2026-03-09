/**
 * NotificationBell.tsx — Header notification centre.
 *
 * Polls GET /api/notifications?user_email=xxx to show unread badge.
 * Dropdown lists recent notifications with read/unread-all actions.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { Notification, ApiResponse } from "../../shared/types";

interface NotificationBellProps {
  userEmail: string;
}

export function NotificationBell({ userEmail }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const fetchNotifications = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch(`/api/notifications?user_email=${encodeURIComponent(userEmail)}`);
      const json: ApiResponse<Notification[]> = await res.json();
      if (json.ok) setNotifications(json.data);
    } catch {
      // silently ignore — non-critical
    }
  }, [userEmail]);

  // Initial fetch + polling every 60 s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch(`/api/notifications/read-all?user_email=${encodeURIComponent(userEmail)}`, {
        method: "PUT",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally {
      setLoading(false);
    }
  }

  async function markRead(notificationId: string) {
    try {
      await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: "PUT",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
      );
    } catch {
      // silently ignore
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
        aria-label="การแจ้งเตือน"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V5a1 1 0 10-2 0v.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">การแจ้งเตือน</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={loading}
                className="text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <span className="text-2xl mb-1">🔔</span>
                <p className="text-xs">ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.slice(0, 30).map((n) => (
                <button
                  key={n.notificationId}
                  type="button"
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${
                    !n.isRead ? "bg-green-50" : ""
                  }`}
                  onClick={() => markRead(n.notificationId)}
                >
                  <div className="flex gap-2 items-start">
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    )}
                    <div className={!n.isRead ? "" : "pl-3.5"}>
                      <p className="text-xs text-gray-800 leading-snug">
                        {n.message ?? "การแจ้งเตือนใหม่"}
                      </p>
                      <div className="flex gap-2 mt-0.5">
                        {n.authorName && (
                          <span className="text-[10px] text-gray-400">{n.authorName}</span>
                        )}
                        {n.plotCode && (
                          <span className="text-[10px] text-green-600">{n.plotCode}</span>
                        )}
                        <span className="text-[10px] text-gray-300">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "เมื่อกี้";
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hrs / 24);
    return `${days} วันที่แล้ว`;
  } catch {
    return "";
  }
}

export default NotificationBell;
