import { useState } from 'react';
import './CreatePostModal.css';

function CreatePostModal({ onClose, onSubmit, user }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (title.trim().length < 10) {
      alert('帖子标题最低不少于10个字');
      return;
    }
    
    if (content.trim().length < 5) {
      alert('内容不少于5个字');
      return;
    }
    
    const postData = {
      title: title.trim(),
      content: content.trim(),
    };

    if (user) {
      postData.author = user.name;
      postData.authorAvatar = user.picture;
      postData.authorId = user.id;
    }

    onSubmit(postData);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>发布新帖子</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">标题</label>
            <input
              id="title"
              type="text"
              placeholder="输入帖子标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>身份</label>
            <div className="identity-hint">
              {user ? (
                <div className="user-identity">
                  <img src={user.picture} alt={user.name} className="user-avatar-small" />
                  <span>以 <strong>{user.name}</strong> 的身份发布</span>
                </div>
              ) : (
                <div className="ip-identity">
                  <span className="ip-icon">🌐</span>
                  <span>未登录，将使用 IP 地址作为身份发布</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="content">内容</label>
            <textarea
              id="content"
              placeholder="分享你的想法..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              取消
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={!title.trim() || !content.trim()}
            >
              发布
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePostModal;
