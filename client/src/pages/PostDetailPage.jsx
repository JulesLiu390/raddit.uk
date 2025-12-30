import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SimpleEmojiPicker from '../components/SimpleEmojiPicker';
import MDEditor, { commands } from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import ReactionBurst from '../components/ReactionBurst';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { selectAndUploadImage, uploadImageToImgBB } from '../utils/imageUpload';
import { 
  BsCheckCircleFill, 
  BsChatText, 
  BsShare, 
  BsStar, 
  BsStarFill,
  BsHeart, 
  BsThreeDots, 
  BsPencilSquare, 
  BsPersonPlus, 
  BsHandThumbsUp,
  BsPencil,
  BsEmojiSmile,
  BsPlus,
  BsCaretDownFill,
  BsTrash
} from 'react-icons/bs';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { getPost, getPostMessages, createMessage, toggleFollowPost, deleteMessage, reactToMessage, incrementPostView } from '../api';
import './PostDetailPage.css';
import customSticker1 from '../assets/customSticker1.png';

// --- 自定义表情配置 ---
const CUSTOM_REACTION_KEY = 'custom_sticker_1';
const CUSTOM_REACTION_URL = customSticker1;
// --------------------

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
        // 可以添加loading提示
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

const CommentNode = ({ 
  message, 
  user, 
  replyTarget, 
  setReplyTarget, 
  replyContent, 
  setReplyContent, 
  submitting, 
  handleSubmitAnswer,
  handleReaction,
  handleDeleteMessage
}) => {
  const navigate = useNavigate();
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

  const onEmojiSelect = (emoji, e) => {
    handleReaction(message.id, emoji, e);
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
            onClick={(e) => handleReaction(message.id, emoji, e)}
          >
            {emoji === CUSTOM_REACTION_KEY ? (
              <img 
                src={CUSTOM_REACTION_URL} 
                alt="custom" 
                style={{ width: '18px', height: '18px', objectFit: 'contain', marginRight: '4px', verticalAlign: 'text-bottom' }} 
              />
            ) : (
              <span className="emoji">{emoji}</span>
            )}
            <span className="count">{userIds.length}</span>
          </button>
        ))}

        {/* Preset Buttons (always show if no reactions, or just append) */}
        {/* User asked for preset 😍 and 🤮 buttons. Let's show them if not already reacted with them? 
            Or just have them as quick actions next to the pills? 
            Let's put them as quick actions if not present in the pills to save space, 
            or just rely on the picker. 
            The prompt says "Preset 😍 and 🤮 buttons". 
            Let's add them as small icon buttons if they aren't already in the pills.
        */}
        {!reactions['😍'] && (
          <button className="reaction-preset" onClick={(e) => handleReaction(message.id, '😍', e)}>
            😍
          </button>
        )}
        {!reactions['🤮'] && (
          <button className="reaction-preset" onClick={(e) => handleReaction(message.id, '🤮', e)}>
            🤮
          </button>
        )}
        {/* 自定义图片预设按钮 */}
        {!reactions[CUSTOM_REACTION_KEY] && (
          <button className="reaction-preset" onClick={(e) => handleReaction(message.id, CUSTOM_REACTION_KEY, e)}>
            <img 
              src={CUSTOM_REACTION_URL} 
              alt="custom" 
              style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }} 
            />
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
            onClick={() => message.authorId && navigate(`/profile/${message.authorId}`)}
            style={{ cursor: message.authorId ? 'pointer' : 'default' }}
          />
          <div className="author-info">
            <div className="author-name-row">
              <span 
                className="author-name"
                onClick={() => message.authorId && navigate(`/profile/${message.authorId}`)}
                style={{ cursor: message.authorId ? 'pointer' : 'default' }}
              >
                {message.author}
              </span>
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
            onClick={() => message.authorId && navigate(`/profile/${message.authorId}`)}
            style={{ cursor: message.authorId ? 'pointer' : 'default' }}
          />
          <div className="author-info">
            <div 
              className="author-name"
              onClick={() => message.authorId && navigate(`/profile/${message.authorId}`)}
              style={{ cursor: message.authorId ? 'pointer' : 'default' }}
            >
              {message.author}
              {message.isVerified && <BsCheckCircleFill className="verified-badge" />}
            </div>
            {message.replyToUserId && (
              <div className="reply-to">回复 @{message.replyToName || message.replyToUserId}</div>
            )}
            {message.authorBio && <div className="author-bio">{message.authorBio}</div>}
          </div>
          {user && message.authorId !== user.id && (
            <button className="follow-btn" onClick={() => alert('关注用户功能开发中')}>+ 关注</button>
          )}
        </div>
      )}

      <div className={`answer-content ${isNested ? 'compact' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
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
          className={`action-btn ${replyTarget && replyTarget.id === message.id ? 'active' : ''}`}
          onClick={() => {
            if (!canReply) return;
            if (replyTarget && replyTarget.id === message.id) {
              setReplyTarget(null);
              setReplyContent('');
            } else {
              setReplyTarget(message);
              setReplyContent('');
            }
          }} 
          disabled={!canReply}
        >
          <BsChatText />
          <span>{replyTarget && replyTarget.id === message.id ? '取消回复' : (isNested ? '回复' : '回复')}</span>
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

        {(user?.role === 'admin' || user?.id === message.authorId) && (
          <button 
            className="action-btn delete-btn" 
            onClick={() => handleDeleteMessage(message.id)}
            style={{ color: '#ff4d4f' }}
          >
            <BsTrash />
            <span>删除</span>
          </button>
        )}

        <div className={isNested ? "more-actions" : "more-action"}>
          <BsThreeDots className="more-btn" />
        </div>
      </div>

      {/* 楼中楼输入框 */}
      {replyTarget && replyTarget.id === message.id && (
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
              textareaProps={{
                onPaste: (e) => handlePaste(e, setReplyContent)
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
                  handleDeleteMessage={handleDeleteMessage}
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
  
  // State for custom reaction burst
  const [burstState, setBurstState] = useState({ active: false, x: 0, y: 0 });

  useEffect(() => {
    if (post && user) {
      setFollowingPost(post.followers?.includes(user.id));
    }
  }, [post, user]);

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
    // Increment view count
    incrementPostView(id).catch(err => console.error('Failed to increment view:', err));
  }, [id]);

  useEffect(() => {
    if (post && post.title) {
      const title = post.title.length > 20 ? post.title.substring(0, 20) + '...' : post.title;
      document.title = title;
    }
  }, [post]);

  const handleFollowPost = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    try {
      const data = await toggleFollowPost(id);
      setFollowingPost(data.isFollowing);
      // Update local post object to reflect follower count change if needed
      setPost(prev => ({
        ...prev,
        followers: data.isFollowing 
          ? [...(prev.followers || []), user.id]
          : (prev.followers || []).filter(uid => uid !== user.id)
      }));
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      alert('操作失败，请重试');
    }
  };

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
      // Ensure each message has an id property, compatible with backend returning _id
      const processedData = data.map(msg => ({
        ...msg,
        id: msg.id || msg._id
      }));
      setMessages(processedData);
    } catch (err) {
      console.error('获取评论失败:', err);
    }
  };

  // 处理粘贴图片
  const handlePaste = async (e, setContent) => {
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
          
          // 获取当前内容
          const currentContent = textarea.value || '';
          
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

  const triggerEmojiExplosion = (x, y, emojiChar, targetElement) => {
    // 如果是自定义图片表情
    if (emojiChar === CUSTOM_REACTION_KEY) {
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        // Calculate center of the button
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        setBurstState({ 
          active: true, 
          x: centerX, 
          y: centerY 
        });
      }
      return;
    }

    const scalar = 2;
    const shape = confetti.shapeFromText({ text: emojiChar, scalar });
    
    confetti({
      particleCount: 15,
      scalar,
      spread: 40,
      origin: { x, y },
      shapes: [shape],
      gravity: 0.8,
      drift: 0,
      ticks: 60,
      startVelocity: 10
    });
  };

  const handleReaction = async (targetId, emoji, e) => {
    // Trigger explosion if event exists
    if (e && user) {
      // Check if we are adding or removing (optimistic check)
      const msg = messages.find(m => m.id === targetId);
      const currentReactions = msg?.reactions?.[emoji] || [];
      const isAdding = !currentReactions.includes(user.id);
      
      if (isAdding) {
        // Calculate position
        let x, y;
        if (e.clientX && e.clientY) {
          x = e.clientX / window.innerWidth;
          y = e.clientY / window.innerHeight;
        } else {
          const rect = e.target.getBoundingClientRect();
          x = (rect.left + rect.width / 2) / window.innerWidth;
          y = (rect.top + rect.height / 2) / window.innerHeight;
        }
        triggerEmojiExplosion(x, y, emoji, e.currentTarget);
      }
    }

    try {
      // Optimistic update (optional, but good for UX)
      // For now, let's just wait for server response to keep state simple
      
      const token = localStorage.getItem('raddit-token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('https://raddit.uk:8443/api/react', {
        method: 'POST',
        headers: headers,
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

  const handleDeletePost = async () => {
    if (!window.confirm('确定要删除这个帖子吗？此操作不可恢复。')) return;
    try {
      await deletePost(id);
      navigate('/');
    } catch (err) {
      console.error('删除帖子失败:', err);
      alert('删除失败，请重试');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('确定要删除这条评论吗？')) return;
    try {
      await deleteMessage(messageId);
      // Refresh messages
      await fetchMessages();
    } catch (err) {
      console.error('删除评论失败:', err);
      alert('删除失败，请重试');
    }
  };

  const handlePostReaction = async (emoji, e) => {
    // Trigger explosion if event exists
    if (e && user) {
      const currentReactions = post?.reactions?.[emoji] || [];
      const isAdding = !currentReactions.includes(user.id);
      
      if (isAdding) {
        let x, y;
        if (e.clientX && e.clientY) {
          x = e.clientX / window.innerWidth;
          y = e.clientY / window.innerHeight;
        } else {
          const rect = e.target.getBoundingClientRect();
          x = (rect.left + rect.width / 2) / window.innerWidth;
          y = (rect.top + rect.height / 2) / window.innerHeight;
        }
        triggerEmojiExplosion(x, y, emoji, e.currentTarget);
      }
    }

    try {
      const token = localStorage.getItem('raddit-token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('https://raddit.uk:8443/api/react', {
        method: 'POST',
        headers: headers,
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
      
      <ReactionBurst 
        x={burstState.x} 
        y={burstState.y} 
        isActive={burstState.active} 
        imageSrc={CUSTOM_REACTION_URL}
        onComplete={() => setBurstState(prev => ({ ...prev, active: false }))}
      />

      {/* 滚动时显示的标题栏 */}
      {isScrolled && (
        <div className="floating-title-bar">
          <div className="floating-title-content">
            <span className="floating-title-text">{post.title}</span>
            <div className="floating-actions">
              <button 
                className={`floating-btn primary ${followingPost ? 'following' : ''}`}
                onClick={handleFollowPost}
              >
                {followingPost ? '已关注' : '关注问题'}
              </button>
              <button className="floating-btn secondary" onClick={() => setShowAnswerForm(!showAnswerForm)}>
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
            {/* Topics Tags */}
            {post.topics && post.topics.length > 0 && (
              <div className="post-topics" style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                {post.topics.map(topic => (
                  <span 
                    key={topic.id} 
                    className="topic-tag-pill"
                    onClick={() => navigate(`/topic/${topic.id}`)}
                    style={{
                      background: '#eef6fc',
                      color: '#0079d3',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#e0effa'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#eef6fc'}
                  >
                    {topic.name}
                  </span>
                ))}
              </div>
            )}

            <h1 className="post-detail-title">{post.title}</h1>
            
            {/* 帖子作者信息 */}
            <div className="post-author-info" style={{ marginBottom: '20px' }}>
              <div className="answer-author" style={{ marginBottom: 0 }}>
                <img 
                  src={post.authorAvatar || 'https://picsum.photos/40/40?random=1'} 
                  alt="avatar" 
                  className="author-avatar" 
                  onClick={() => post.authorId && navigate(`/profile/${post.authorId}`)}
                  style={{ cursor: post.authorId ? 'pointer' : 'default' }}
                />
                <div className="author-info">
                  <div 
                    className="author-name"
                    onClick={() => post.authorId && navigate(`/profile/${post.authorId}`)}
                    style={{ cursor: post.authorId ? 'pointer' : 'default' }}
                  >
                    {post.author}
                  </div>
                  <div className="post-time" style={{ fontSize: '14px', color: '#8590a6', marginTop: '4px' }}>
                    发布于 {new Date(post.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                {user && post.authorId !== user.id && (
                  <button className="follow-btn" onClick={() => alert('关注用户功能开发中')}>+ 关注</button>
                )}
              </div>
            </div>

            {/* 帖子内容 */}
            {post.content && (
              <div className="post-content markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                  {post.content}
                </ReactMarkdown>
              </div>
            )}
            
            <div className="post-meta-bar">
              <button 
                className={`meta-btn ${followingPost ? 'active' : ''}`} 
                onClick={handleFollowPost}
                style={{ color: followingPost ? '#0079d3' : 'inherit' }}
              >
                {followingPost ? <BsStarFill className="icon" /> : <BsStar className="icon" />}
                {followingPost ? '已关注' : '关注问题'}
              </button>
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
                      onClick={(e) => handlePostReaction(emoji, e)}
                    >
                      {emoji === CUSTOM_REACTION_KEY ? (
                        <img 
                          src={CUSTOM_REACTION_URL} 
                          alt="custom" 
                          style={{ width: '18px', height: '18px', objectFit: 'contain', marginRight: '4px', verticalAlign: 'text-bottom' }} 
                        />
                      ) : (
                        <span className="emoji">{emoji}</span>
                      )}
                      <span className="count">{userIds.length}</span>
                    </button>
                  ))}

                  {/* Preset Buttons */}
                  {(!post.reactions || !post.reactions['😍']) && (
                    <button className="reaction-preset" onClick={(e) => handlePostReaction('😍', e)}>
                      😍
                    </button>
                  )}
                  {(!post.reactions || !post.reactions['🤮']) && (
                    <button className="reaction-preset" onClick={(e) => handlePostReaction('🤮', e)}>
                      🤮
                    </button>
                  )}
                  {/* 自定义图片预设按钮 */}
                  {(!post.reactions || !post.reactions[CUSTOM_REACTION_KEY]) && (
                    <button className="reaction-preset" onClick={(e) => handlePostReaction(CUSTOM_REACTION_KEY, e)}>
                      <img 
                        src={CUSTOM_REACTION_URL} 
                        alt="custom" 
                        style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }} 
                      />
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
                          onEmojiSelect={(emoji, e) => {
                            handlePostReaction(emoji, e);
                            setShowPostPicker(false);
                          }}
                          onClose={() => setShowPostPicker(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button className="meta-btn outline">
                <BsShare className="icon" />
                <span>分享</span>
              </button>
              
              {(user?.role === 'admin' || user?.id === post.authorId) && (
                <button className="meta-btn delete-btn" onClick={handleDeletePost} style={{ color: '#ff4d4f' }}>
                  <BsTrash className="icon" />
                  <span>删除</span>
                </button>
              )}
              
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
                  textareaProps={{
                    onPaste: (e) => handlePaste(e, setAnswerContent)
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
                handleDeleteMessage={handleDeleteMessage}
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
