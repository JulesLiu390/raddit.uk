import PostCard from './PostCard';

function PostList({ posts }) {
  if (!posts || posts.length === 0) {
    return <p className="no-posts">暂无帖子</p>;
  }

  return (
    <div className="post-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export default PostList;
