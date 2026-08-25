import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon } from '../ui/icons';
import { useAuth } from '../auth/authStore';
import { initialsOf } from '../auth/demoUsers';

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;
  const initials = initialsOf(user.name);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* ── Profile Trigger Button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Signed in as ${user.name}`}
        className="flex items-center gap-2 h-[34px] px-2 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-none transition-colors cursor-pointer outline-none focus:border-neutral-900"
      >
        <span
          className="w-6 h-6 rounded-none flex items-center justify-center text-[10.5px] font-mono font-bold text-white select-none shrink-0"
          style={{ backgroundColor: user.color }}
        >
          {initials}
        </span>
        <span className="hidden md:inline-block text-[12px] font-bold text-neutral-800 max-w-[110px] truncate">
          {user.name}
        </span>
      </button>

      {/* ── Dedicated User Profile Dropdown ── */}
      {open && (
        <div
          style={{
            width: 260,
            borderRadius: 0,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          className="absolute right-0 top-full mt-2 bg-white border border-neutral-200 rounded-none overflow-hidden z-[250] animate-in fade-in duration-100"
        >
          {/* User Details Header */}
          <div className="p-4 border-b border-neutral-200 bg-neutral-50/80 flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-9 h-9 rounded-none flex items-center justify-center text-[12px] font-mono font-bold text-white shadow-xs select-none shrink-0"
                style={{ backgroundColor: user.color }}
              >
                {initials}
              </span>
              <div className="min-w-0">
                <h4 className="text-[13.5px] font-bold text-neutral-900 leading-tight truncate">
                  {user.name}
                </h4>
                <p className="text-[11.5px] font-mono text-neutral-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close profile menu"
              className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer shrink-0"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          {/* Footer with Sign Out */}
          <div className="p-3 bg-white">
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate('/login', { replace: true });
              }}
              className="w-full h-8 text-[12px] font-bold text-neutral-700 hover:text-rose-600 bg-neutral-50 hover:bg-rose-50 border border-neutral-200 hover:border-rose-200 rounded-none transition-colors cursor-pointer text-center"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
