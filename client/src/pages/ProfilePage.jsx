import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { getPosts, getUserReplies } from '../api';
import './ProfilePage.css';

function ProfilePage({ user, onLogout }) {
  const { id } = useParams(); // If viewing another user
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState([]);
  const [userReplies, setUserReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Determine which user profile to show
  // If id is present, show that user. If not, show current logged in user.
  // For this demo, we might just assume we are viewing the logged in user if no ID, 
  // or if ID matches.
  
  const isOwnProfile = !id || (user && user.id === id);
  const profileUser = isOwnProfile ? user : { name: 'Unknown User', id: id }; // Fallback

  useEffect(() => {
    document.title = `${profileUser?.name || 'User'} - 个人中心`;
    fetchData();
  }, [profileUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch posts
      const allPosts = await getPosts();
      // Filter posts by this user
      const myPosts = allPosts.filter(p => {
        if (profileUser?.id) return p.authorId === profileUser.id;
        return p.author === profileUser?.name;
      });
      setUserPosts(myPosts);

      // Fetch replies
      if (profileUser?.id) {
        const replies = await getUserReplies(profileUser.id);
        setUserReplies(replies);
      }
    } catch (err) {
      console.error('Failed to fetch profile data', err);
    } finally {
      setLoading(false);
    }
  };

  if (!profileUser && !loading) {
    return (
      <div className="profile-page">
        <Header user={user} onLogout={onLogout} />
        <div className="error-container">
          <p>请先登录</p>
          <button onClick={() => navigate('/login')}>去登录</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'posts', label: '主贴', count: userPosts.length },
    { key: 'replies', label: '回复', count: userReplies.length },
    { key: 'activities', label: '互动', count: 0 },
    { key: 'favorites', label: '收藏', count: 0 },
    { key: 'following', label: '关注', count: 0 },
  ];

  return (
    <div className="profile-page">
      <Header user={user} onLogout={onLogout} />
      
      <div className="profile-container">
        {/* Header Card */}
        <div className="profile-header-card">
          <div className="profile-cover">
            {isOwnProfile && (
              <button className="upload-cover-btn">
                📷 上传封面图片
              </button>
            )}
          </div>
          <div className="profile-info-wrapper">
            <div className="profile-avatar-container">
              <img 
                src={profileUser?.picture || `https://ui-avatars.com/api/?name=${profileUser?.name || 'User'}&background=random`} 
                alt="avatar" 
                className="profile-avatar" 
              />
            </div>
            <div className="profile-main-info">
              <h1 className="profile-name">
                {profileUser?.name || '匿名用户'}
              </h1>
              <div className="profile-bio">
                {profileUser?.bio || '暂无个人简介'}
              </div>
            </div>
            <div className="profile-actions">
              {isOwnProfile ? (
                <button className="edit-profile-btn">
                  编辑个人资料
                </button>
              ) : (
                <button className="edit-profile-btn">
                  关注
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="profile-content">
          {/* Main Content */}
          <div className="profile-main">
            <div className="profile-tabs">
              {tabs.map(tab => (
                <div 
                  key={tab.key} 
                  className={`profile-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  <span className="profile-tab-count">{tab.count}</span>
                </div>
              ))}
            </div>

            <div className="profile-list">
              {activeTab === 'posts' && (
                <>
                  {userPosts.length > 0 ? (
                    userPosts.map(post => (
                      <div key={post.id} className="profile-list-item">
                        <div className="item-title" onClick={() => navigate(`/post/${post.id}`)}>
                          {post.title}
                        </div>
                        <div className="item-content-preview">
                          {post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content}
                        </div>
                        <div className="item-meta">
                          <span>{new Date(post.createdAt).toLocaleString('zh-CN')}</span>
                          <span>{post.heat || 0} 热度</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">暂无发布的内容</div>
                  )}
                </>
              )}
              
              {activeTab === 'replies' && (
                <>
                  {userReplies.length > 0 ? (
                    userReplies.map(reply => (
                      <div key={reply.id} className="profile-list-item">
                        <div className="item-title" onClick={() => navigate(`/post/${reply.postId}`)}>
                          回复了帖子
                        </div>
                        <div className="item-content-preview">
                          {reply.content.length > 100 ? reply.content.substring(0, 100) + '...' : reply.content}
                        </div>
                        <div className="item-meta">
                          <span>{new Date(reply.createdAt).toLocaleString('zh-CN')}</span>
                          <span>{reply.upvotes || 0} 赞同</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">暂无回复内容</div>
                  )}
                </>
              )}
              
              {activeTab !== 'posts' && activeTab !== 'replies' && (
                <div className="empty-state">
                  暂无{tabs.find(t => t.key === activeTab)?.label}内容
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="profile-sidebar">
            <div className="profile-stat-card">
              <div className="stat-grid">
                <div className="stat-item">
                  <div className="stat-label">关注了</div>
                  <div className="stat-value">3</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">关注者</div>
                  <div className="stat-value">0</div>
                </div>
              </div>
            </div>
            
            <div className="profile-stat-card">
              <div className="stat-grid">
                <div className="stat-item">
                  <div className="stat-label">关注的话题</div>
                  <div className="stat-value">12</div>
                </div>
              </div>
            </div>
            
            <div className="sidebar-footer">
              <p>© 2025 Raddit.uk</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
