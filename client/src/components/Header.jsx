import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BsSearch, BsPencilSquare, BsBell, BsList } from 'react-icons/bs';
import logo from '../assets/logo.png';
import './Header.css';

function Header({ onSearch, onCreatePost, onToggleMenu, user, onLogout }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('hot');
  const userInitial = user?.name?.[0]?.toUpperCase() || 'U';

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const navItems = [
    { key: 'hot', label: '热榜' },
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
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </button>
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

          <button className="icon-btn" title="消息">
            <BsBell />
            <span className="badge">3</span>
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
