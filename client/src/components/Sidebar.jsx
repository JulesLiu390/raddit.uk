import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsPerson, BsFire, BsArrowRepeat } from 'react-icons/bs';
import { getHotPosts } from '../api';
import './Sidebar.css';

function Sidebar({ user }) {
  const navigate = useNavigate();
  const [hotPosts, setHotPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHotPosts();
  }, []);

  const fetchHotPosts = async () => {
    try {
      const data = await getHotPosts();
      setHotPosts(data);
    } catch (err) {
      console.error('Failed to fetch hot posts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="sidebar">
      {/* 用户卡片 - 个人中心 */}
      <div className="sidebar-card user-card">
        <div className="card-header">
          <span className="card-icon"><BsPerson /></span>
          <h3>个人中心</h3>
        </div>
        <div className="user-card-content">
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <img 
                  src={user.picture} 
                  alt={user.name} 
                  style={{ width: '40px', height: '40px', borderRadius: '4px' }} 
                />
                <div>
                  <div style={{ fontWeight: 'bold' }}>{user.name}</div>
                  <div style={{ fontSize: '12px', color: '#8590a6' }}>查看个人主页</div>
                </div>
              </div>
              <button className="sidebar-create-btn" onClick={() => navigate('/profile')}>
                进入个人中心
              </button>
            </>
          ) : (
            <>
              <p className="user-card-title">登录 Raddit</p>
              <p className="user-card-desc">体验更多功能，与世界分享你的观点</p>
              <button className="sidebar-create-btn" onClick={() => navigate('/login')}>
                登录 / 注册
              </button>
            </>
          )}
        </div>
      </div>

      {/* 热门话题 */}
      <div className="sidebar-card">
        <div className="card-header">
          <span className="card-icon"><BsFire /></span>
          <h3>魅力时刻</h3>
          <button className="refresh-btn" onClick={fetchHotPosts}><BsArrowRepeat /> 刷新</button>
        </div>
        <ul className="hot-list">
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>加载中...</div>
          ) : hotPosts.length > 0 ? (
            hotPosts.map((post, index) => (
              <li 
                key={post.id} 
                className="hot-item"
                onClick={() => navigate(`/post/${post.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <span className={`hot-rank rank-${index + 1}`}>•</span>
                <span className="hot-title">
                  {post.title}
                  {post.heat > 10 && <span className="hot-badge">热</span>}
                </span>
                <span className="hot-heat">{post.heat}</span>
              </li>
            ))
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>暂无热门内容</div>
          )}
        </ul>
      </div>

      {/* 页脚信息 */}
      <div className="sidebar-footer">
        <p>© 2025 Raddit.uk</p>
        <p>使用 React + Node.js 构建</p>
      </div>
    </aside>
  );
}

export default Sidebar;
