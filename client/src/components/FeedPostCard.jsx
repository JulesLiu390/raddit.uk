import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BsCaretUpFill, BsCaretDownFill, BsChatText, BsShare, BsStar, BsThreeDots, BsPlus, BsFire } from 'react-icons/bs';
import SimpleEmojiPicker from './SimpleEmojiPicker';
import FeedCommentNode from './FeedCommentNode';
import customSticker1 from '../assets/customSticker1.png';
import './FeedPostCard.css';

// --- 自定义表情配置 ---
const CUSTOM_REACTION_KEY = 'custom_sticker_1';
const CUSTOM_REACTION_URL = customSticker1;
// --------------------

// Helper to strip markdown (simple version)
const stripMarkdown = (markdown) => {
  if (!markdown) return '';
  return markdown
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Replace links with text
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
    .replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
    .replace(/`(.+?)`/g, '$1') // Remove inline code
    .replace(/>\s/g, '') // Remove blockquotes
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .substring(0, 140); // Limit length
};

function FeedPostCard({ post, user }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [localReactions, setLocalReactions] = useState(post.reactions || {});
  const [showPicker, setShowPicker] = useState(false);
  const [comments, setComments] = useState([]);
  const [allComments, setAllComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const pickerRef = useRef(null);

  const summary = stripMarkdown(post.content);
  const hasThumbnail = !!post.thumbnail;

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

  const handleReaction = async (emoji, e) => {
    e.stopPropagation();
    if (!user) {
      alert('请先登录');
      return;
    }

    // Optimistic update
    setLocalReactions(prev => {
      const currentUsers = prev[emoji] || [];
      const hasReacted = currentUsers.includes(user.id);
      
      let newUsers;
      if (hasReacted) {
        newUsers = currentUsers.filter(id => id !== user.id);
      } else {
        newUsers = [...currentUsers, user.id];
      }

      const newState = { ...prev };
      if (newUsers.length > 0) {
        newState[emoji] = newUsers;
      } else {
        delete newState[emoji];
      }
      return newState;
    });

    try {
      const token = localStorage.getItem('raddit-token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('https://raddit.uk:8443/api/react', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          targetId: post.id,
          type: 'post',
          emoji,
          userId: user.id
        })
      });
    } catch (err) {
      console.error('Reaction failed:', err);
      // Revert on failure (optional, omitted for brevity)
    }
  };

  const fetchComments = async () => {
    if (comments.length > 0) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`https://raddit.uk:8443/api/posts/${post.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setAllComments(data);
        // Filter top-level comments and limit to 5
        const topLevel = data.filter(msg => !msg.parentId).slice(0, 5);
        setComments(topLevel);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = (e) => {
    e.stopPropagation();
    if (!commentsExpanded) {
      fetchComments();
    }
    setCommentsExpanded(!commentsExpanded);
  };

  const toggleExpand = (e) => {
    // Prevent navigating if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.reaction-picker-container')) return;
    setExpanded(!expanded);
  };

  return (
    <div className={`feed-post-card ${expanded ? 'expanded' : ''}`} onClick={toggleExpand}>
      <h2 className="feed-post-title" onClick={(e) => { e.stopPropagation(); window.open(`/post/${post.id}`, '_blank'); }}>
        {post.title}
      </h2>

      <div className="feed-post-author">
        {post.authorAvatar && (
          <img src={post.authorAvatar} alt={post.author} className="author-avatar-small" />
        )}
        <span className="author-name">{post.author}</span>
        <span className="author-bio">{post.authorBio || '用户'}</span>
        <span className="post-date" style={{ marginLeft: 'auto', color: '#8590a6', fontSize: '12px' }}>
          {new Date(post.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="feed-post-content-wrapper">
        {expanded ? (
          <div className="feed-post-full-content" onClick={(e) => e.stopPropagation()}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="feed-post-summary">
            {hasThumbnail && (
              <div className="feed-post-thumbnail">
                <img src={post.thumbnail} alt="thumbnail" />
              </div>
            )}
            <div className="feed-post-text">
              {summary}...
              <button className="read-more-btn" onClick={() => setExpanded(true)}>
                阅读全文 <BsCaretDownFill />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="feed-post-actions" onClick={(e) => e.stopPropagation()}>
        {/* Reaction System */}
        <div className="reaction-bar">
          {/* Existing Reactions Pills */}
          {Object.entries(localReactions).map(([emoji, userIds]) => (
            <button 
              key={emoji} 
              className={`reaction-pill ${userIds.includes(user?.id) ? 'active' : ''}`}
              onClick={(e) => handleReaction(emoji, e)}
            >
              {emoji === CUSTOM_REACTION_KEY ? (
                <img 
                  src={CUSTOM_REACTION_URL} 
                  alt="custom" 
                  style={{ width: '18px', height: '18px', objectFit: 'contain', marginRight: '4px', verticalAlign: 'text-bottom' }} 
                />
              ) : (
                <span className="emoji">{emoji}</span>
              )
              }
              <span className="count">{userIds.length}</span>
            </button>
          ))}

          {/* Preset Buttons */}
          {(!localReactions['😍']) && (
            <button className="reaction-preset" onClick={(e) => handleReaction('😍', e)}>
              😍
            </button>
          )}
          {(!localReactions['🤮']) && (
            <button className="reaction-preset" onClick={(e) => handleReaction('🤮', e)}>
              🤮
            </button>
          )}
          {(!localReactions[CUSTOM_REACTION_KEY]) && (
            <button className="reaction-preset" onClick={(e) => handleReaction(CUSTOM_REACTION_KEY, e)}>
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
                  onEmojiSelect={(emoji, e) => {
                    handleReaction(emoji, e);
                    setShowPicker(false);
                  }}
                  onClose={() => setShowPicker(false)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="heat-display" style={{ display: 'flex', alignItems: 'center', marginRight: '16px', color: '#ff4500', fontSize: '14px', fontWeight: '500' }}>
             <BsFire style={{ marginRight: '4px' }} /> {post.heat || 0} 热度
        </div>

        <button className="action-btn comment-btn" onClick={toggleComments}>
          <BsChatText /> {post.commentsCount || 0} 条评论
        </button>
        <button className="action-btn share-btn">
          <BsShare /> 分享
        </button>
        <button className="action-btn more-btn">
          <BsThreeDots />
        </button>
        
        {expanded && (
          <button className="action-btn collapse-btn-inline" onClick={() => setExpanded(false)}>
            收起 <BsCaretUpFill />
          </button>
        )}
      </div>

      {commentsExpanded && (
        <div className="feed-post-comments" onClick={(e) => e.stopPropagation()}>
          {loadingComments ? (
            <div className="comments-loading">加载评论中...</div>
          ) : (
            <>
              {comments.length > 0 ? (
                <div className="comments-list">
                  {comments.map(comment => (
                    <FeedCommentNode key={comment._id} message={comment} user={user} allComments={allComments} />
                  ))}
                  {(post.commentsCount || 0) > 5 && (
                    <div className="view-more-comments" onClick={() => navigate(`/post/${post.id}`)}>
                      查看全部 {post.commentsCount} 条评论
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-comments">暂无评论</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default FeedPostCard;
