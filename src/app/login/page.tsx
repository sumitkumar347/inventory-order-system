'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '../actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.success) {
      if (result.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/');
      }
      router.refresh();
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2.25rem', 
            marginBottom: '0.25rem', 
            background: 'var(--accent-gradient)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            fontWeight: 800
          }}>
            QUANTIV
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Inventory & Order Management</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#f87171',
            padding: '0.75rem',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="e.g. admin@inventory.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '0.5rem', width: '100%' }}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--glass-border)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <p style={{ 
            fontWeight: '700', 
            marginBottom: '0.5rem', 
            textTransform: 'uppercase', 
            fontSize: '0.75rem', 
            letterSpacing: '0.05em',
            color: 'var(--text-primary)'
          }}>
            Demo Access Credentials
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <span style={{ color: 'var(--text-accent)', fontWeight: '600' }}>Admin:</span> admin@inventory.com / admin123
            </div>
            <div>
              <span style={{ color: 'var(--text-accent)', fontWeight: '600' }}>Seller:</span> seller@inventory.com / seller123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
