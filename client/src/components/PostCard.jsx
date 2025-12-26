import { useNavigate } from 'react-router-dom';
import { BsFire, BsShare } from 'react-icons/bs';
import './PostCard.css';

function PostCard({ post, rank, isNew }) {
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
        <h3 className="post-title">
          {post.title}
          {isNew && <span className="new-badge">新</span>}
        </h3>
        
        {post.content && (
          <p className="post-summary">
            {post.content.length > 120 
              ? post.content.substring(0, 120) + '...' 
              : post.content}
          </p>
        )}

        <div className="post-stats">
          <span className="stat-btn">
            <span className="stat-icon"><BsFire /></span>
            <span className="heat-value">{formatHeat(post.votes || post.heat || 0)}</span>
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
