import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsTrash, BsCamera } from 'react-icons/bs';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import ImageCropperModal from '../components/ImageCropperModal';
import { getTopics, deleteTopic, getUserFollowedTopics, updateTopic } from '../api';
import { uploadImageToImgBB } from '../utils/imageUpload';
import './TopicsPage.css';

function TopicsPage({ user, onLogout, onCreatePost }) {
  const [topics, setTopics] = useState([]);
  const [followedTopics, setFollowedTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [uploadingTopicId, setUploadingTopicId] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '话题广场 - Raddit';
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allTopics, followed] = await Promise.all([
        getTopics(),
        user ? getUserFollowedTopics(user.id) : Promise.resolve([])
      ]);
      setTopics(allTopics);
      setFollowedTopics(followed);
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
      setFollowedTopics(followedTopics.filter(t => t.id !== topicId));
    } catch (err) {
      alert('删除失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleIconClick = (e, topicId) => {
    e.stopPropagation();
    if (user && user.role === 'admin') {
      setUploadingTopicId(topicId);
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setShowCropModal(true);
      });
      reader.readAsDataURL(file);
    }
    // Reset input value to allow selecting same file again
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob) => {
    if (!uploadingTopicId) return;
    
    setUploading(true);
    try {
      const file = new File([croppedBlob], "topic-icon.jpg", { type: "image/jpeg" });
      const url = await uploadImageToImgBB(file);
      const updatedTopic = await updateTopic(uploadingTopicId, { icon: url });
      
      // Update local state
      setTopics(topics.map(t => t.id === uploadingTopicId ? { ...t, icon: updatedTopic.icon } : t));
      setFollowedTopics(followedTopics.map(t => t.id === uploadingTopicId ? { ...t, icon: updatedTopic.icon } : t));
      
      setShowCropModal(false);
      setUploadingTopicId(null);
      setImageSrc(null);
      alert('图标更新成功');
    } catch (err) {
      console.error('Update failed:', err);
      alert('更新失败: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setUploadingTopicId(null);
    setImageSrc(null);
  };

  const renderTopicCard = (topic) => (
    <div 
      key={topic.id} 
      className="topic-card"
      onClick={() => navigate(`/topic/${topic.id}`)}
    >
      <div className="topic-card-icon-wrapper">
        <div className="topic-card-icon">
          {topic.icon ? <img src={topic.icon} alt={topic.name} /> : topic.name[0]}
        </div>
        {user && user.role === 'admin' && (
          <div 
            className="topic-icon-edit-overlay"
            onClick={(e) => handleIconClick(e, topic.id)}
            title="更换图标"
          >
            <BsCamera />
          </div>
        )}
      </div>
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
  );

  return (
    <div className={`topics-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        user={user}
        onLogout={onLogout}
        onCreatePost={onCreatePost}
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*"
        onChange={handleFileChange}
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
              <>
                {user && followedTopics.length > 0 && (
                  <div className="topics-section">
                    <h2 className="section-title">我关注的话题</h2>
                    <div className="topics-grid">
                      {followedTopics.map(renderTopicCard)}
                    </div>
                  </div>
                )}

                <div className="topics-section">
                  <h2 className="section-title">所有话题</h2>
                  <div className="topics-grid">
                    {topics.map(renderTopicCard)}
                  </div>
                </div>
              </>
            )}
          </div>

          <Sidebar user={user} />
        </div>
      </main>

      {showCropModal && (
        <ImageCropperModal
          imageSrc={imageSrc}
          aspect={1}
          onCancel={handleCropCancel}
          onCropComplete={handleCropComplete}
          loading={uploading}
        />
      )}
    </div>
  );
}

export default TopicsPage;
