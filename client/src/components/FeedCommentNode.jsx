import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BsChatText, BsHeart, BsThreeDots, BsCheckCircleFill } from 'react-icons/bs';
import './FeedCommentNode.css';

const FeedCommentNode = ({ message, user, allComments }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Find direct children
  const children = allComments ? allComments.filter(c => c.parentId === message._id || c.parentId === message.id) : [];
  
  return (
    <div className="feed-comment-node">
      <div className="feed-comment-header">
        <img 
          src={message.authorAvatar || 'https://picsum.photos/40/40?random=1'} 
          alt="avatar" 
          className="feed-comment-avatar" 
          onClick={() => message.authorId && navigate(`/profile/${message.authorId}`)}
        />
        <div className="feed-comment-info">
          <div className="feed-comment-author-row">
            <span 
              className="feed-comment-author"
              onClick={() => message.authorId && navigate(`/profile/${message.authorId}`)}
            >
              {message.author}
            </span>
            {message.authorRole === 'admin' && (
              <span className="feed-admin-badge">权蛆</span>
            )}
            {message.isBot && (
              <span className="feed-admin-badge" style={{ backgroundColor: '#d4a017' }}>🤖蛆体炼成术产物🪱</span>
            )}
            {message.replyToName && (
              <span className="feed-comment-reply-to">
                回复 <span className="reply-target">@{message.replyToName}</span>
              </span>
            )}
            {message.isVerified && !message.isBot && <BsCheckCircleFill className="verified-badge" />}
          </div>
          <div className="feed-comment-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          <div className="feed-comment-meta">
            <span className="feed-comment-time">{new Date(message.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            {message.authorBio && <span className="feed-comment-bio">· {message.authorBio}</span>}
            
            <div className="feed-comment-actions">
              <button className="feed-action-btn">
                <BsChatText /> 回复
              </button>
              <button className="feed-action-btn">
                <BsHeart /> 喜欢
              </button>
            </div>
          </div>

          {children.length > 0 && (
            <div className="feed-comment-replies">
              {!expanded ? (
                <button className="expand-replies-btn" onClick={() => setExpanded(true)}>
                  展开 {children.length} 条回复
                </button>
              ) : (
                <div className="nested-comments-list">
                  {children.map(child => (
                    <FeedCommentNode key={child._id} message={child} user={user} allComments={allComments} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedCommentNode;
