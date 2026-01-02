import { useState, useEffect } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { selectAndUploadImage, uploadImageToImgBB } from '../utils/imageUpload';
import { getTopics, createTopic, getUserFollowedTopics } from '../api';
import { BsPlus, BsX } from 'react-icons/bs';
import PinyinMatch from 'pinyin-match';
import { pinyin } from 'pinyin-pro';
import { useMention } from '../hooks/useMention';
import MentionList from './MentionList';
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

function CreatePostModal({ onClose, onSubmit, user, initialTopic }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [followedTopics, setFollowedTopics] = useState([]);

  // Mention Logic
  const { 
    results: mentionResults, 
    checkMention, 
    insertMention 
  } = useMention();

  const handleContentChange = (val) => {
    setContent(val);
    checkMention(val);
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setLoadingTopics(true);
    try {
      const [allTopics, userFollowed] = await Promise.all([
        getTopics(),
        user ? getUserFollowedTopics(user.id) : Promise.resolve([])
      ]);
      
      setTopics(allTopics);
      setFollowedTopics(userFollowed);
      
      if (initialTopic) {
        const preSelected = allTopics.find(t => t.id === initialTopic || t.id === parseInt(initialTopic));
        if (preSelected) {
          setSelectedTopics([preSelected]);
        }
      }
    } catch (err) {
      console.error('Failed to load topics', err);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleSelectTopic = (topic) => {
    if (selectedTopics.find(t => t.id === topic.id)) return;
    
    if (selectedTopics.length >= 3) {
      alert('最多只能选择 3 个话题');
      return;
    }
    
    setSelectedTopics([...selectedTopics, topic]);
    setTopicSearch('');
    setShowSuggestions(false);
  };

  const handleRemoveTopic = (topicId) => {
    setSelectedTopics(selectedTopics.filter(t => t.id !== topicId));
  };

  const handleCreateTopic = () => {
    const name = topicSearch.trim();
    if (!name) return;
    
    // Check if already exists in fetched topics
    const existing = topics.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      handleSelectTopic(existing);
      return;
    }

    // Check if already in selectedTopics as a new topic
    const existingNew = selectedTopics.find(t => t.name.toLowerCase() === name.toLowerCase() && t.isNew);
    if (existingNew) return;

    // Create a temporary topic object
    const newTopic = { 
      id: `new-${Date.now()}`, 
      name, 
      icon: '💬', 
      isNew: true 
    };
    
    handleSelectTopic(newTopic);
  };

  const filteredTopics = topics.filter(topic => {
    if (!topicSearch) return false;
    if (selectedTopics.find(t => t.id === topic.id)) return false;

    // 1. 标准匹配 (拼音/汉字/首字母)
    const match = PinyinMatch.match(topic.name, topicSearch);
    if (match) return true;

    // 2. 同音字模糊搜索 (将输入转换为拼音后再匹配)
    // 例如：输入 "至" (zhi) -> 匹配 "滞纳" (zhi na)
    if (/[\u4e00-\u9fa5]/.test(topicSearch)) {
      try {
        const inputPinyin = pinyin(topicSearch, { toneType: 'none', type: 'array' }).join('');
        if (inputPinyin && inputPinyin !== topicSearch) {
           return PinyinMatch.match(topic.name, inputPinyin);
        }
      } catch (e) {
        // 忽略转换错误
      }
    }

    return false;
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (title.trim().length < 10) {
      alert('帖子标题最低不少于10个字');
      return;
    }
    
    if (content.trim().length < 5) {
      alert('内容不少于5个字');
      return;
    }

    // Process topics: create new ones if necessary
    const finalTopicIds = [];
    for (const topic of selectedTopics) {
      if (topic.isNew) {
        try {
          const created = await createTopic({ name: topic.name, icon: topic.icon });
          finalTopicIds.push(created.id);
        } catch (err) {
          alert(`创建话题 "${topic.name}" 失败: ${err.message}`);
          return; // Stop submission
        }
      } else {
        finalTopicIds.push(topic.id);
      }
    }
    
    const postData = {
      title: title.trim(),
      content: content.trim(),
      topics: finalTopicIds
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
            
            <div className="topic-selector-wrapper">
              {/* 已关注话题推荐 */}
              {followedTopics.length > 0 && !topicSearch && selectedTopics.length < 3 && (
                <div className="followed-topics-recommendation" style={{ marginBottom: '10px' }}>
                  <span className="recommendation-label" style={{ fontSize: '12px', color: '#666', marginRight: '8px' }}>已加入:</span>
                  <div className="recommendation-list" style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
                    {followedTopics.map(topic => {
                      const isSelected = selectedTopics.find(t => t.id === topic.id || t.id === topic._id);
                      return (
                        <button
                          type="button"
                          key={topic.id || topic._id}
                          className={`topic-tag recommendation ${isSelected ? 'selected' : ''}`}
                          onClick={() => !isSelected && handleSelectTopic(topic)}
                          disabled={isSelected}
                          style={{
                            background: isSelected ? '#e6f7ff' : '#f5f5f5',
                            border: isSelected ? '1px solid #1890ff' : '1px solid #d9d9d9',
                            color: isSelected ? '#1890ff' : '#666',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            cursor: isSelected ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {topic.icon && (topic.icon.startsWith('http') ? (
                            <img src={topic.icon} alt="" style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover' }} />
                          ) : (
                            <span>{topic.icon}</span>
                          ))}
                          <span>{topic.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="selected-topics-list">
                {selectedTopics.map(topic => (
                  <span key={topic.id} className="selected-topic-tag">
                    {topic.icon && (topic.icon.startsWith('http') ? (
                      <img src={topic.icon} alt="" style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover', marginRight: '4px' }} />
                    ) : (
                      <span style={{ marginRight: '4px' }}>{topic.icon}</span>
                    ))}
                    {topic.name}
                    <button 
                      type="button" 
                      className="remove-topic-btn"
                      onClick={() => handleRemoveTopic(topic.id)}
                    >
                      <BsX />
                    </button>
                  </span>
                ))}
                
                {selectedTopics.length < 3 && (
                  <div className="topic-input-container">
                    <input
                      type="text"
                      className="topic-search-input"
                      placeholder={selectedTopics.length === 0 ? "搜索或创建话题..." : "添加更多话题..."}
                      value={topicSearch}
                      onChange={(e) => {
                        setTopicSearch(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredTopics.length > 0) {
                            handleSelectTopic(filteredTopics[0]);
                          } else {
                            handleCreateTopic();
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {showSuggestions && topicSearch && (
                <div className="topic-suggestions-dropdown">
                  {filteredTopics.map(topic => (
                    <div 
                      key={topic.id} 
                      className="suggestion-item"
                      onClick={() => handleSelectTopic(topic)}
                    >
                      <span className="topic-icon">
                        {topic.icon && (topic.icon.startsWith('http') ? (
                          <img src={topic.icon} alt="" style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover' }} />
                        ) : (
                          topic.icon
                        ))}
                      </span>
                      <span className="topic-name">{topic.name}</span>
                    </div>
                  ))}
                  
                  {topicSearch.trim() && !filteredTopics.find(t => t.name.toLowerCase() === topicSearch.trim().toLowerCase()) && (
                    <div 
                      className="suggestion-item create-new"
                      onClick={handleCreateTopic}
                    >
                      <BsPlus className="icon" />
                      <span>创建话题: <strong>{topicSearch}</strong></span>
                    </div>
                  )}
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
            <div style={{ position: 'relative' }}>
              <MDEditor
                value={content}
                onChange={handleContentChange}
                preview="edit"
                height={300}
                visibleDragbar={false}
                hideToolbar={false}
                textareaProps={{
                  placeholder: '分享你的想法...'
                }}
                commands={[
                  commands.bold,
                  commands.italic,
                  commands.strikethrough,
                  commands.hr,
                  commands.divider,
                  commands.link,
                  imageUploadCommand,
                  commands.divider,
                  commands.codeBlock,
                  commands.quote,
                  commands.divider,
                  commands.unorderedListCommand,
                  commands.orderedListCommand,
                ]}
              />
              <MentionList 
                results={mentionResults} 
                onSelect={(user) => insertMention(user, content, setContent)}
                style={{ bottom: '100%', left: 0 }}
              />
            </div>
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
