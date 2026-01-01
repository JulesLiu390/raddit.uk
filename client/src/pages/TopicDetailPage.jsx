import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { BsCamera, BsPencil } from 'react-icons/bs';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import ImageCropperModal from '../components/ImageCropperModal';
import { getTopic, getTopicPosts, createPost as apiCreatePost, toggleFollowTopic, getUserFollowedTopics, updateTopic } from '../api';
import { uploadImageToImgBB } from '../utils/imageUpload';
import './TopicDetailPage.css';

function TopicDetailPage({ user, onLogout }) {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Edit Info State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [topicData, postsData] = await Promise.all([
        getTopic(id),
        getTopicPosts(id)
      ]);
      setTopic(topicData);
      setPosts(postsData);
      document.title = `${topicData.name} - Raddit`;

      if (user) {
        const followedTopics = await getUserFollowedTopics(user.id);
        const isFollowed = followedTopics.some(t => t.id === id || t._id === id);
        setIsFollowing(isFollowed);
      }
    } catch (err) {
      console.error('Failed to fetch topic data:', err);
      setError('获取话题数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    setFollowLoading(true);
    try {
      const result = await toggleFollowTopic(id);
      setIsFollowing(result.isFollowing);
      setTopic(prev => ({
        ...prev,
        followers: result.followersCount
      }));
    } catch (err) {
      console.error('Follow topic failed:', err);
      alert('操作失败');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCreatePost = async (postData) => {
    try {
      // 强制关联当前话题
      const newPost = await apiCreatePost({
        ...postData,
        topics: [id] // 默认选中当前话题
      });
      setPosts([newPost, ...posts]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('创建帖子失败:', err);
      alert('发布失败，请检查后端连接');
    }
  };

  const handleIconClick = () => {
    if (user && user.role === 'admin') {
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
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob) => {
    setUploading(true);
    try {
      // Create a File object from the Blob
      const file = new File([croppedBlob], "topic-icon.jpg", { type: "image/jpeg" });
      
      // Upload to ImgBB
      const imageUrl = await uploadImageToImgBB(file);
      
      if (imageUrl) {
        // Update topic in backend
        const updatedTopic = await updateTopic(topic.id, { icon: imageUrl });
        setTopic(updatedTopic);
        setShowCropModal(false);
      }
    } catch (err) {
      console.error('Failed to update topic icon:', err);
      alert('Failed to update icon');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!editName.trim()) {
      alert('话题名称不能为空');
      return;
    }
    
    setUploading(true);
    try {
      const updatedTopic = await updateTopic(topic.id, {
        name: editName,
        description: editDescription
      });
      setTopic(updatedTopic);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update topic info:', err);
      alert('更新失败');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className={`topic-detail-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header 
        onCreatePost={() => setShowCreateModal(true)} 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        user={user}
        onLogout={onLogout}
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
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>加载中...</p>
              </div>
            ) : error ? (
              <div className="error-state">{error}</div>
            ) : (
              <>
                {/* Topic Header */}
                <div className="topic-header-card">
                  <div className="topic-icon-wrapper">
                    <div className="topic-icon">
                      {topic.icon ? <img src={topic.icon} alt={topic.name} /> : topic.name[0]}
                    </div>
                    {user && user.role === 'admin' && (
                      <div 
                        className="topic-icon-edit-overlay"
                        onClick={handleIconClick}
                        title="更换图标"
                      >
                        <BsCamera />
                      </div>
                    )}
                  </div>
                  <div className="topic-info">
                    {isEditing ? (
                      <div className="edit-topic-form">
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)}
                          className="edit-topic-name"
                          placeholder="话题名称"
                        />
                        <textarea 
                          value={editDescription} 
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="edit-topic-desc"
                          placeholder="添加描述..."
                          rows={3}
                        />
                        <div className="edit-topic-actions">
                          <button className="save-btn" onClick={handleSaveInfo} disabled={uploading}>
                            {uploading ? '保存中...' : '保存'}
                          </button>
                          <button className="cancel-btn" onClick={() => setIsEditing(false)} disabled={uploading}>
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="topic-title-row">
                          <h1>{topic.name}</h1>
                          {user && user.role === 'admin' && (
                            <button 
                              className="edit-topic-btn"
                              onClick={() => {
                                setEditName(topic.name);
                                setEditDescription(topic.description || '');
                                setIsEditing(true);
                              }}
                              title="编辑话题信息"
                            >
                              <BsPencil />
                            </button>
                          )}
                        </div>
                        <p>{topic.description || '暂无描述'}</p>
                        <div className="topic-stats">
                          <span>{topic.postCount} 帖子</span>
                          <span>{topic.followers?.length || topic.memberCount || 0} 成员</span>
                        </div>
                      </>
                    )}
                  </div>
                  <button 
                    className={`join-btn ${isFollowing ? 'joined' : ''}`} 
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    {isFollowing ? '已加入' : '加入话题'}
                  </button>
                </div>

                {/* Post List */}
                <div className="post-list">
                  {posts.length === 0 ? (
                    <div className="empty-state">
                      <p>该话题下暂无帖子</p>
                      <button onClick={() => setShowCreateModal(true)}>发布第一篇帖子</button>
                    </div>
                  ) : (
                    posts.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <Sidebar user={user} />
        </div>
      </main>

      {showCreateModal && (
        <CreatePostModal 
          onClose={() => setShowCreateModal(false)} 
          onPostCreated={handlePostCreated}
          initialTopic={topic}
        />
      )}
      
      {showCropModal && (
        <ImageCropperModal
          imageSrc={imageSrc}
          onCancel={() => setShowCropModal(false)}
          onCropComplete={handleCropComplete}
          uploading={uploading}
        />
      )}
    </div>
  );
}

export default TopicDetailPage;
