import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import { getUserReactions } from '../api';
import './HomePage.css'; // Use HomePage layout styles
import './ProfilePage.css'; // Reuse profile styles for list items

function FavoritesPage({ user, onLogout, onCreatePost }) {
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
        const data = await getUserReactions(user.id);
        setItems(data);
      } catch (err) {
        console.error('Failed to fetch favorites', err);
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
        <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} />
        
        <main className="feed-container">
          <div className="profile-list" style={{ background: 'white', borderRadius: '4px', padding: '20px' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>我的收藏</h2>
            
            {items.length > 0 ? (
              items.map((reaction, idx) => {
                let typeLabel = '';
                let targetText = '';
                
                if (reaction.type === 'post') {
                  typeLabel = '收藏了帖子';
                  targetText = reaction.postTitle;
                } else if (reaction.type === 'reply') {
                  typeLabel = '收藏了回复';
                  targetText = `"${reaction.targetContent?.length > 60 ? reaction.targetContent.substring(0, 60) + '...' : reaction.targetContent}"`;
                } else if (reaction.type === 'comment') {
                  typeLabel = '收藏了评论';
                  targetText = `"${reaction.targetContent?.length > 60 ? reaction.targetContent.substring(0, 60) + '...' : reaction.targetContent}"`;
                }
                
                return (
                  <div key={`${reaction.targetId}-${reaction.emoji}-${idx}`} className="profile-list-item" onClick={() => navigate(`/post/${reaction.postId}`)}>
                    <div className="item-type-label">
                      <span className="reaction-emoji" style={{ fontSize: '20px', marginRight: '8px' }}>{reaction.emoji}</span>
                      {typeLabel}
                    </div>
                    <div className="item-content-preview">
                      {reaction.type === 'post' ? (
                        <strong>{targetText}</strong>
                      ) : (
                        <>
                          <div style={{ fontSize: '13px', color: '#8590a6', marginBottom: '4px' }}>
                            在帖子《{reaction.postTitle}》中
                          </div>
                          <div>{targetText}</div>
                        </>
                      )}
                    </div>
                    <div className="item-meta">
                      <span>{new Date(reaction.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">暂无收藏内容</div>
            )}
          </div>
        </main>
        
        <div className="right-sidebar-placeholder" style={{ width: '296px' }}></div>
      </div>
    </div>
  );
}

export default FavoritesPage;
