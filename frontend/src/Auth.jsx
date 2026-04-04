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
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = isLogin ? { email, password } : { email, password, full_name: fullName };

      const endpoints = isLogin
        ? [`${API_BASE}/auth/login`, `${API_BASE}/login`]
        : [`${API_BASE}/auth/register`, `${API_BASE}/register`];

      let res = null;
      let lastErr = null;
      for (const endpoint of endpoints) {
        try {
          res = await axios.post(endpoint, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
          });
          break;
        } catch (endpointErr) {
          lastErr = endpointErr;
          if (endpointErr?.response?.status !== 404) {
            throw endpointErr;
          }
        }
      }

      if (!res) {
        throw lastErr || new Error('Authentication service unavailable');
      }
      
      if (res.data.status === 'success') {
        if (isLogin) {
          localStorage.setItem('access_token', res.data.data.access_token);
          setAuthParams(res.data.data.access_token);
          navigate('/features');
        } else {
          setIsLogin(true);
          setError('Registration successful! Please sign in.');
          // Clear fields after registration
          setEmail('');
          setPassword('');
          setFullName('');
        }
      } else {
        setError(res.data.message || 'An unknown error occurred.');
      }
    } catch (err) {
      let msg = 'A network error occurred. Please check your connection.';
      if (err.code === 'ECONNABORTED') {
        msg = 'Request timed out. The server may be busy.';
      } else if (err.response) {
        msg = err.response.data.message || `Server error: ${err.response.status}`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-logo">CostIntel AI</h1>
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
