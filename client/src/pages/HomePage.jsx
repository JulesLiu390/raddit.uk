import { useState, useEffect } from 'react';
import { BsExclamationTriangle, BsInbox } from 'react-icons/bs';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { getPosts, createPost as apiCreatePost, getUserFollowing } from '../api';
import './HomePage.css';

function HomePage({ user, onLogout, type = 'all' }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.title = type === 'following' ? '我关注的问题 - Raddit' : 'Raddit主页';
  }, [type]);

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
      let data;
      if (type === 'following') {
        if (!user) {
          setPosts([]);
          setLoading(false);
          return;
        }
        data = await getUserFollowing(user.id);
      } else {
        data = await getPosts();
      }
      
      // 为没有缩略图的帖子提取第一张图片
      const postsWithThumbnails = data.map(post => {
        if (!post.thumbnail && post.content) {
          const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/;
          const match = post.content.match(imgRegex);
          if (match && match[1]) {
            return { ...post, thumbnail: match[1] };
          }
        }
        return post;
      });
      
      setPosts(postsWithThumbnails);
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
  }, [type, user]); // Re-fetch when type or user changes

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
          <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} />

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
                  <p>{type === 'following' ? '还没有关注的问题' : '还没有帖子，来发布第一篇吧！'}</p>
                  {type !== 'following' && <button onClick={() => setShowCreateModal(true)}>发布帖子</button>}
                </div>
              )}

              {!loading && !error && posts.map((post, index) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  rank={index + 1}
                  isNew={index < 2}
                  user={user}
                  onDelete={(id) => setPosts(posts.filter(p => p.id !== id))}
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
