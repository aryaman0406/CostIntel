import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import './index.css';

const API_BASE = '/api';

const Auth = ({ setAuthParams }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? `${API_BASE}/login` : `${API_BASE}/register`;
      const res = await axios.post(endpoint, { email, password }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000 // Increased timeout
      });
      
      if (res.data.status === 'success') {
        if (isLogin) {
          localStorage.setItem('access_token', res.data.access_token);
          setAuthParams(res.data.access_token);
          navigate('/features');
        } else {
          setIsLogin(true);
          setError('Registration successful! Please sign in.');
        }
      } else {
        // Handle cases where the server returns a success status code but a logical error
        setError(res.data.message || 'An unknown error occurred.');
      }
    } catch (err) {
      let msg = 'A network error occurred. Please check your connection and try again.';
      if (err.code === 'ECONNABORTED') {
        msg = 'The request timed out. The server may be busy or offline.';
      } else if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        msg = err.response.data.message || `Server error: ${err.response.status}`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 100%)' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 800 }}>
          CostIntel AI
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          {isLogin ? 'Welcome back! Sign in to continue.' : 'Create an account to get started.'}
        </p>

        {error && (
          <div style={{ padding: '0.75rem', background: error.includes('successful') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: error.includes('successful') ? 'var(--success)' : 'var(--danger)', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', textAlign: 'left' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}
          >
            {loading ? 'Processing...' : (isLogin ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Register</>)}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }}
          >
            {isLogin ? 'Register here' : 'Sign in here'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
