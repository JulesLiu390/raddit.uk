import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import { getTopics } from '../api';
import './TopicsPage.css';

function TopicsPage({ user, onLogout }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '话题广场 - Raddit';
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const data = await getTopics();
      setTopics(data);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`topics-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        user={user}
        onLogout={onLogout}
      />

      <main className="main-container">
        <div className="content-wrapper">
          <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} />

          <div className="main-content">
            <div className="topics-header">
              <h1>话题广场</h1>
              <p>发现感兴趣的话题</p>
            </div>

            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="topics-grid">
                {topics.map(topic => (
                  <div 
                    key={topic.id} 
                    className="topic-card"
                    onClick={() => navigate(`/topic/${topic.id}`)}
                  >
                    <div className="topic-card-icon">{topic.icon}</div>
                    <div className="topic-card-content">
                      <h3>{topic.name}</h3>
                      <p>{topic.description || '暂无描述'}</p>
                      <div className="topic-card-stats">
                        <span>{topic.postCount} 帖子</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Sidebar user={user} />
        </div>
      </main>
    </div>
  );
}

export default TopicsPage;
