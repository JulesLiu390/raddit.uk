import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BsSearch, BsPencilSquare, BsBell, BsList } from 'react-icons/bs';
import { getNotificationCount } from '../api';
import { useHeader } from '../context/HeaderContext';
import logo from '../assets/logo.png';
import './Header.css';

function Header({ onSearch, onCreatePost, onToggleMenu, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { headerState } = useHeader();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('hot');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showContextMode, setShowContextMode] = useState(false);
  const userInitial = user?.name?.[0]?.toUpperCase() || 'U';

  // Scroll listener for context header
  useEffect(() => {
    if (!headerState.isVisible) {
      setShowContextMode(false);
      return;
    }

    const handleScroll = () => {
      const threshold = 100; // Show context header after 100px scroll
      if (window.scrollY > threshold) {
        setShowContextMode(true);
      } else {
        setShowContextMode(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headerState.isVisible]);

  // 定期获取未读数
  useEffect(() => {
    if (!user) return;

    const fetchCount = async () => {
      // 如果当前在通知页，直接设为0，不请求服务器（或者忽略请求结果）
      if (location.pathname === '/notifications') {
        setUnreadCount(0);
        return;
      }

      try {
        const data = await getNotificationCount();
        // 再次检查，防止请求期间页面跳转了
        if (location.pathname !== '/notifications') {
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchCount();
    // 每 60 秒轮询一次
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user, location.pathname]); // 添加 location.pathname 作为依赖

  // 当进入通知页时，清空本地计数
  useEffect(() => {
    if (location.pathname === '/notifications') {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  const handleBellClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/notifications');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const navItems = [
    { key: 'recommend', label: '推荐', path: '/' },
    { key: 'hot', label: '热榜', path: '/hot' },
    { key: 'discovery', label: '发现', path: '/discovery' },
    { key: 'topics', label: '话题', path: '/topics' },
  ];

  return (
    <header className="header">
      <div className="header-container">
        {/* Left Section: Mobile Menu & Logo */}
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={onToggleMenu}>
            <BsList />
          </button>

          <Link to="/" className="header-logo">
            <img src={logo} alt="Raddit Logo" className="logo-img" />
            <span className="logo-text">Raddit</span>
          </Link>
        </div>

        {/* Middle Section: Scrollable Viewport */}
        <div className="header-middle-viewport">
          <div className={`header-middle-scroll-container ${showContextMode ? 'show-context' : ''}`}>
            {/* Layer 1: Default Navigation & Search */}
            <div className="header-middle-layer layer-default">
              <nav className="header-nav">
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.key)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

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
            </div>

            {/* Layer 2: Context Title & Actions */}
            <div className="header-middle-layer layer-context">
              <div className="header-context-title">{headerState.title}</div>
              <div className="context-actions">
                {headerState.actions}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Global Actions */}
        <div className="header-right">
          <div className="header-actions">
            <button className="action-btn" onClick={onCreatePost}>
              <BsPencilSquare />
              <span>发新帖</span>
            </button>

            <button className="icon-btn" title="消息" onClick={handleBellClick}>
              <BsBell />
              {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
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
      </div>
    </header>
  );
}

export default Header;
