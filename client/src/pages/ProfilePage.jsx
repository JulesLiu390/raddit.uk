import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '../components/Header';
import { getPosts, getUserReplies, getPostMessages, getUser, updateUser, getUserFollowing, getUserFollowingUsers, toggleFollowUser, getUserReactions } from '../api';
import Cropper from 'react-easy-crop';
import { uploadImageToImgBB } from '../utils/imageUpload';
import './ProfilePage.css';

// Canvas 裁剪辅助函数
const getCroppedImg = (imageSrc, pixelCrop) => {
  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  return new Promise(async (resolve, reject) => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('No 2d context'));
      }

      // 设置 canvas 大小为裁剪区域大小
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      // 绘制裁剪后的图片
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      // 导出为 Blob
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        blob.name = 'avatar.jpeg';
        resolve(blob);
      }, 'image/jpeg');
    } catch (e) {
      reject(e);
    }
  });
};

const MarkdownComponents = {
  a: ({ node, ...props }) => {
    let href = props.href || '';
    // 如果链接不以 http, https, / (相对路径), # (锚点), mailto: 开头，则默认添加 https://
    if (href && !href.match(/^(http|https|\/|#|mailto:|tel:)/)) {
      href = `https://${href}`;
    }
    return <a {...props} href={href} target="_blank" rel="noopener noreferrer" />;
  }
};

function ProfilePage({ user, onLogout }) {
  const { id } = useParams(); // If viewing another user
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'posts');
  const [userPosts, setUserPosts] = useState([]);
  const [userReplies, setUserReplies] = useState([]);
  const [userReactions, setUserReactions] = useState([]);
  const [userFollowing, setUserFollowing] = useState([]);
  const [userFollowingUsers, setUserFollowingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchedUser, setFetchedUser] = useState(null);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  
  // Edit Profile State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  
  // Avatar Upload State
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Determine which user profile to show
  const isOwnProfile = !id || (user && user.id === id);
  const profileUser = isOwnProfile ? user : (fetchedUser || { name: 'Loading...', id: id });

  // Avatar Upload Handlers
  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setShowCropModal(true);
      });
      reader.readAsDataURL(file);
    }
  };



  const handleSaveAvatar = async () => {
    try {
      setUploadingAvatar(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
      
      const url = await uploadImageToImgBB(file);
      
      const updatedUser = await updateUser(user.id, { picture: url });
      
      // Update local user state if possible, or reload
      if (isOwnProfile) {
        localStorage.setItem('raddit-user', JSON.stringify(updatedUser));
        window.location.reload();
      } else {
        setFetchedUser(updatedUser);
      }
      
      setShowCropModal(false);
    } catch (e) {
      console.error('Failed to upload avatar:', e);
      alert('头像上传失败，请重试');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (!isOwnProfile && id) {
      getUser(id).then(data => {
        setFetchedUser(data);
      }).catch(err => {
        console.error('Failed to fetch user info:', err);
        setFetchedUser({ name: 'Unknown User', id: id });
      });
    }
  }, [id, isOwnProfile]);

  useEffect(() => {
    if (profileUser?.name !== 'Loading...') {
      document.title = `${profileUser?.name || 'User'} - 个人中心`;
      fetchData();
    }
  }, [profileUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch posts
      const allPosts = await getPosts();
      // Filter posts by this user
      const myPosts = allPosts.filter(p => profileUser?.id && p.authorId === profileUser.id);
      setUserPosts(myPosts);

      // Fetch replies with post info
      if (profileUser?.id) {
        const replies = await getUserReplies(profileUser.id);
        setUserReplies(replies);
        
        const following = await getUserFollowing(profileUser.id);
        setUserFollowing(following);
      }

      // Fetch reactions (optimized)
      const reactions = [];
      if (profileUser?.id) {
        try {
          const { posts: reactedPosts, messages: reactedMessages } = await getUserReactions(profileUser.id);
          
          // Process posts
          reactedPosts.forEach(post => {
            if (post.reactions) {
              Object.entries(post.reactions).forEach(([emoji, userIds]) => {
                if (userIds.includes(profileUser.id)) {
                  reactions.push({
                    type: 'post',
                    emoji,
                    targetId: post.id,
                    postId: post.id,
                    postTitle: post.title,
                    targetContent: post.title,
                    createdAt: post.createdAt
                  });
                }
              });
            }
          });

          // Process messages
          reactedMessages.forEach(msg => {
            if (msg.reactions) {
              Object.entries(msg.reactions).forEach(([emoji, userIds]) => {
                if (userIds.includes(profileUser.id)) {
                  const isTopLevel = !msg.parentId;
                  reactions.push({
                    type: isTopLevel ? 'reply' : 'comment',
                    emoji,
                    targetId: msg.id,
                    postId: msg.postId,
                    postTitle: msg.postTitle,
                    messageContent: msg.content,
                    targetContent: msg.content,
                    authorName: msg.author,
                    createdAt: msg.createdAt
                  });
                }
              });
            }
          });
        } catch (err) {
          console.error('Failed to fetch user reactions:', err);
        }
      }
      setUserReactions(reactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      
      // Fetch user following data
      if (profileUser?.id) {
        const followingData = await getUserFollowing(profileUser.id);
        setUserFollowing(followingData);
        
        const followingUsersData = await getUserFollowingUsers(profileUser.id);
        setUserFollowingUsers(followingUsersData);
      }

      // Check if current logged-in user is following this profile user
      if (!isOwnProfile && user) {
        // We need to check if 'user' (me) is following 'profileUser' (them)
        // We can fetch my following list or check their followers list.
        // Let's fetch my following list to be sure.
        try {
          const myFollowing = await getUserFollowingUsers(user.id);
          setIsFollowingUser(myFollowing.some(u => u.googleId === profileUser.id));
        } catch (e) {
          console.error('Failed to check follow status', e);
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUser = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    try {
      const targetId = profileUser.id || profileUser.googleId;
      if (!targetId) {
        console.error('Cannot follow user: missing ID', profileUser);
        return;
      }
      const data = await toggleFollowUser(targetId);
      setIsFollowingUser(data.isFollowing);
      // Update follower count locally if needed, though we don't display it prominently yet
      if (data.isFollowing) {
        setFetchedUser(prev => ({ ...prev, followers: [...(prev.followers || []), user.id] }));
      } else {
        setFetchedUser(prev => ({ ...prev, followers: (prev.followers || []).filter(id => id !== user.id) }));
      }
    } catch (err) {
      console.error('Failed to toggle follow user:', err);
      alert('操作失败');
    }
  };

  const handleEditClick = () => {
    setEditName(profileUser.name);
    setEditBio(profileUser.bio || '');
    setShowEditModal(true);
    setEditError('');
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    
    try {
      const updatedUser = await updateUser(profileUser.id, {
        name: editName,
        bio: editBio
      });
      
      if (isOwnProfile) {
        localStorage.setItem('raddit-user', JSON.stringify(updatedUser));
        window.location.reload(); 
      } else {
        setFetchedUser(updatedUser);
      }
      setShowEditModal(false);
    } catch (err) {
      setEditError(err.response?.data?.message || '更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading && !profileUser) {
    return (
      <div className="profile-page">
        <Header user={user} onLogout={onLogout} />
        <div className="error-container">
          <p>请先登录</p>
          <button onClick={() => navigate('/login')}>去登录</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'posts', label: '主帖', count: userPosts.length },
    { key: 'replies', label: '回复', count: userReplies.length },
    { key: 'activities', label: '互动', count: userReactions.length },
    { key: 'following_questions', label: '关注的问题', count: userFollowing.length },
    { key: 'following_users', label: '关注的用户', count: userFollowingUsers.length },
  ];

  return (
    <div className="profile-page">
      <Header user={user} onLogout={onLogout} />
      
      <div className="profile-container">
        {/* Header Card */}
        <div className="profile-header-card">
          <div className="profile-cover">
            {isOwnProfile && (
              <button className="upload-cover-btn">
                📷 上传封面图片
              </button>
            )}
          </div>
          <div className="profile-info-wrapper">
            <div className="profile-avatar-container" onClick={() => isOwnProfile && fileInputRef.current.click()} style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}>
              <img 
                src={profileUser?.picture || `https://ui-avatars.com/api/?name=${profileUser?.name || 'User'}&background=random`} 
                alt="avatar" 
                className="profile-avatar" 
              />
              {isOwnProfile && <div className="avatar-overlay">更换头像</div>}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onFileChange} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />
            <div className="profile-main-info">
              <h1 className="profile-name">
                {profileUser?.name || '匿名用户'}
              </h1>
              <div className="profile-bio">
                {profileUser?.bio || '暂无个人简介'}
              </div>
            </div>
            <div className="profile-actions">
              {isOwnProfile ? (
                <button className="edit-profile-btn" onClick={handleEditClick}>
                  编辑个人资料
                </button>
              ) : (
                <button className="edit-profile-btn" onClick={handleFollowUser}>
                  {isFollowingUser ? '取消关注' : '关注'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="profile-content">
          {/* Main Content */}
          <div className="profile-main">
            <div className="profile-tabs">
              {tabs.map(tab => (
                <div 
                  key={tab.key} 
                  className={`profile-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  <span className="profile-tab-count">{tab.count}</span>
                </div>
              ))}
            </div>

            <div className="profile-list">
              {activeTab === 'posts' && (
                <>
                  {userPosts.length > 0 ? (
                    userPosts.map(post => (
                      <div key={post.id} className="profile-list-item">
                        <div className="item-title" onClick={() => navigate(`/post/${post.id}`)}>
                          {post.title}
                        </div>
                        <div className="item-content-preview">
                          {post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content}
                        </div>
                        <div className="item-meta">
                          <span>{new Date(post.createdAt).toLocaleString('zh-CN')}</span>
                          <span>{post.heat || 0} 热度</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">暂无发布的内容</div>
                  )}
                </>
              )}
              
              {activeTab === 'replies' && (
                <>
                  {userReplies.length > 0 ? (
                    userReplies.map(reply => {
                      const contentPreview = reply.content.length > 80 ? reply.content.substring(0, 80) + '...' : reply.content;
                      return (
                        <div key={reply.id} className="profile-list-item" onClick={() => navigate(`/post/${reply.postId}`)}>
                          <div className="item-type-label">回复了帖子：{reply.postTitle || '未知帖子'}</div>
                          <div className="item-content-preview">
                            {contentPreview}
                          </div>
                          <div className="item-meta">
                            <span>{new Date(reply.createdAt).toLocaleString('zh-CN')}</span>
                            <span>{reply.upvotes || 0} 赞同</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">暂无回复内容</div>
                  )}
                </>
              )}
              
              {activeTab === 'activities' && (
                <>
                  {userReactions.length > 0 ? (
                    userReactions.map((reaction, idx) => {
                      let typeLabel = '';
                      let targetText = '';
                      
                      if (reaction.type === 'post') {
                        typeLabel = '回应了帖子';
                        targetText = reaction.postTitle;
                      } else if (reaction.type === 'reply') {
                        typeLabel = '回应了回复';
                        targetText = `"${reaction.targetContent?.length > 60 ? reaction.targetContent.substring(0, 60) + '...' : reaction.targetContent}"`;
                      } else if (reaction.type === 'comment') {
                        typeLabel = '回应了评论';
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
                    <div className="empty-state">暂无互动内容</div>
                  )}
                </>
              )}
              
              {activeTab === 'following_questions' && (
                <>
                  {userFollowing.length > 0 ? (
                    userFollowing.map(post => (
                      <div key={post.id || post._id} className="profile-list-item">
                        <div className="item-title" onClick={() => navigate(`/post/${post.id || post._id}`)}>
                          {post.title}
                        </div>
                        <div className="item-content-preview">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                            {post.content && (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content)}
                          </ReactMarkdown>
                        </div>
                        <div className="item-meta">
                          <span>{new Date(post.createdAt).toLocaleString('zh-CN')}</span>
                          <span>{post.heat || 0} 热度</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">暂无关注的问题</div>
                  )}
                </>
              )}

              {activeTab === 'following_users' && (
                <>
                  {userFollowingUsers.length > 0 ? (
                    userFollowingUsers.map(followedUser => (
                      <div key={followedUser.id || followedUser.googleId} className="profile-list-item profile-user-item" onClick={() => navigate(`/profile/${followedUser.id || followedUser.googleId}`)}>
                        <div className="item-avatar">
                          <img 
                            src={followedUser.picture || `https://ui-avatars.com/api/?name=${followedUser.name}&background=random`} 
                            alt="avatar" 
                            className="followed-user-avatar" 
                          />
                        </div>
                        <div className="item-info">
                          <div className="item-title">
                            {followedUser.name}
                          </div>
                          <div className="item-meta">
                            <span>{followedUser.bio || '暂无简介'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">暂无关注的用户</div>
                  )}
                </>
              )}
              
              {activeTab !== 'posts' && activeTab !== 'replies' && activeTab !== 'activities' && activeTab !== 'following_questions' && activeTab !== 'following_users' && (
                <div className="empty-state">
                  暂无{tabs.find(t => t.key === activeTab)?.label}内容
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="profile-sidebar">
            <div className="profile-stat-card">
              <div className="stat-grid">
                <div className="stat-item" onClick={() => setActiveTab('following_users')}>
                  <div className="stat-label">关注用户</div>
                  <div className="stat-value">{userFollowingUsers.length}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">关注者</div>
                  <div className="stat-value">{profileUser?.followers?.length || 0}</div>
                </div>
              </div>
              <div className="stat-grid" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f0f2f7' }}>
                <div className="stat-item" onClick={() => setActiveTab('following_questions')}>
                  <div className="stat-label">关注问题</div>
                  <div className="stat-value">{userFollowing.length}</div>
                </div>
              </div>
            </div>
            
            <div className="sidebar-footer">
              <p>© 2025 Raddit.uk</p>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content edit-profile-modal">
            <div className="modal-header">
              <h3>编辑个人资料</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {editError && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{editError}</div>}
              <div className="form-group">
                <label>昵称</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="请输入新昵称"
                />
                <p className="help-text">注意：昵称每30天只能修改一次</p>
              </div>
              <div className="form-group">
                <label>个性签名</label>
                <textarea 
                  value={editBio} 
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="介绍一下你自己..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowEditModal(false)} disabled={editLoading}>取消</button>
              <button className="confirm-btn" onClick={handleUpdateProfile} disabled={editLoading}>
                {editLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCropModal && (
        <div className="modal-overlay">
          <div className="modal-content crop-avatar-modal">
            <div className="modal-header">
              <h3>裁剪头像</h3>
              <button className="close-btn" onClick={() => setShowCropModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {imageSrc && (
                <div className="crop-container">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(crop, pixelCrop) => setCroppedAreaPixels(pixelCrop)}
                    cropShape="round"
                    showGrid={true}
                    styles={{
                      cropArea: {
                        borderRadius: '50%',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowCropModal(false)} disabled={uploadingAvatar}>取消</button>
              <button className="confirm-btn" onClick={handleSaveAvatar} disabled={uploadingAvatar}>
                {uploadingAvatar ? '上传中...' : '上传头像'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
