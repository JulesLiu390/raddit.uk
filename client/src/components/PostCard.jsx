import { useNavigate } from 'react-router-dom';
import { BsFire, BsShare, BsTrash } from 'react-icons/bs';
import { deletePost } from '../api';
import './PostCard.css';

// Helper to strip markdown
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
    .trim();
};

function PostCard({ post, rank, isNew, user, onDelete }) {
  const navigate = useNavigate();

  // 格式化数字
  const formatNumber = (num) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(0) + '万';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num;
  };

  // 格式化热度
  const formatHeat = (num) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(0) + '万热度';
    }
    return num + '热度';
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个帖子吗？')) {
      try {
        await deletePost(post.id);
        if (onDelete) onDelete(post.id);
      } catch (err) {
        console.error('Failed to delete post:', err);
        alert('删除失败');
      }
    }
  };

  return (
    <article className="post-card" onClick={() => window.open(`/post/${post.id}`, '_blank')}>
      {/* 排名 */}
      {rank && (
        <div className={`post-rank rank-${rank <= 3 ? rank : 'normal'}`}>
          {rank}
        </div>
      )}

      {/* 主内容 */}
      <div className="post-main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 className="post-title">
            {post.title}
            {isNew && <span className="new-badge">新</span>}
          </h3>
          {user && user.role === 'admin' && (
            <button 
              className="delete-btn" 
              onClick={handleDelete}
              style={{ 
                border: '1px solid #ff4d4f', 
                color: '#ff4d4f', 
                background: 'transparent',
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                marginLeft: '10px'
              }}
            >
              删除
            </button>
          )}
        </div>
        
        {post.content && (
          <p className="post-summary">
            {(() => {
              const plainText = stripMarkdown(post.content);
              return plainText.length > 120 
                ? plainText.substring(0, 120) + '...' 
                : plainText;
            })()}
          </p>
        )}

        <div className="post-stats">
          <span className="stat-btn">
            <span className="stat-icon"><BsFire /></span>
            <span className="heat-value">{formatHeat(post.votes || post.heat || 0)}</span>
          </span>
          <span className="stat-btn" style={{ cursor: 'default', color: '#8590a6' }}>
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
          <button className="stat-btn share-btn">
            <span className="stat-icon"><BsShare /></span>
            <span>分享</span>
          </button>
        </div>
      </div>

      {/* 缩略图 */}
      {post.thumbnail && (
        <div className="post-thumbnail">
          <img src={post.thumbnail} alt={post.title} />
        </div>
      )}
    </article>
  );
}

export default PostCard;
