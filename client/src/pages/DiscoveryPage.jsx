import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDiscoveryFeed } from '../api';
import Header from '../components/Header';
import LeftSidebar from '../components/LeftSidebar';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import FeedPostCard from '../components/FeedPostCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BsChatText, BsPersonFill, BsReply } from 'react-icons/bs';
import './DiscoveryPage.css';

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

function DiscoveryPage({ user, onLogout, onCreatePost }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const observer = useRef();

  const lastItemRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    if (!user) {
      // If not logged in, redirect to home or show login prompt
      // For now, let's just load initial data which might return 401
      // But better to handle it gracefully
    }
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const data = await getDiscoveryFeed();
      if (data && data.items) {
        setItems(data.items);
        setNextCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      } else {
        setItems([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load discovery feed:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await getDiscoveryFeed(nextCursor);
      setItems(prev => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (err) {
      console.error('Failed to load more items:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderItem = (item, index) => {
    const isLast = index === items.length - 1;
    const ref = isLast ? lastItemRef : null;

    if (item.type === 'post') {
      return (
        <div key={item.id} ref={ref} className="discovery-item">
          <div className="discovery-header">
            <BsPersonFill className="icon" />
            <span className="discovery-reason">
              {item.reason === 'following_topic' ? (
                <>来自话题 <strong>{item.topics && item.topics.length > 0 ? item.topics[0].name : '关注的话题'}</strong></>
              ) : (
                <>你关注的 <strong>{item.author}</strong> 发布了新帖</>
              )}
            </span>
            <span className="time">{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          <FeedPostCard post={item} user={user} />
        </div>
      );
    } else if (item.type === 'reply') {
      return (
        <div key={item.id} ref={ref} className="discovery-item reply-item">
          <div className="discovery-header">
            {item.reason === 'following_user' ? (
              <>
                <BsReply className="icon" />
                <span className="discovery-reason">
                  你关注的 <strong>{item.author}</strong> 回复了帖子
                </span>
              </>
            ) : (
              <>
                <BsChatText className="icon" />
                <span className="discovery-reason">
                  你关注的帖子 <strong>{item.postTitle}</strong> 有新回复
                </span>
              </>
            )}
            <span className="time">{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          
          <div className="reply-card" onClick={() => navigate(`/post/${item.postId}`)}>
            <div className="reply-inner-header">
              <img 
                className="reply-avatar" 
                src={item.authorAvatar || 'https://picsum.photos/40/40'} 
                alt={item.author} 
              />
              <div className="reply-meta">
                <span className="reply-author-name">{item.author}</span>
                <span className="reply-action-text">回复了帖子</span>
              </div>
            </div>
            
            <div className="reply-body markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                {(item.content || '').length > 300 ? (item.content || '').substring(0, 300) + '...' : (item.content || '')}
              </ReactMarkdown>
            </div>

            <div className="reply-footer-context">
              <span className="context-label">来源帖子:</span> 
              <span className="context-title">{item.postTitle}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`discovery-page ${isMenuOpen ? 'menu-open' : ''}`}>
      <Header user={user} onLogout={onLogout} onCreatePost={onCreatePost} onToggleMenu={() => setIsMenuOpen(!isMenuOpen)} />
      <main className="main-container">
        <div className="content-wrapper">
          <LeftSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} />
          <div className="main-content">
            <div className="discovery-feed">
              
              {!user ? (
                <div className="login-prompt">
                  <p>请先登录以查看关注动态</p>
                  <button onClick={() => navigate('/login')}>去登录</button>
                </div>
              ) : (
                <>
                  {items.length === 0 && !loading ? (
                    <div className="empty-state">
                      <p>暂时没有新动态，去关注一些有趣的人或话题吧！</p>
                    </div>
                  ) : (
                    <div className="feed-list">
                      {items.map((item, index) => renderItem(item, index))}
                    </div>
                  )}
                  
                  {(loading || loadingMore) && (
                    <div className="loading-indicator">
                      <div className="loading-spinner"></div>
                      <span>加载中...</span>
                    </div>
                  )}
                  
                  {!hasMore && items.length > 0 && (
                    <div className="end-of-list">
                      <span>已经到底啦 ~</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <Sidebar user={user} />
        </div>
      </main>
    </div>
  );
}

export default DiscoveryPage;
