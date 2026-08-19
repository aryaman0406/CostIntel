import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const Auth = ({ setAuthParams }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = isLogin ? { email, password } : { email, password, full_name: fullName };
    const endpoint = isLogin ? `${API_BASE}/login` : `${API_BASE}/register`;

    const makeRequest = () => axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    try {
      let res;
      try {
        res = await makeRequest();
      } catch (firstErr) {
        // If initial connection timed out or hit network glitch, retry once silently
        if (firstErr.code === 'ECONNABORTED' || !firstErr.response) {
          await new Promise(r => setTimeout(r, 500));
          res = await makeRequest();
        } else {
          throw firstErr;
        }
      }

      if (res.data.status === 'success') {
        if (isLogin) {
          localStorage.setItem('access_token', res.data.data.access_token);
          setAuthParams(res.data.data.access_token);
          navigate('/features');
        } else {
          setIsLogin(true);
          setError('Registration successful! Please sign in.');
          setEmail('');
          setPassword('');
          setFullName('');
        }
      } else {
        const serverMessage = res.data.message || 'An unknown error occurred.';
        if (res.data.errors && typeof res.data.errors === 'object') {
          const fieldMsgs = Object.entries(res.data.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ');
          setError(`${serverMessage} ${fieldMsgs}`);
        } else {
          setError(serverMessage);
        }
      }
    } catch (err) {
      let msg = 'A network error occurred. Please check your connection.';
      if (err.code === 'ECONNABORTED') {
        msg = 'Connection timed out. Please try again.';
      } else if (err.response) {
        const data = err.response.data || {};
        const serverMessage = data.message || `Server error: ${err.response.status}`;
        if (data.errors && typeof data.errors === 'object') {
          const fieldMsgs = Object.entries(data.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ');
          msg = `${serverMessage} ${fieldMsgs}`;
        } else {
          msg = serverMessage;
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-logo">CostIntel</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Welcome back! Sign in to your dashboard.' : 'Create an account to get started.'}
        </p>

        {error && (
          <div className={`auth-alert ${error.includes('successful') ? 'success' : 'error'}`}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <UserPlus size={18} className="input-icon" />
              <input
                type="text"
                required
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
              />
            </div>
          )}
          <div className="input-group">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </div>

          <button type="submit" className="btn btn-primary auth-button" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Register</>)}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Register here' : 'Sign in here'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
