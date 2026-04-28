import { ChangeEvent, FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, X } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { PasswordInput } from '../components/PasswordInput';
import { getApiErrorMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { MAX_AVATAR_LABEL, readAvatarFile } from '../utils/avatarUpload';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setAvatar(await readAvatarFile(file));
      setAvatarError('');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not read that image.');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, avatar || undefined);
      navigate('/');
    } catch (error) {
      const message = getApiErrorMessage(error, 'Could not create that account. Try again.');
      setError(message === 'Email is already registered' ? 'Email is already registered. Sign in instead.' : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <Avatar user={{ name: name || 'New user', avatar, isOnline: true }} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Profile image</p>
              <p className="mt-1 text-xs text-muted">Optional, up to {MAX_AVATAR_LABEL}.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                  <Upload size={16} />
                  Upload
                  <input accept="image/*" className="hidden" type="file" onChange={onAvatarFile} />
                </label>
                {avatar && (
                  <Button
                    type="button"
                    variant="soft"
                    className="h-9 rounded-xl px-3"
                    onClick={() => {
                      setAvatar('');
                      setAvatarError('');
                    }}
                    icon={<X size={16} />}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
          {avatarError && <p className="mt-3 text-sm text-red-600">{avatarError}</p>}
        </div>
        <Input label="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordInput
          label="Password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create account'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link className="font-medium text-brand hover:text-blue-700" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
