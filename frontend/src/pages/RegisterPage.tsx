import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuthStore } from '../store/authStore';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await register(name, email, password);
      navigate('/');
    } catch {
      setError('Could not create that account. Try a different email.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input label="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input
          label="Password"
          type="password"
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
