import { useState, useEffect } from 'react';
import { BsExclamationTriangle, BsInbox } from 'react-icons/bs';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { getPosts, createPost as apiCreatePost } from '../api';
import './HomePage.css';

function HomePage({ user, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'Raddit主页';
  }, []);

  const handleCreatePost = async (postData) => {
    try {
      const newPost = await apiCreatePost(postData);
      setPosts([newPost, ...posts]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('创建帖子失败:', err);
      setError('发布失败，请检查后端连接');
    }
  };

  const handleSearch = (query) => {
    console.log('搜索:', query);
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await getPosts();
      setPosts(data);
      setError(null);
    } catch (err) {
      console.error('获取后端数据失败:', err);
      setError('获取帖子失败，请确保后端服务已启动');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <div className={`home-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header 
        onSearch={handleSearch} 
        onCreatePost={() => setShowCreateModal(true)} 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        user={user}
        onLogout={onLogout}
      />

      <main className="main-container">
        <div className="content-wrapper">
          {/* 左侧导航 */}
          <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

          {/* 主内容区 */}
          <div className="main-content">
            {/* 帖子列表 */}
            <div className="post-list">
              {/* 列表头部提示 */}
              <div className="list-header">
                <span className="list-header-tag">关注</span>
                <span className="list-header-text">Raddit 12 月网络侵权举报受理处置情况</span>
              </div>

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
                  <button onClick={fetchPosts}>重试</button>
                </div>
              )}

              {!loading && !error && posts.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon"><BsInbox /></span>
                  <p>还没有帖子，来发布第一篇吧！</p>
                  <button onClick={() => setShowCreateModal(true)}>发布帖子</button>
                </div>
              )}

              {!loading && !error && posts.map((post, index) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  rank={index + 1}
                  isNew={index < 2}
                />
              ))}
            </div>
          </div>

          {/* 右侧边栏 */}
          <Sidebar user={user} />
        </div>
      </main>

      {/* 创建帖子弹窗 */}
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

export default HomePage;
