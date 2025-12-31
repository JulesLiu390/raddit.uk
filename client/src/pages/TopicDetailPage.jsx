import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { getTopic, getTopicPosts, createPost as apiCreatePost, toggleFollowTopic, getUserFollowedTopics } from '../api';
import './TopicDetailPage.css';

function TopicDetailPage({ user, onLogout }) {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [topicData, postsData] = await Promise.all([
        getTopic(id),
        getTopicPosts(id)
      ]);
      setTopic(topicData);
      setPosts(postsData);
      document.title = `${topicData.name} - Raddit`;

      if (user) {
        const followedTopics = await getUserFollowedTopics(user.id);
        const isFollowed = followedTopics.some(t => t.id === id || t._id === id);
        setIsFollowing(isFollowed);
      }
    } catch (err) {
      console.error('Failed to fetch topic data:', err);
      setError('获取话题数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    setFollowLoading(true);
    try {
      const result = await toggleFollowTopic(id);
      setIsFollowing(result.isFollowing);
      setTopic(prev => ({
        ...prev,
        followers: result.followersCount
      }));
    } catch (err) {
      console.error('Follow topic failed:', err);
      alert('操作失败');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCreatePost = async (postData) => {
    try {
      // 强制关联当前话题
      const newPost = await apiCreatePost({
        ...postData,
        topics: [id] // 默认选中当前话题
      });
      setPosts([newPost, ...posts]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('创建帖子失败:', err);
      alert('发布失败，请检查后端连接');
    }
  };

  return (
    <div className={`topic-detail-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header 
        onCreatePost={() => setShowCreateModal(true)} 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        user={user}
        onLogout={onLogout}
      />

      <main className="main-container">
        <div className="content-wrapper">
          <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} />

          <div className="main-content">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>加载中...</p>
              </div>
            ) : error ? (
              <div className="error-state">{error}</div>
            ) : (
              <>
                {/* Topic Header */}
                <div className="topic-header-card">
                  <div className="topic-icon">{topic.icon}</div>
                  <div className="topic-info">
                    <h1>{topic.name}</h1>
                    <p>{topic.description || '暂无描述'}</p>
                    <div className="topic-stats">
                      <span>{topic.postCount} 帖子</span>
                      <span>{topic.followers?.length || topic.memberCount || 0} 成员</span>
                    </div>
                  </div>
                  <button 
                    className={`join-btn ${isFollowing ? 'joined' : ''}`} 
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    {isFollowing ? '已加入' : '加入话题'}
                  </button>
                </div>

                {/* Post List */}
                <div className="post-list">
                  {posts.length === 0 ? (
                    <div className="empty-state">
                      <p>该话题下暂无帖子</p>
                      <button onClick={() => setShowCreateModal(true)}>发布第一篇帖子</button>
                    </div>
                  ) : (
                    posts.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <Sidebar user={user} />
        </div>
      </main>

      {showCreateModal && (
        <CreatePostModal 
          onClose={() => setShowCreateModal(false)} 
          onSubmit={handleCreatePost}
          user={user}
          initialTopic={id} // Pass initial topic
        />
      )}
    </div>
  );
}

export default TopicDetailPage;
