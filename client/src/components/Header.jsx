import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BsSearch, BsPencilSquare, BsBell, BsList } from 'react-icons/bs';
import { getNotificationCount } from '../api';
import logo from '../assets/logo.png';
import './Header.css';

function Header({ onSearch, onCreatePost, onToggleMenu, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('hot');
  const [unreadCount, setUnreadCount] = useState(0);
  const userInitial = user?.name?.[0]?.toUpperCase() || 'U';

  // 定期获取未读数
  useEffect(() => {
    if (!user) return;

    const fetchCount = async () => {
      try {
        const data = await getNotificationCount();
        console.log('Notification count:', data.count);
        setUnreadCount(data.count);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchCount();
    // 每 60 秒轮询一次
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleBellClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // 只负责跳转，不负责清除计数
    navigate('/notifications');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const navItems = [
    { key: 'hot', label: '热榜', path: '/' },
    { key: 'discovery', label: '发现', path: '/discovery' },
    { key: 'topics', label: '话题', path: '/topics' },
  ];

  return (
    <header className="header">
      <div className="header-container">
        {/* Mobile Menu Toggle */}
        <button className="mobile-menu-btn" onClick={onToggleMenu}>
          <BsList />
        </button>

        {/* Logo */}
        <Link to="/" className="header-logo">
          <img src={logo} alt="Raddit Logo" className="logo-img" />
          <span className="logo-text">Raddit</span>
        </Link>

        {/* Navigation */}
        <nav className="header-nav">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className={`nav-item ${window.location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <form className="header-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="搜索 Raddit 内容"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-btn">
            <BsSearch />
          </button>
        </form>

        {/* Actions */}
        <div className="header-actions">
          <button className="action-btn" onClick={onCreatePost}>
            <BsPencilSquare />
            <span>发新帖</span>
          </button>

          <button className="icon-btn" title="消息" onClick={handleBellClick}>
            <BsBell />
            {unreadCount > 0 && location.pathname !== '/notifications' && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {!user ? (
            <Link to="/login" className="login-link-btn">
              登录
            </Link>
          ) : (
            <div className="user-profile">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="user-avatar" />
              ) : (
                <div className="user-avatar placeholder">{userInitial}</div>
              )}
              <div className="user-info-meta">
                <span className="user-name">{user.name || user.email}</span>
                <button className="logout-btn" onClick={() => onLogout?.()}>
                  退出
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
