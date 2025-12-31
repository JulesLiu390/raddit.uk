import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsTrash } from 'react-icons/bs';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import { getTopics, deleteTopic } from '../api';
import './TopicsPage.css';

function TopicsPage({ user, onLogout, onCreatePost }) {
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

  const handleDeleteTopic = async (e, topicId) => {
    e.stopPropagation(); // Prevent navigation
    if (!window.confirm('确定要删除这个话题吗？相关的帖子可能不会被删除，但话题关联会移除。')) {
      return;
    }

    try {
      await deleteTopic(topicId);
      setTopics(topics.filter(t => t.id !== topicId));
    } catch (err) {
      alert('删除失败: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className={`topics-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        user={user}
        onLogout={onLogout}
        onCreatePost={onCreatePost}
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
                    {user && user.role === 'admin' && (
                      <button 
                        className="delete-topic-btn"
                        onClick={(e) => handleDeleteTopic(e, topic.id)}
                        title="删除话题"
                      >
                        <BsTrash />
                      </button>
                    )}
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
