import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsExclamationTriangle, BsInbox, BsPersonCheck } from 'react-icons/bs';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import CreatePostModal from '../components/CreatePostModal';
import { getUserFollowingUsers, createPost as apiCreatePost } from '../api';
import './HomePage.css';
import './FollowingUsersPage.css';

function FollowingUsersPage({ user, onLogout, onCreatePost }) {
  const navigate = useNavigate();
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.title = '我关注的用户 - Raddit';
    fetchFollowingUsers();
  }, [user]);

  const fetchFollowingUsers = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getUserFollowingUsers(user.id);
      setFollowingUsers(data);
      setError(null);
    } catch (err) {
      console.error('获取关注用户失败:', err);
      setError('获取关注用户失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (postData) => {
    try {
      await apiCreatePost(postData);
      setShowCreateModal(false);
      navigate('/'); // Redirect to home after posting
    } catch (err) {
      console.error('创建帖子失败:', err);
      alert('发布失败，请检查后端连接');
    }
  };

  const handleSearch = (query) => {
    console.log('搜索:', query);
  };

  return (
    <div className={`following-users-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        user={user}
        onLogout={onLogout}
        onCreatePost={onCreatePost}
      />
      <main className="main-container">
        <div className="content-wrapper">
          <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} />

          <div className="main-content">
            <div className="post-list">
              {loading && (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>加载中...</p>
                </div>
              )}

              {error && (
                <div className="error-state">
                  <span className="error-icon"><BsExclamationTriangle /></span>
                  <p>{error}</p>
                  <button onClick={fetchFollowingUsers}>重试</button>
                </div>
              )}

              {!loading && !error && followingUsers.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon"><BsPersonCheck /></span>
                  <p>还没有关注任何用户</p>
                  <button onClick={() => navigate('/discovery')}>去发现有趣的人</button>
                </div>
              )}

              {!loading && !error && followingUsers.length > 0 && (
                <div className="following-users-grid">
                  {followingUsers.map(u => (
                    <div key={u.id} className="user-card" onClick={() => navigate(`/profile/${u.id}`)}>
                      <div className="user-card-header">
                        <img 
                          src={u.picture || `https://ui-avatars.com/api/?name=${u.name}&background=random`} 
                          alt={u.name} 
                          className="user-card-avatar"
                        />
                      </div>
                      <div className="user-card-body">
                        <h3 className="user-card-name">{u.name}</h3>
                        <p className="user-card-bio">{u.bio || '暂无简介'}</p>
                      </div>
                      <div className="user-card-footer">
                        <button className="view-profile-btn">查看主页</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Sidebar user={user} />
        </div>
      </main>

      {showCreateModal && (
        <CreatePostModal 
          user={user}
          onClose={() => setShowCreateModal(false)} 
          onSubmit={handleCreatePost} 
        />
      )}
    </div>
  );
}

export default FollowingUsersPage;
