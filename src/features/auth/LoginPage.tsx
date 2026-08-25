import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './authStore';
import { DEMO_USERS } from './demoUsers';
import logoBlack from '../../assets/wozku-logo-black.svg';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const failure = signIn(email, password);
    if (failure) {
      setError(failure);
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-[380px] flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <img src={logoBlack} alt="Wozku Studio" className="h-8 w-auto self-start" />
          <h1
            className="text-[22px] font-bold text-neutral-900 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sign in to Studio
          </h1>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-neutral-500">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              autoFocus
              required
              className="h-10 px-3 bg-white border border-neutral-200 focus:border-neutral-900 rounded-[var(--radius-sharp)] text-[13px] text-neutral-900 outline-none transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-neutral-500">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              required
              className="h-10 px-3 bg-white border border-neutral-200 focus:border-neutral-900 rounded-[var(--radius-sharp)] text-[13px] text-neutral-900 outline-none transition-colors"
            />
          </label>

          {error && (
            <p role="alert" className="text-[12px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-[var(--radius-sharp)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="h-10 mt-1 text-[13px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-[var(--radius-sharp)] transition-colors cursor-pointer"
          >
            Sign in
          </button>
        </form>

        {/* No backend yet, so the accounts have to be written down somewhere. */}
        <div className="p-3.5 bg-white border border-neutral-200 rounded-[var(--radius-sharp)] flex flex-col gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-neutral-500">
            Demo accounts
          </span>
          <div className="flex flex-col gap-1.5">
            {DEMO_USERS.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { setEmail(u.email); setPassword(u.password); setError(null); }}
                className="flex items-center gap-2.5 text-left cursor-pointer group"
              >
                <span
                  className="w-6 h-6 shrink-0 flex items-center justify-center text-[10px] font-bold text-white rounded-[var(--radius-sharp)]"
                  style={{ background: u.color }}
                >
                  {u.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                </span>
                <span className="text-[12px] text-neutral-600 group-hover:text-neutral-900 transition-colors">
                  <span className="font-mono">{u.email}</span>
                  <span className="text-neutral-400"> / {u.password}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Sign in as different people in two tabs to try sharing and live editing.
          </p>
        </div>
      </div>
    </div>
  );
}
