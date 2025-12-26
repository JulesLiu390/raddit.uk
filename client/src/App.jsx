import { Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PostDetailPage from './pages/PostDetailPage';
import ProfilePage from './pages/ProfilePage';
import { loginWithGoogle } from './api';
import './App.css';

const USER_STORAGE_KEY = 'raddit-user';
const TOKEN_STORAGE_KEY = 'raddit-token';

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || null;
    } catch (err) {
      console.warn('Failed to parse stored user', err);
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleGoogleCredential = useCallback(async (credential) => {
    if (!credential) {
      setAuthError('没有获取到 Google 凭证');
      return;
    }

    setAuthLoading(true);
    try {
      const data = await loginWithGoogle(credential);
      setUser(data.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      if (data.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
      setAuthError('');
      navigate('/');
    } catch (err) {
      console.error('Google 登录失败', err);
      setAuthError(err.response?.data?.message || '登录失败，请重试');
    } finally {
      setAuthLoading(false);
    }
  }, [navigate]);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  return (
    <div className="app">
      <Routes>
        <Route 
          path="/" 
          element={<HomePage user={user} onLogout={handleLogout} />} 
        />
        <Route path="/login" element={
            <LoginPage 
              onGoogleCredential={handleGoogleCredential} 
              isAuthenticating={authLoading}
              authError={authError}
            />
          } />
        <Route path="/post/:id" element={<PostDetailPage user={user} onLogout={handleLogout} />} />
        <Route path="/profile" element={<ProfilePage user={user} onLogout={handleLogout} />} />
        <Route path="/profile/:id" element={<ProfilePage user={user} onLogout={handleLogout} />} />
      </Routes>
    </div>
  );
}

export default App;
