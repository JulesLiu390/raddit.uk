import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import { getUserInteractions, markNotificationsRead } from '../api';
import './HomePage.css'; // Use HomePage layout styles
import './ProfilePage.css'; // Reuse profile styles
import customSticker1 from '../assets/customSticker1.png';

const CUSTOM_REACTION_KEY = 'custom_sticker_1';

function InteractionsPage({ user, onLogout, onCreatePost }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // 标记消息为已读
        await markNotificationsRead();
        const data = await getUserInteractions(user.id);
        setItems(data);
      } catch (err) {
        console.error('Failed to fetch interactions', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="home-page">
      <Header user={user} onLogout={onLogout} onCreatePost={onCreatePost} toggleMenu={() => setIsMenuOpen(!isMenuOpen)} />
      
      <div className="main-container">
        <div className="content-wrapper">
          <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} />
          
          <main className="main-content">
            <div className="post-list">
              <div className="list-header">
                <span className="list-header-text" style={{ fontWeight: 'bold', fontSize: '16px', color: '#1a1a1a' }}>收到的互动</span>
              </div>
              
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <div key={idx} className="profile-list-item" onClick={() => navigate(`/post/${item.postId}`)}>
                    <div className="item-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <img 
                        src={item.actorAvatar || `https://ui-avatars.com/api/?name=${item.actorName}&background=random`} 
                        alt={item.actorName}
                        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                      />
                      <span style={{ fontWeight: 'bold' }}>{item.actorName}</span>
                      <span style={{ color: '#8590a6' }}>
                        {item.type === 'reply' ? '回复了你' : `赞了你的${item.targetType === 'post' ? '帖子' : '评论'}`}
                      </span>
                    </div>
                    
                    <div className="item-content-preview">
                      {item.type === 'reply' ? (
                        <>
                          <div style={{ marginBottom: '4px' }}>{item.content}</div>
                          <div style={{ fontSize: '13px', color: '#8590a6', padding: '8px', background: '#f6f6f6', borderRadius: '4px' }}>
                            回复: {item.targetContent}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px', display: 'inline-flex', alignItems: 'center' }}>
                            {item.content === CUSTOM_REACTION_KEY ? (
                              <img src={customSticker1} alt="sticker" style={{ width: '24px', height: '24px' }} />
                            ) : (
                              item.content
                            )}
                          </span>
                          <span style={{ color: '#8590a6' }}>{item.targetContent}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="item-meta">
                      <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">暂无互动消息</div>
              )}
            </div>
          </main>
          
          <Sidebar user={user} />
        </div>
      </div>
    </div>
  );
}

export default InteractionsPage;
