import { useState, useEffect } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { selectAndUploadImage, uploadImageToImgBB } from '../utils/imageUpload';
import { getTopics, createTopic } from '../api';
import { BsPlus, BsX } from 'react-icons/bs';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import './CreatePostModal.css';

// 自定义图片上传命令
const imageUploadCommand = {
  name: 'upload-image',
  keyCommand: 'upload-image',
  buttonProps: { 'aria-label': '上传图片', title: '上传图片' },
  icon: (
    <svg width="12" height="12" viewBox="0 0 20 20">
      <path fill="currentColor" d="M15 9c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-7H1c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h18c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm-1 13l-6-5-2 2-4-5-4 8V4h16v11z"/>
    </svg>
  ),
  execute: (state, api) => {
    selectAndUploadImage((status) => {
      if (status === 'uploading') {
        console.log('上传中...');
      }
    }).then((url) => {
      const modifyText = `![image](${url})`;
      api.replaceSelection(modifyText);
    }).catch((error) => {
      alert(`上传失败: ${error.message}`);
    });
  },
};

function CreatePostModal({ onClose, onSubmit, user }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setLoadingTopics(true);
    try {
      const data = await getTopics();
      setTopics(data);
    } catch (err) {
      console.error('Failed to load topics', err);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleTopicToggle = (topicId) => {
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(selectedTopics.filter(id => id !== topicId));
    } else {
      if (selectedTopics.length >= 3) {
        alert('最多只能选择 3 个话题');
        return;
      }
      setSelectedTopics([...selectedTopics, topicId]);
    }
  };

  const handleCreateNewTopic = async () => {
    if (!newTopicName.trim()) return;
    try {
      const newTopic = await createTopic({ name: newTopicName, icon: '💬' });
      setTopics([...topics, newTopic]);
      if (selectedTopics.length < 3) {
        setSelectedTopics([...selectedTopics, newTopic.id]);
      }
      setShowNewTopicInput(false);
      setNewTopicName('');
    } catch (err) {
      alert('创建话题失败: ' + (err.response?.data?.message || err.message));
    }
  };

  // 处理粘贴图片
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 检查是否为图片
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault(); // 阻止默认粘贴行为
        
        const file = item.getAsFile();
        if (!file) continue;

        try {
          console.log('正在上传图片...');
          const url = await uploadImageToImgBB(file);
          
          // 获取当前光标位置
          const textarea = e.target;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const currentContent = content || '';
          
          // 在光标位置插入图片
          const imageMarkdown = `![image](${url})`;
          const newContent = 
            currentContent.substring(0, start) + 
            imageMarkdown + 
            currentContent.substring(end);
          
          setContent(newContent);
          
          // 设置新的光标位置（图片 Markdown 之后）
          setTimeout(() => {
            const newPosition = start + imageMarkdown.length;
            textarea.setSelectionRange(newPosition, newPosition);
            textarea.focus();
          }, 0);
          
        } catch (error) {
          console.error('粘贴图片上传失败:', error);
          alert(`图片上传失败: ${error.message}`);
        }
        
        break; // 只处理第一张图片
      }
    }
  };

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
      topics: selectedTopics
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

          {/* Topic Selection */}
          <div className="form-group topic-selector-group">
            <label>选择话题 (最多3个):</label>
            <div className="topic-tags-container">
              {topics.map(topic => (
                <button
                  key={topic.id}
                  type="button"
                  className={`topic-tag ${selectedTopics.includes(topic.id) ? 'active' : ''}`}
                  onClick={() => handleTopicToggle(topic.id)}
                >
                  {topic.icon} {topic.name}
                </button>
              ))}
              
              {!showNewTopicInput ? (
                <button 
                  type="button" 
                  className="topic-tag new-topic-btn"
                  onClick={() => setShowNewTopicInput(true)}
                >
                  <BsPlus /> 新话题
                </button>
              ) : (
                <div className="new-topic-input-wrapper">
                  <input 
                    type="text" 
                    placeholder="话题名称" 
                    value={newTopicName}
                    onChange={e => setNewTopicName(e.target.value)}
                    className="new-topic-input"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateNewTopic();
                      }
                    }}
                  />
                  <button type="button" onClick={handleCreateNewTopic} className="confirm-btn">确定</button>
                  <button type="button" onClick={() => setShowNewTopicInput(false)} className="cancel-btn-small"><BsX /></button>
                </div>
              )}
            </div>
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
            <MDEditor
              value={content}
              onChange={setContent}
              preview="edit"
              hideToolbar={false}
              textareaProps={{
                onPaste: handlePaste
              }}
              commands={[
                commands.bold,
                commands.italic,
                commands.strikethrough,
                commands.hr,
                commands.title,
                commands.divider,
                commands.link,
                imageUploadCommand,
                commands.code,
                commands.codeBlock,
                commands.divider,
                commands.quote,
                commands.unorderedListCommand,
                commands.orderedListCommand,
              ]}
              extraCommands={[
                commands.fullscreen,
              ]}
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
