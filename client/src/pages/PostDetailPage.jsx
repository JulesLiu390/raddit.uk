import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SimpleEmojiPicker from '../components/SimpleEmojiPicker';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { 
  BsCheckCircleFill, 
  BsChatText, 
  BsShare, 
  BsStar, 
  BsHeart, 
  BsThreeDots, 
  BsPencilSquare, 
  BsPersonPlus, 
  BsHandThumbsUp,
  BsPencil,
  BsEmojiSmile,
  BsPlus,
  BsCaretDownFill
} from 'react-icons/bs';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { getPostMessages, createMessage } from '../api';
import './PostDetailPage.css';

const CommentNode = ({ 
  message, 
  user, 
  replyTarget, 
  setReplyTarget, 
  replyContent, 
  setReplyContent, 
  submitting, 
  handleSubmitAnswer,
  handleReaction
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);
  
  const hasChildren = message.children && message.children.length > 0;
  const depth = message.depth || (message.parentId ? 2 : 1);
  const canReply = depth < 3;
  const isNested = depth > 1;

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onEmojiSelect = (emoji) => {
    handleReaction(message.id, emoji);
    setShowPicker(false);
  };

  const renderReactions = () => {
    const reactions = message.reactions || {};
    // If no reactions, show presets
    const hasReactions = Object.keys(reactions).length > 0;
    
    return (
      <div className="reaction-bar">
        {/* Existing Reactions Pills */}
        {Object.entries(reactions).map(([emoji, userIds]) => (
          <button 
            key={emoji} 
            className={`reaction-pill ${userIds.includes(user?.id) ? 'active' : ''}`}
            onClick={() => handleReaction(message.id, emoji)}
          >
            <span className="emoji">{emoji}</span>
            <span className="count">{userIds.length}</span>
          </button>
        ))}

        {/* Preset Buttons (always show if no reactions, or just append) */}
        {/* User asked for preset 😍 and 🤮 buttons. Let's show them if not already reacted with them? 
            Or just have them as quick actions next to the pills? 
            Let's put them as quick actions if not present in pills to save space, 
            or just rely on the picker. 
            The prompt says "Preset 😍 and 🤮 buttons". 
            Let's add them as small icon buttons if they aren't already in the pills.
        */}
        {!reactions['😍'] && (
          <button className="reaction-preset" onClick={() => handleReaction(message.id, '😍')}>
            😍
          </button>
        )}
        {!reactions['🤮'] && (
          <button className="reaction-preset" onClick={() => handleReaction(message.id, '🤮')}>
            🤮
          </button>
        )}

        {/* Add Reaction Button */}
        <div className="reaction-picker-container" ref={pickerRef}>
          <button 
            className="reaction-add-btn"
            onClick={() => setShowPicker(!showPicker)}
            title="添加回应"
          >
            <BsPlus />
          </button>
          {showPicker && (
            <div className="emoji-picker-popup">
              <SimpleEmojiPicker 
                onEmojiSelect={onEmojiSelect}
                onClose={() => setShowPicker(false)}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`answer-card ${isNested ? 'nested-comment' : ''}`}>
      {isNested ? (
        /* Compact Header for Nested Comments */
        <div className="answer-author compact">
          <img 
            src={message.authorAvatar || 'https://picsum.photos/40/40?random=1'} 
            alt="avatar" 
            className="author-avatar small" 
          />
          <div className="author-info">
            <div className="author-name-row">
              <span className="author-name">{message.author}</span>
              {message.isVerified && <BsCheckCircleFill className="verified-badge" />}
              {message.replyToUserId && (
                <span className="reply-to">回复 @{message.replyToName || message.replyToUserId}</span>
              )}
            </div>
            <div className="post-time-simple">
              {new Date(message.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      ) : (
        /* Standard Header for Top-level Replies */
        <div className="answer-author">
          <img 
            src={message.authorAvatar || 'https://picsum.photos/40/40?random=1'} 
            alt="avatar" 
            className="author-avatar" 
          />
          <div className="author-info">
            <div className="author-name">
              {message.author}
              {message.isVerified && <BsCheckCircleFill className="verified-badge" />}
            </div>
            {message.replyToUserId && (
              <div className="reply-to">回复 @{message.replyToName || message.replyToUserId}</div>
            )}
            {message.authorBio && <div className="author-bio">{message.authorBio}</div>}
          </div>
          <button className="follow-btn">+ 关注</button>
        </div>
      )}

      <div className={`answer-content ${isNested ? 'compact' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>

      {!isNested && (
        <div className="answer-meta">
          <span className="publish-time">发布于 {new Date(message.createdAt).toLocaleString('zh-CN')}</span>
        </div>
      )}

      <div className={`answer-actions ${isNested ? 'compact' : ''}`}>
        {/* Replace Upvote Button with Reaction System */}
        <div className="reaction-system-wrapper">
          {renderReactions()}
        </div>

        <button 
          className="action-btn" 
          onClick={() => {
            if (!canReply) return;
            setReplyTarget(message);
            setReplyContent('');
          }} 
          disabled={!canReply}
        >
          <BsChatText />
          <span>{isNested ? '回复' : '回复'}</span>
        </button>
        
        {!isNested && (
          <>
            <button className="action-btn">
              <BsShare />
              <span>分享</span>
            </button>
            <button className="action-btn">
              <BsStar />
              <span>收藏</span>
            </button>
            <button className="action-btn">
              <BsHeart />
              <span>喜欢</span>
            </button>
          </>
        )}

        <div className={isNested ? "more-actions" : "more-action"}>
          <BsThreeDots className="more-btn" />
        </div>
      </div>

      {/* 楼中楼输入框 */}
      {replyTarget?.id === message.id && (
        <div className={`inline-reply-box ${isNested ? 'compact' : ''}`}>
          <div className="identity-hint" style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}>
            {user ? (
              <div className="user-identity" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={user.picture} alt={user.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                <span>回复 @{message.author}</span>
              </div>
            ) : (
              <div className="ip-identity">
                <span>未登录，IP 将作为你的 ID</span>
              </div>
            )}
          </div>
          <form onSubmit={(e) => handleSubmitAnswer(e, message)}>
            <MDEditor
              value={replyContent}
              onChange={setReplyContent}
              preview="edit"
              height={150}
              visibleDragbar={false}
              hideToolbar={false}
              autoFocus
              disabled={submitting}
            />
            <div className="answer-form-actions">
              <button type="button" className="cancel-btn" onClick={() => {
                setReplyTarget(null);
                setReplyContent('');
              }} disabled={submitting}>取消</button>
              <button type="submit" className="submit-btn" disabled={submitting || !replyContent.trim()}>
                {submitting ? '发布中...' : '发布回复'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 子回复 */}
      {hasChildren && (
        <div className="comment-children-container">
          {!expanded ? (
            <button className="expand-replies-btn" onClick={() => setExpanded(true)}>
              展开 {message.children.length} 条回复
            </button>
          ) : (
            <div className="comment-children">
              {message.children.map(child => (
                <CommentNode 
                  key={child.id} 
                  message={child}
                  user={user}
                  replyTarget={replyTarget}
                  setReplyTarget={setReplyTarget}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  submitting={submitting}
                  handleSubmitAnswer={handleSubmitAnswer}
                  handleReaction={handleReaction}
                />
              ))}
              <button className="collapse-replies-btn" onClick={() => setExpanded(false)}>
                收起回复
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function PostDetailPage({ user, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [sortBy, setSortBy] = useState('time'); // 'time' or 'heat'
  const [onlyAuthor, setOnlyAuthor] = useState(false);
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [answerContent, setAnswerContent] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPostPicker, setShowPostPicker] = useState(false);
  const [followingPost, setFollowingPost] = useState(false);
  const postPickerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (postPickerRef.current && !postPickerRef.current.contains(event.target)) {
        setShowPostPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchPost();
    fetchMessages();
  }, [id]);

  useEffect(() => {
    if (post && post.title) {
      const title = post.title.length > 20 ? post.title.substring(0, 20) + '...' : post.title;
      document.title = title;
    }
  }, [post]);

  const fetchPost = async () => {
    try {
      const response = await fetch(`https://raddit.uk:8443/api/posts/${id}`);
      const data = await response.json();
      setPost(data);
    } catch (err) {
      console.error('获取帖子失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await getPostMessages(id);
      setMessages(data);
    } catch (err) {
      console.error('获取评论失败:', err);
    }
  };

  const handleSubmitAnswer = async (e, target = null) => {
    e.preventDefault();
    const content = target ? replyContent : answerContent;
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const messageData = {
        content: content.trim(),
      };

      if (user) {
        messageData.author = user.name;
        messageData.authorAvatar = user.picture;
        messageData.authorId = user.id;
      }

      if (target?.id) {
        messageData.parentId = target.id;
      }

      await createMessage(id, messageData);
      if (target) {
        setReplyContent('');
        setReplyTarget(null);
      } else {
        setAnswerContent('');
        setShowAnswerForm(false);
      }
      // 重新获取消息列表
      await fetchMessages();
    } catch (err) {
      console.error('提交回答失败:', err);
      alert('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (targetId, emoji) => {
    try {
      // Optimistic update (optional, but good for UX)
      // For now, let's just wait for server response to keep state simple
      
      const response = await fetch('https://raddit.uk:8443/api/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId,
          type: 'message',
          emoji,
          userId: user?.id
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessages(prev => {
          // Helper to update nested messages
          const updateMessageInTree = (list) => {
            return list.map(msg => {
              if (msg.id === targetId) {
                return { ...msg, reactions: data.reactions, upvotes: data.upvotes };
              }
              // We don't need to traverse children here because messages is a flat list 
              // that gets built into a tree by buildThreads().
              // However, if we were updating the tree directly we would.
              // But wait, `messages` state is flat list from `getPostMessages`.
              // `buildThreads` is called during render.
              // So just updating the flat list is enough!
              return msg;
            });
          };
          return updateMessageInTree(prev);
        });
      }
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  const handlePostReaction = async (emoji) => {
    try {
      const response = await fetch('https://raddit.uk:8443/api/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: post.id,
          type: 'post',
          emoji,
          userId: user?.id
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setPost(prev => ({ ...prev, reactions: data.reactions, upvotes: data.upvotes }));
      }
    } catch (err) {
      console.error('Post reaction failed:', err);
    }
  };

  // 根据排序和筛选条件处理消息
  const getFilteredMessages = () => {
    let filtered = [...messages];

    // 筛选：只看楼主
    if (onlyAuthor && post) {
      filtered = filtered.filter(m => m.author === post.author);
    }

    // 排序
    if (sortBy === 'heat') {
      filtered.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    } else {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return filtered;
  };

  const buildThreads = () => {
    const filtered = getFilteredMessages();
    const map = new Map();
    filtered.forEach(m => {
      map.set(m.id, { ...m, children: [] });
    });

    const roots = [];
    filtered.forEach(m => {
      const node = map.get(m.id);
      if (m.parentId && map.get(m.parentId)) {
        map.get(m.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortFn = (a, b) => {
      if (sortBy === 'heat') {
        return (b.upvotes || 0) - (a.upvotes || 0);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    };

    const sortTree = (list) => {
      list.sort(sortFn);
      list.forEach(n => sortTree(n.children));
    };

    sortTree(roots);
    return roots;
  };

  // 计算一级回复数量（不包括嵌套评论）
  const getTopLevelReplyCount = () => {
    return messages.filter(m => !m.parentId).length;
  };

  const canReply = (message) => {
    const depth = message.depth || (message.parentId ? 2 : 1);
    return depth < 3;
  };

  if (loading) {
    return (
      <div className="post-detail-page">
        <Header user={user} onLogout={onLogout} />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="post-detail-page">
        <Header user={user} onLogout={onLogout} />
        <div className="error-container">
          <p>帖子不存在</p>
          <button onClick={() => navigate('/')}>返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="post-detail-page">
      <Header user={user} onLogout={onLogout} />
      
      {/* 滚动时显示的标题栏 */}
      {isScrolled && (
        <div className="floating-title-bar">
          <div className="floating-title-content">
            <span className="floating-title-text">{post.title}</span>
            <div className="floating-actions">
              <button className="floating-btn primary">关注问题</button>
              <button className="floating-btn secondary">
                <BsPencil style={{ marginRight: '4px' }} />
                写回答
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="post-detail-container">
        <div className="post-detail-main">
          {/* 标题区域 */}
          <div className="post-header">
            <h1 className="post-detail-title">{post.title}</h1>
            
            {/* 帖子作者信息 */}
            <div className="post-author-info" style={{ marginBottom: '20px' }}>
              <div className="answer-author" style={{ marginBottom: 0 }}>
                <img 
                  src={post.authorAvatar || 'https://picsum.photos/40/40?random=1'} 
                  alt="avatar" 
                  className="author-avatar" 
                />
                <div className="author-info">
                  <div className="author-name">
                    {post.author}
                  </div>
                  <div className="post-time" style={{ fontSize: '14px', color: '#8590a6', marginTop: '4px' }}>
                    发布于 {new Date(post.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <button className="follow-btn">+ 关注</button>
              </div>
            </div>

            {/* 帖子内容 */}
            {post.content && (
              <div className="post-content">
                <p>{post.content}</p>
              </div>
            )}
            
            <div className="post-meta-bar">
              <button className="meta-btn" onClick={() => setShowAnswerForm(!showAnswerForm)}>
                <BsPencilSquare className="icon" />
                <span>写回答</span>
              </button>
              
              {/* Post Reactions */}
              <div className="reaction-system-wrapper">
                <div className="reaction-bar">
                  {/* Existing Reactions Pills */}
                  {post.reactions && Object.entries(post.reactions).map(([emoji, userIds]) => (
                    <button 
                      key={emoji} 
                      className={`reaction-pill ${userIds.includes(user?.id) ? 'active' : ''}`}
                      onClick={() => handlePostReaction(emoji)}
                    >
                      <span className="emoji">{emoji}</span>
                      <span className="count">{userIds.length}</span>
                    </button>
                  ))}

                  {/* Preset Buttons */}
                  {(!post.reactions || !post.reactions['😍']) && (
                    <button className="reaction-preset" onClick={() => handlePostReaction('😍')}>
                      😍
                    </button>
                  )}
                  {(!post.reactions || !post.reactions['🤮']) && (
                    <button className="reaction-preset" onClick={() => handlePostReaction('🤮')}>
                      🤮
                    </button>
                  )}

                  {/* Add Reaction Button */}
                  <div className="reaction-picker-container" ref={postPickerRef}>
                    <button 
                      className="reaction-add-btn"
                      onClick={() => setShowPostPicker(!showPostPicker)}
                      title="添加回应"
                    >
                      <BsPlus />
                    </button>
                    {showPostPicker && (
                      <div className="emoji-picker-popup">
                        <SimpleEmojiPicker 
                          onEmojiSelect={handlePostReaction}
                          onClose={() => setShowPostPicker(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                className={`meta-btn outline ${followingPost ? 'active' : ''}`}
                onClick={() => setFollowingPost(!followingPost)}
              >
                <BsStar className="icon" />
                <span>{followingPost ? '已关注' : '关注问题'}</span>
              </button>
              
              <button className="meta-btn outline">
                <BsShare className="icon" />
                <span>分享</span>
              </button>
              <BsThreeDots className="more-btn" />
            </div>
          </div>

          {/* 写回答表单 */}
          {showAnswerForm && (
            <div className="answer-form-card">
              <div className="identity-hint" style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                {user ? (
                  <div className="user-identity" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={user.picture} alt={user.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                    <span>Posting as <strong>{user.name}</strong></span>
                  </div>
                ) : (
                  <div className="ip-identity">
                    <span>Not logged in. Your IP address will be used as your ID.</span>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmitAnswer}>
                <MDEditor
                  value={answerContent}
                  onChange={setAnswerContent}
                  preview="edit"
                  height={200}
                  visibleDragbar={false}
                  hideToolbar={false}
                  disabled={submitting}
                />
                <div className="answer-form-actions">
                  <button type="button" className="cancel-btn" onClick={() => {
                    setShowAnswerForm(false);
                    setAnswerContent('');
                  }} disabled={submitting}>
                    取消
                  </button>
                  <button type="submit" className="submit-btn" disabled={submitting || !answerContent.trim()}>
                    {submitting ? '发布中...' : '发布回答'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 回答数量 */}
          <div className="answers-header">
            <span className="answer-count">{getTopLevelReplyCount()} 个回答</span>
            <div className="answer-controls">
              <div className="sort-dropdown">
                <button className="sort-btn" onClick={() => setSortBy(sortBy === 'time' ? 'heat' : 'time')}>
                  {sortBy === 'time' ? '默认排序' : '热度排序'} <BsCaretDownFill className="icon-dropdown" />
                </button>
                {/* 排序下拉菜单可以后续扩展 */}
              </div>
              <button 
                className={`author-filter-btn ${onlyAuthor ? 'active' : ''}`}
                onClick={() => setOnlyAuthor(!onlyAuthor)}
              >
                只看楼主
              </button>
            </div>
          </div>

          {/* 回答列表（含楼中楼） */}
          <div className="answers-list">
            {buildThreads().map((root) => (
              <CommentNode 
                key={root.id} 
                message={root}
                user={user}
                replyTarget={replyTarget}
                setReplyTarget={setReplyTarget}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                submitting={submitting}
                handleSubmitAnswer={handleSubmitAnswer}
                handleReaction={handleReaction}
              />
            ))}
          </div>
        </div>

        {/* 右侧边栏 */}
        <Sidebar user={user} />
      </main>
    </div>
  );
}

export default PostDetailPage;
