import { useNavigate } from 'react-router-dom';
import { BsPerson, BsFire, BsArrowRepeat } from 'react-icons/bs';
import './Sidebar.css';

function Sidebar({ user, hotPosts }) {
  const navigate = useNavigate();
  // 默认数据
  const defaultHotPosts = hotPosts || [
    { id: 1, title: '全球首款2nm手机芯片诞生', heat: '514万', isHot: true },
    { id: 2, title: '美国斩杀线是什么', heat: '362万', isHot: true },
    { id: 3, title: '朱孝天举报五月天公司逃税', heat: '362万', isHot: true },
    { id: 4, title: '山东莱州发现亚洲最大海上金矿', heat: '353万' },
    { id: 5, title: 'Raddit 摸鱼报告', heat: '348万' },
    { id: 6, title: '强生爽身粉致癌案被判赔偿', heat: '343万', isHot: true },
    { id: 7, title: '小学火灾案班主任量刑依据', heat: '322万' },
    { id: 8, title: '京东年终奖投入涨幅超 70%', heat: '275万' },
    { id: 9, title: '为何从领导岗退休下来的人很快就老了', heat: '270万' },
    { id: 10, title: '爱泼斯坦案特朗普敏感照片曝光', heat: '266万' },
  ];

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
          <h3>大家都在搜</h3>
          <button className="refresh-btn"><BsArrowRepeat /> 换一换</button>
        </div>
        <ul className="hot-list">
          {defaultHotPosts.map((post, index) => (
            <li key={post.id} className="hot-item">
              <span className={`hot-rank rank-${index + 1}`}>•</span>
              <span className="hot-title">
                {post.title}
                {post.isHot && <span className="hot-badge">热</span>}
              </span>
              <span className="hot-heat">{post.heat}</span>
            </li>
          ))}
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
