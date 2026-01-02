import { Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PostDetailPage from './pages/PostDetailPage';
import ProfilePage from './pages/ProfilePage';
import TopicDetailPage from './pages/TopicDetailPage';
import TopicsPage from './pages/TopicsPage';
import DiscoveryPage from './pages/DiscoveryPage';
import FollowingUsersPage from './pages/FollowingUsersPage';
import TermsPage from './pages/TermsPage';
import FavoritesPage from './pages/FavoritesPage';
import InteractionsPage from './pages/InteractionsPage';
import NotFoundPage from './pages/NotFoundPage';
import CreatePostModal from './components/CreatePostModal';
import UserSetupModal from './components/UserSetupModal';
import TermsModal from './components/TermsModal';
import { loginWithGoogle, createPost } from './api';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
      
      if (data.isNewUser) {
        // New user flow: Terms -> User Setup
        setShowTermsModal(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Google 登录失败', err);
      setAuthError(err.response?.data?.message || '登录失败，请重试');
      
      // 如果登录失败（例如用户不存在），清除本地状态以防止死循环
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [navigate]);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  const handleCreatePost = async (postData) => {
    try {
      const newPost = await createPost(postData);
      setShowCreateModal(false);
      // Navigate to the new post or refresh the current page if it's the home page
      // For simplicity and better UX, let's navigate to the new post
      navigate(`/post/${newPost.id}`);
    } catch (err) {
      console.error('创建帖子失败:', err);
      alert('发布失败，请检查后端连接');
    }
  };

  const openCreateModal = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="app">
      <Routes>
        <Route 
          path="/" 
          element={<HomePage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} type="recommend" />} 
        />
        <Route 
          path="/hot" 
          element={<HomePage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} type="all" />} 
        />
        <Route 
          path="/following" 
          element={<HomePage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} type="following" />} 
        />
        <Route 
          path="/following-users" 
          element={<FollowingUsersPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} 
        />
        <Route 
          path="/terms" 
          element={<TermsPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} 
        />
        <Route path="/login" element={
            <LoginPage 
              onGoogleCredential={handleGoogleCredential} 
              isAuthenticating={authLoading}
              authError={authError}
            />
          } />
        <Route path="/post/:id" element={<PostDetailPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
        <Route path="/profile" element={<ProfilePage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
        <Route path="/profile/:id" element={<ProfilePage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
        <Route path="/notifications" element={<InteractionsPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
        <Route path="/topics" element={<TopicsPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
        <Route path="/discovery" element={<DiscoveryPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
        <Route path="/topic/:id" element={<TopicDetailPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
        <Route path="*" element={<NotFoundPage user={user} onLogout={handleLogout} onCreatePost={openCreateModal} />} />
      </Routes>

      {showCreateModal && (
        <CreatePostModal 
          user={user}
          onClose={() => setShowCreateModal(false)} 
          onSubmit={handleCreatePost} 
        />
      )}

      {showTermsModal && (
        <TermsModal
          onAgree={() => {
            setShowTermsModal(false);
            setShowUserSetupModal(true);
          }}
          onClose={() => {
            setShowTermsModal(false);
            handleLogout(); // Logout if terms are declined
          }}
        />
      )}

      {showUserSetupModal && (
        <UserSetupModal 
          user={user}
          onBack={() => {
            setShowUserSetupModal(false);
            setShowTermsModal(true);
          }}
          onComplete={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
            setShowUserSetupModal(false);
            navigate('/');
          }} 
        />
      )}
    </div>
  );
}

export default App;
