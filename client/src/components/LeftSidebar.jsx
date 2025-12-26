import { BsFire, BsCompass, BsChatDots, BsStar, BsQuestionCircle } from 'react-icons/bs';
import './LeftSidebar.css';

function LeftSidebar({ isOpen, onClose }) {
  const menuItems = [
    { icon: <BsFire />, label: '热榜', active: true },
    { icon: <BsCompass />, label: '发现' },
    { icon: <BsChatDots />, label: '话题' },
  ];

  const personalItems = [
    { icon: <BsStar />, label: '我的收藏' },
    { icon: <BsQuestionCircle />, label: '我关注的问题' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      
      <aside className={`left-sidebar ${isOpen ? 'open' : ''}`}>
        <nav className="left-nav">
          {menuItems.map((item, index) => (
            <div key={index} className={`left-nav-item ${item.active ? 'active' : ''}`} onClick={onClose}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </nav>
        
        <div className="nav-divider" />
        
        <nav className="left-nav">
          {personalItems.map((item, index) => (
            <div key={index} className="left-nav-item" onClick={onClose}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default LeftSidebar;
