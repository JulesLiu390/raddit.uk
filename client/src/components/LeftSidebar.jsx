import { useNavigate, useLocation } from 'react-router-dom';
import { BsFire, BsCompass, BsChatDots, BsStar, BsQuestionCircle, BsPeople } from 'react-icons/bs';
import './LeftSidebar.css';

function LeftSidebar({ isOpen, onClose, user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: <BsFire />, label: '热榜', path: '/' },
    { icon: <BsCompass />, label: '发现', path: '/discovery' },
    { icon: <BsChatDots />, label: '话题', path: '/topics' },
  ];

  const personalItems = [
    { icon: <BsQuestionCircle />, label: '我关注的问题', path: '/following' },
    { icon: <BsPeople />, label: '我关注的用户', path: user ? `/profile/${user.id}?tab=following_users` : '/login' },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      
      <aside className={`left-sidebar ${isOpen ? 'open' : ''}`}>
        <nav className="left-nav">
          {menuItems.map((item, index) => (
            <div 
              key={index} 
              className={`left-nav-item ${location.pathname === item.path ? 'active' : ''}`} 
              onClick={() => handleNavigation(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </nav>
        
        <div className="nav-divider" />
        
        <nav className="left-nav">
          {personalItems.map((item, index) => {
            const isActive = item.path.includes('?') 
              ? location.pathname + location.search === item.path
              : location.pathname === item.path;
              
            return (
              <div 
                key={index} 
                className={`left-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavigation(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export default LeftSidebar;
