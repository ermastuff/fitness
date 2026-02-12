import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const { setToken, token } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    unitKg: true,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'login') {
        return api.login({ email: form.email, password: form.password });
      }
      return api.register({
        email: form.email,
        password: form.password,
        name: form.name,
        unitKg: form.unitKg,
      });
    },
    onSuccess: (data) => {
      setToken(data.token);
    },
  });

  useEffect(() => {
    if (token) {
      navigate('/dashboard');
      return;
    }
    if (mutation.isSuccess) {
      navigate('/dashboard');
    }
  }, [mutation.isSuccess, navigate, token]);

  return (
    <div className="page auth-page">
      <section className="hero-card">
        <span className="pill">Fitness Forge</span>
        <h1>Forge your training plan.</h1>
        <p className="muted">
          Accesso rapido per creare mesocicli, gestire sessioni e monitorare
          progressioni.
        </p>
      </section>
      <section className="card auth-card">
        <div className="toggle-row">
          <button
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
            type="button"
          >
            Register
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {mode === 'register' ? (
            <label>
              Name
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Mario Rossi"
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="user@example.com"
            />
          </label>
          <label>
            Password
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Min 8 chars"
            />
          </label>
          {mode === 'register' ? (
            <label className="switch">
              <span>Unità in kg</span>
              <input
                type="checkbox"
                checked={form.unitKg}
                onChange={(event) => setForm({ ...form, unitKg: event.target.checked })}
              />
            </label>
          ) : null}
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Loading...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
          {mutation.isError ? (
            <p className="error-text">Errore: {(mutation.error as any).error ?? 'Request failed'}</p>
          ) : null}
        </form>
      </section>
    </div>
  );
};

export default AuthPage;
