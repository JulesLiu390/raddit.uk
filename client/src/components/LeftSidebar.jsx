import { useNavigate, useLocation } from 'react-router-dom';
import { BsQuestionCircle, BsPeople, BsStar, BsBell, BsGithub } from 'react-icons/bs';
import './LeftSidebar.css';

function LeftSidebar({ isOpen, onClose, user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const personalItems = [
    { icon: <BsQuestionCircle />, label: '我关注的问题', path: '/following' },
    { icon: <BsPeople />, label: '我关注的用户', path: '/following-users' },
    { icon: <BsBell />, label: '收到的互动', path: '/notifications' },
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

        <div className="nav-spacer" />

        <a 
          href="https://github.com/JulesLiu390/raddit.uk" 
          target="_blank" 
          rel="noopener noreferrer"
          className="left-nav-item github-link"
        >
          <span className="nav-icon"><BsGithub /></span>
          <span className="nav-label">GitHub</span>
        </a>
      </aside>
    </>
  );
}

export default LeftSidebar;
