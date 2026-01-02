import { useState, useRef } from 'react';
import { updateUser } from '../api';
import { uploadImageToImgBB } from '../utils/imageUpload';
import ImageCropperModal from './ImageCropperModal';
import './UserSetupModal.css';

// Import default avatars (using ImgBB links for production compatibility)
const avatar1 = 'https://i.ibb.co/wh9DdSKC/avatar1.png';
const avatar2 = 'https://i.ibb.co/hRpTMWcn/avatar2.png';
const avatar3 = 'https://i.ibb.co/Dg8skkzj/avatar3.png';
const avatar4 = 'https://i.ibb.co/M57xyFfj/avatar4.png';

const DEFAULT_AVATARS = [avatar1, avatar2, avatar3, avatar4];

function UserSetupModal({ user, onComplete, onBack }) {
  const [name, setName] = useState(user.name || '');
  const [bio, setBio] = useState('');
  const [avatarMode, setAvatarMode] = useState('google'); // 'google', 'default', 'upload'
  const [selectedDefaultAvatar, setSelectedDefaultAvatar] = useState(0);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Upload state
  const [imageSrc, setImageSrc] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setShowCropModal(true);
      });
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob) => {
    try {
      setLoading(true);
      const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
      const url = await uploadImageToImgBB(file);
      setUploadedAvatarUrl(url);
      setAvatarMode('upload');
      setShowCropModal(false);
    } catch (err) {
      console.error('Upload failed', err);
      alert('图片上传失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('请输入昵称');
      return;
    }

    setLoading(true);
    try {
      let picture = user.picture; // Default to current (Google)

      if (avatarMode === 'default') {
        picture = DEFAULT_AVATARS[selectedDefaultAvatar];
      } else if (avatarMode === 'upload') {
        if (!uploadedAvatarUrl) {
            alert('请先上传图片');
            setLoading(false);
            return;
        }
        picture = uploadedAvatarUrl;
      }

      const updatedUser = await updateUser(user.id, { 
        name, 
        picture,
        bio,
        isRegistrationComplete: true // Mark registration as complete
      });
      onComplete(updatedUser);
    } catch (err) {
      console.error('Setup failed', err);
      alert('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-setup-modal-backdrop">
      <div className="user-setup-modal">
        <h2>欢迎加入 Raddit!</h2>
        <p className="subtitle">请完善您的个人资料</p>

        <div className="form-group">
          <label>昵称</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="给自己起个响亮的名字"
          />
        </div>

        <div className="form-group">
          <label>简介</label>
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)}
            maxLength={150}
            placeholder="介绍一下你自己..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>选择头像</label>
          
          <div className="avatar-selection-container">
            {/* Google Avatar */}
            <div 
              className={`avatar-option ${avatarMode === 'google' ? 'selected' : ''}`}
              onClick={() => setAvatarMode('google')}
              title="使用 Google 头像"
            >
              <img src={user.picture} alt="Google" />
              <span className="avatar-label">Google</span>
            </div>

            {/* Default Avatars */}
            {DEFAULT_AVATARS.map((avatar, index) => (
              <div 
                key={index}
                className={`avatar-option ${avatarMode === 'default' && selectedDefaultAvatar === index ? 'selected' : ''}`}
                onClick={() => {
                  setAvatarMode('default');
                  setSelectedDefaultAvatar(index);
                }}
                title={`默认头像 ${index + 1}`}
              >
                <img src={avatar} alt={`Default ${index + 1}`} />
              </div>
            ))}

            {/* Upload */}
            <div 
              className={`avatar-option upload-option ${avatarMode === 'upload' ? 'selected' : ''}`}
              onClick={() => fileInputRef.current.click()}
              title="上传本地图片"
            >
              {uploadedAvatarUrl ? (
                <img src={uploadedAvatarUrl} alt="Uploaded" />
              ) : (
                <div className="upload-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </div>
              )}
              <span className="avatar-label">本地上传</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                hidden 
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          {onBack && (
            <button className="back-btn" onClick={onBack} disabled={loading}>
              返回
            </button>
          )}
          <button 
            className="submit-btn" 
            onClick={handleSubmit} 
            disabled={loading}
          >
            {loading ? '保存中...' : '开始探索'}
          </button>
        </div>
      </div>

      {showCropModal && (
        <ImageCropperModal
          imageSrc={imageSrc}
          onCancel={() => setShowCropModal(false)}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}

export default UserSetupModal;
