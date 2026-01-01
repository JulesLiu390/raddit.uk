const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fsSync = require('fs');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Models
const Post = require('./models/Post');
const User = require('./models/User');
const Message = require('./models/Message');
const Topic = require('./models/Topic');
const authMiddleware = require('./middleware/auth');
const { generateBotReply } = require('./services/geminiBot');

const app = express();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raddit';

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SSL_CA_PATH = process.env.SSL_CA_PATH;
const JWT_SECRET = process.env.JWT_SECRET || 'raddit-secret-key-change-this-in-prod';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// 如果部署在反向代理后面，需要显式开启 trust proxy 才能拿到真实 IP
// 由于目前是 Node.js 直接处理 HTTPS (场景1)，不应信任代理头，防止 IP 欺骗
app.set('trust proxy', false);

function getClientIP(req) {
  // 直接获取连接的远程 IP，忽略 X-Forwarded-For
  // 兼容 IPv6 表示法（如 ::ffff:192.168.0.1）
  return (req.ip || req.connection.remoteAddress || '').replace(/^::ffff:/, '') || '0.0.0.0';
}

// 中间件
app.use(cors());
// 增加请求体大小限制以支持图片上传 (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 身份验证中间件
app.use(authMiddleware);

// 获取发现页内容 (聚合关注的帖子更新和关注的人的动态)
// Moved to top to ensure priority over other routes and catch-all
app.get('/api/discovery', async (req, res) => {
  console.log('Discovery API called');
  try {
    if (!req.user) {
      console.log('Discovery API: User not logged in');
      return res.status(401).json({ message: '请先登录' });
    }

    const userId = req.user.googleId;
    console.log('Discovery API: User ID:', userId);
    
    const limit = parseInt(req.query.limit) || 10;
    const cursor = req.query.cursor ? new Date(req.query.cursor) : new Date();

    // Get current user to find followed posts and users
    const user = await User.findOne({ googleId: userId }).select('followingUsers followedPosts followedTopics').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const followedPosts = user.followedPosts || [];
    const followingUsers = user.followingUsers || [];
    const followedTopics = user.followedTopics || [];
    
    // 修复 1: 将 ObjectId 转换为 String (Message.postId 是 String)
    const followedPostIds = followedPosts.map(id => id.toString());
    // 修复 3: 确保 followingUsers 也是 String，并去除可能存在的空格
    const followingUserIds = followingUsers.map(id => id.toString().trim());

    console.log(`Discovery API: User ${userId} is following ${followingUserIds.length} users, ${followedPostIds.length} posts, and ${followedTopics.length} topics`);

    // Query 1: New posts from followed users
    const postsPromise = Post.find({
      authorId: { $in: followingUserIds },
      createdAt: { $lt: cursor }
    })
    .sort({ createdAt: -1 })
    .limit(limit);

    // Query 2: New replies (depth=1) from followed users OR to followed posts
    const messagesPromise = Message.find({
      $or: [
        { authorId: { $in: followingUserIds } },
        { postId: { $in: followedPostIds } }
      ],
      depth: 1,
      createdAt: { $lt: cursor }
    })
    .sort({ createdAt: -1 })
    .limit(limit);

    // Query 3: New posts from followed topics
    const topicPostsPromise = Post.find({
      'topics.id': { $in: followedTopics },
      createdAt: { $lt: cursor }
    })
    .sort({ createdAt: -1 })
    .limit(limit);

    const [posts, messages, topicPosts] = await Promise.all([postsPromise, messagesPromise, topicPostsPromise]);
    
    console.log(`Discovery API: Found ${posts.length} posts, ${messages.length} messages, and ${topicPosts.length} topic posts`);

    // Merge and sort
    const combinedMap = new Map();

    // 优先加入关注人的帖子
    posts.forEach(p => combinedMap.set(p.id, { ...p.toObject(), type: 'post', reason: 'following_user' }));
    
    // 加入关注话题的帖子（如果已存在则跳过，避免重复）
    topicPosts.forEach(p => {
      if (!combinedMap.has(p.id)) {
        combinedMap.set(p.id, { ...p.toObject(), type: 'post', reason: 'following_topic' });
      }
    });
    
    // 加入回复
    messages.forEach(m => combinedMap.set(m.id, { ...m.toObject(), type: 'reply' }));

    const combined = Array.from(combinedMap.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Slice to limit
    const result = combined.slice(0, limit);

    // Enrich data
    const enrichedResult = await enrichContentWithUser(result);
    
    const finalResult = await Promise.all(enrichedResult.map(async (item) => {
      if (item.type === 'reply') {
        const post = await Post.findById(item.postId).select('title');
        return {
          ...item,
          postTitle: post ? post.title : 'Unknown Post',
          reason: followingUsers.includes(item.authorId) ? 'following_user' : 'following_post'
        };
      }
      // 如果 reason 还没设置（比如来自 postsPromise），默认为 following_user
      if (!item.reason) {
        item.reason = 'following_user';
      }
      return item;
    }));

    res.json({
      items: finalResult,
      nextCursor: result.length > 0 ? result[result.length - 1].createdAt : null,
      debug: {
        userId,
        followingUserIds,
        followedPostIds,
        followedTopicsCount: followedTopics.length,
        postsFound: posts.length,
        messagesFound: messages.length,
        topicPostsFound: topicPosts.length,
        cursor
      }
    });

  } catch (err) {
    console.error('Discovery API error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 托管前端静态文件
app.use(express.static(path.join(__dirname, '../client/dist')));

// --- Topic APIs ---

// 获取所有话题
app.get('/api/topics', async (req, res) => {
  try {
    const topics = await Topic.find().sort({ postCount: -1 });
    res.json(topics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建新话题
app.post('/api/topics', async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    
    // Check if topic exists
    const existing = await Topic.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: '话题已存在' });
    }

    const newTopic = new Topic({
      name,
      description,
      icon,
      creatorId: req.user ? req.user.googleId : null
    });

    const savedTopic = await newTopic.save();
    res.status(201).json(savedTopic);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 获取单个话题详情
app.get('/api/topics/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    res.json(topic);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取特定话题下的帖子
app.get('/api/topics/:id/posts', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    // Find posts where topics array contains an object with id matching req.params.id
    // Since we store topics as [{id: ObjectId, name: String}], we query 'topics.id'
    const posts = await Post.find({ 'topics.id': req.params.id }).sort({ createdAt: -1 });
    const enrichedPosts = await enrichContentWithUser(posts);
    res.json(enrichedPosts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- End Topic APIs ---

// 增加帖子热度 (点击)
app.post('/api/posts/:id/view', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { heat: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ heat: post.heat });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取热门帖子 (用于侧边栏和热榜)
app.get('/api/posts/hot', async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ heat: -1, createdAt: -1 }) // 按热度倒序，然后按时间倒序
      .limit(10); // 只取前10名
      
    const enrichedPosts = await enrichContentWithUser(posts);
    
    // Add comments count
    const postsWithComments = await Promise.all(enrichedPosts.map(async (post) => {
      const count = await Message.countDocuments({ postId: post.id });
      return { ...post, commentsCount: count };
    }));

    res.json(postsWithComments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取所有帖子
app.get('/api/posts', async (req, res) => {
  try {
    // 按时间倒序排列
    const posts = await Post.find().sort({ createdAt: -1 });
    const enrichedPosts = await enrichContentWithUser(posts);
    
    // Fetch comment counts for each post
    const postsWithComments = await Promise.all(enrichedPosts.map(async (post) => {
      const count = await Message.countDocuments({ postId: post.id });
      return { ...post, commentsCount: count };
    }));

    res.json(postsWithComments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建新帖子
app.post('/api/posts', async (req, res) => {
  try {
    const clientIp = getClientIP(req);
    
    // 强制身份验证逻辑
    let authorName, authorAvatar, authorId;

    if (req.user) {
      // 如果已登录，强制使用用户信息
      authorName = req.user.name;
      authorAvatar = req.user.picture;
      authorId = req.user.googleId;
    } else {
      // 如果未登录，强制使用 IP，且不设 authorId
      authorName = clientIp;
      authorAvatar = '';
      authorId = null;
    }
    
    // 提取第一张图片作为缩略图
    let thumbnail = req.body.thumbnail || '';
    if (!thumbnail && req.body.content) {
      const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/;
      const match = req.body.content.match(imgRegex);
      if (match && match[1]) {
        thumbnail = match[1];
      }
    }

    // Handle Topics (Array, 0-3)
    let topics = [];
    if (req.body.topics && Array.isArray(req.body.topics)) {
      if (req.body.topics.length > 3) {
        return res.status(400).json({ message: '最多只能选择 3 个话题' });
      }
      
      // Validate and fetch topic details
      for (const topicInput of req.body.topics) {
        // Case 1: Input is just an ID string (legacy or simple ID)
        if (typeof topicInput === 'string' && mongoose.Types.ObjectId.isValid(topicInput)) {
          const topic = await Topic.findById(topicInput);
          if (topic) {
            topics.push({ id: topic._id, name: topic.name });
            await Topic.findByIdAndUpdate(topic._id, { $inc: { postCount: 1 } });
          }
        } 
        // Case 2: Input is an object (from new CreatePostModal)
        else if (typeof topicInput === 'object') {
           // 2a. Existing topic with ID
           if (topicInput.id && mongoose.Types.ObjectId.isValid(topicInput.id)) {
             const topic = await Topic.findById(topicInput.id);
             if (topic) {
               topics.push({ id: topic._id, name: topic.name });
               await Topic.findByIdAndUpdate(topic._id, { $inc: { postCount: 1 } });
             }
           }
           // 2b. New topic to be created (or existing by name)
           else if (topicInput.name) {
             let existingTopic = await Topic.findOne({ name: topicInput.name });
             if (!existingTopic) {
               existingTopic = await Topic.create({
                 name: topicInput.name,
                 creatorId: authorId,
                 icon: '💬'
               });
             }
             topics.push({ id: existingTopic._id, name: existingTopic.name });
             await Topic.findByIdAndUpdate(existingTopic._id, { $inc: { postCount: 1 } });
           }
        }
      }
    }
    
    const newPost = new Post({
      title: req.body.title,
      content: req.body.content,
      thumbnail: thumbnail,
      author: authorName,
      authorAvatar: authorAvatar,
      authorId: authorId,
      topics: topics,
      heat: 0
    });

    const savedPost = await newPost.save();
    res.status(201).json(savedPost);

    // Trigger AI Bot Reply (Async)
    (async () => {
      try {
        // Delay slightly to simulate "reading" time (e.g., 10 seconds)
        // setTimeout(async () => { ... }, 10000); 
        // For now, we run it immediately but asynchronously
        
        // Extract images from content
        const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
        const imageUrls = [];
        let match;
        while ((match = imgRegex.exec(savedPost.content)) !== null) {
          imageUrls.push(match[1]);
        }

        const replyContent = await generateBotReply(savedPost.title, savedPost.content, imageUrls);
        
        if (replyContent) {
          const botUser = await User.findOne({ googleId: 'raddit-ai-bot-001' });
          
          if (botUser) {
            const botMessage = new Message({
              postId: savedPost._id.toString(),
              content: replyContent,
              author: botUser.name,
              authorAvatar: botUser.picture,
              authorId: botUser.googleId,
              parentId: null,
              depth: 1,
              replyToUserId: null,
              replyToName: null,
              authorBio: botUser.bio,
              isVerified: true, // Bot is verified
              upvotes: 0
            });
            
            await botMessage.save();
            console.log(`[Bot] Replied to post ${savedPost._id}`);
          } else {
            console.warn('[Bot] Bot user not found. Run "node scripts/init_bot_user.js" to create it.');
          }
        }
      } catch (error) {
        console.error('[Bot] Error generating reply:', error);
      }
    })();

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 获取单个帖子
app.get('/api/posts/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    const enrichedPost = await enrichContentWithUser(post);
    res.json(enrichedPost);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 关注/取消关注帖子
app.post('/api/posts/:id/follow', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' });
    }

    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const userId = req.user.googleId;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const user = await User.findOne({ googleId: userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isFollowing = post.followers.includes(userId);

    if (isFollowing) {
      // Unfollow
      post.followers = post.followers.filter(id => id !== userId);
      user.followedPosts = user.followedPosts.filter(id => id.toString() !== postId);
    } else {
      // Follow
      post.followers.push(userId);
      if (!user.followedPosts.includes(postId)) {
        user.followedPosts.push(postId);
      }
    }

    await post.save();
    await user.save();

    res.json({ 
      isFollowing: !isFollowing, 
      followersCount: post.followers.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取帖子的所有消息/回答
app.get('/api/posts/:postId/messages', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const messages = await Message.find({ postId: req.params.postId }).sort({ createdAt: -1 });
    const enrichedMessages = await enrichMessagesWithUser(messages);
    res.json(enrichedMessages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建新消息/回答（支持楼中楼最多 3 层：1=顶层，2=回复，3=回复的回复）
app.post('/api/posts/:postId/messages', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const clientIp = getClientIP(req);
    const parentId = req.body.parentId || null;

    let parent = null;
    if (parentId) {
      parent = await Message.findById(parentId);
      if (!parent || parent.postId !== req.params.postId) {
        return res.status(400).json({ message: 'Parent message not found or not in this post' });
      }
      const parentDepth = parent.depth || 1;
      if (parentDepth >= 3) {
        return res.status(400).json({ message: 'Max reply depth reached' });
      }
    }

    // 强制身份验证逻辑
    let authorName, authorAvatar, authorId;

    if (req.user) {
      // 如果已登录，强制使用用户信息
      authorName = req.user.name;
      authorAvatar = req.user.picture;
      authorId = req.user.googleId;
    } else {
      // 如果未登录，强制使用 IP，且不设 authorId
      authorName = clientIp;
      authorAvatar = '';
      authorId = null;
    }

    const depth = parent ? (parent.depth || 1) + 1 : 1;

    const newMessage = new Message({
      postId: req.params.postId,
      content: req.body.content,
      author: authorName,
      authorAvatar: authorAvatar,
      authorId: authorId,
      parentId: parentId,
      depth: depth,
      replyToUserId: parent ? (parent.authorId || parent.author || '') : null,
      replyToName: parent ? (parent.author || '') : null,
      authorBio: '',
      isVerified: false,
      upvotes: 0
    });

    const savedMessage = await newMessage.save();
    
    // Update post heat: Reply adds 3 heat
    await Post.findByIdAndUpdate(req.params.postId, { $inc: { heat: 3 } });

    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 获取未读消息计数
app.get('/api/notifications/count', async (req, res) => {
  try {
    if (!req.user) return res.json({ count: 0 });

    const userId = req.user.googleId;
    const user = await User.findOne({ googleId: userId });
    if (!user) return res.json({ count: 0 });

    const lastRead = user.lastReadInteractions || new Date(0);

    // 先找到用户的所有帖子 ID
    const userPosts = await Post.find({ authorId: userId }).select('_id');
    const userPostIds = userPosts.map(p => p._id.toString());

    // 修正查询逻辑：
    // 1. 回复给我的评论 (replyToUserId = me)
    // 2. 回复给我的帖子 (postId in myPosts)，但排除掉情况1（避免重复），也排除掉我自己发的
    
    const count = await Message.countDocuments({
      $and: [
        { createdAt: { $gt: lastRead } },
        { authorId: { $ne: userId } }, // 排除自己发的
        {
          $or: [
            { replyToUserId: userId }, // 回复我的评论
            { postId: { $in: userPostIds } } // 在我的帖子里
          ]
        }
      ]
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 标记消息已读
app.post('/api/notifications/read', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    await User.findOneAndUpdate(
      { googleId: req.user.googleId },
      { lastReadInteractions: new Date() }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户资料
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ googleId: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const userObj = user.toObject();
    userObj.id = user.googleId;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 更新用户资料
app.put('/api/users/:id', async (req, res) => {
  try {
    // Ensure the user is updating their own profile
    if (!req.user || req.user.googleId !== req.params.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { bio, name, picture, coverImage } = req.body;
    const updateData = {};
    
    const currentUser = await User.findOne({ googleId: req.params.id });
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined && name.trim() !== currentUser.name) {
      // Check if name change is allowed
      if (currentUser.lastUsernameChange) {
        const daysSinceLastChange = (Date.now() - new Date(currentUser.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastChange < 30) {
          const daysLeft = Math.ceil(30 - daysSinceLastChange);
          return res.status(400).json({ message: `距离上次修改昵称还需等待 ${daysLeft} 天` });
        }
      }
      updateData.name = name.trim();
      updateData.lastUsernameChange = new Date();
    }

    if (bio !== undefined) updateData.bio = bio;
    if (picture !== undefined) updateData.picture = picture;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    const user = await User.findOneAndUpdate(
      { googleId: req.params.id },
      updateData,
      { new: true }
    );

    // Return user with 'id' field mapped from googleId for frontend compatibility
    const userObj = user.toObject();
    userObj.id = user.googleId;

    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户发布的帖子
app.get('/api/users/:id/posts', async (req, res) => {
  try {
    const userPosts = await Post.find({ authorId: req.params.id }).sort({ createdAt: -1 });
    const enrichedPosts = await enrichContentWithUser(userPosts);
    res.json(enrichedPosts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户发布的回复
app.get('/api/users/:id/replies', async (req, res) => {
  try {
    const replies = await Message.find({ authorId: req.params.id }).sort({ createdAt: -1 });
    
    // Enrich with post title
    const enrichedReplies = await Promise.all(replies.map(async (reply) => {
      const post = await Post.findById(reply.postId);
      return {
        ...reply.toObject(),
        postTitle: post ? post.title : 'Unknown Post'
      };
    }));
    
    const finalReplies = await enrichMessagesWithUser(enrichedReplies);
    res.json(finalReplies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户关注的帖子
app.get('/api/users/:id/following', async (req, res) => {
  try {
    const user = await User.findOne({ googleId: req.params.id }).populate('followedPosts');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.followedPosts || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户关注的用户
app.get('/api/users/:id/following-users', async (req, res) => {
  try {
    const user = await User.findOne({ googleId: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Manually fetch users because we store googleId string, not ObjectId
    const followingUsers = await User.find({ googleId: { $in: user.followingUsers } });
    const usersWithId = followingUsers.map(u => {
      const obj = u.toObject();
      obj.id = u.googleId;
      return obj;
    });
    res.json(usersWithId);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户互动的帖子/回复 (点赞/表情)
app.get('/api/users/:id/reactions', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Aggregation to find items where reactions map values contain userId
    // Note: reactions is a Map, so in MongoDB it's an object. We use $objectToArray to query it.
    
    const posts = await Post.aggregate([
      { $addFields: { reactionsArray: { $objectToArray: "$reactions" } } },
      { $match: { "reactionsArray.v": userId } },
      { $project: { reactionsArray: 0 } }
    ]);
    
    const messages = await Message.aggregate([
      { $addFields: { reactionsArray: { $objectToArray: "$reactions" } } },
      { $match: { "reactionsArray.v": userId } },
      { $project: { reactionsArray: 0 } }
    ]);

    // Enrich posts
    const enrichedPosts = await enrichContentWithUser(posts);
    
    // Enrich messages with post title and user info
    const enrichedMessages = await Promise.all(messages.map(async (msg) => {
      const post = await Post.findById(msg.postId).select('title');
      return {
        ...msg,
        postTitle: post ? post.title : 'Unknown Post'
      };
    }));
    
    const finalMessages = await enrichMessagesWithUser(enrichedMessages);

    res.json({
      posts: enrichedPosts,
      messages: finalMessages
    });
    
  } catch (err) {
    console.error('Fetch reactions error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 关注/取消关注用户
app.post('/api/users/:id/follow', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' });
    }

    const targetUserId = req.params.id;
    const currentUserId = req.user.googleId;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: '不能关注自己' });
    }

    const targetUser = await User.findOne({ googleId: targetUserId });
    const currentUser = await User.findOne({ googleId: currentUserId });

    if (!targetUser || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = currentUser.followingUsers.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.followingUsers = currentUser.followingUsers.filter(id => id !== targetUserId);
      targetUser.followers = targetUser.followers.filter(id => id !== currentUserId);
    } else {
      // Follow
      if (!currentUser.followingUsers.includes(targetUserId)) {
        currentUser.followingUsers.push(targetUserId);
      }
      if (!targetUser.followers.includes(currentUserId)) {
        targetUser.followers.push(currentUserId);
      }
    }

    await currentUser.save();
    await targetUser.save();

    res.json({ 
      isFollowing: !isFollowing, 
      followersCount: targetUser.followers.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Google 登录
app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) {
    return res.status(500).json({ message: 'Google 登录未配置' });
  }

  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ message: '缺少凭证' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const userProfile = {
      googleId: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      emailVerified: payload.email_verified,
    };

    // 保存或更新用户信息
    let user = await User.findOne({ googleId: userProfile.googleId });
    
    if (user) {
      // Update existing user
      // Don't overwrite name if it already exists, allowing users to keep their custom nickname
      // user.name = userProfile.name; 
      user.picture = userProfile.picture;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        ...userProfile,
        lastLogin: new Date()
      });
    }

    // Generate JWT Token
    const sessionToken = jwt.sign(
      { 
        googleId: user.googleId,
        name: user.name,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user with 'id' field mapped from googleId for frontend compatibility
    const userObj = user.toObject();
    userObj.id = user.googleId;

    res.json({
      token: sessionToken,
      user: userObj,
    });
  } catch (err) {
    console.error('Google auth failed', err);
    res.status(401).json({ message: 'Google 登录失败，请重试' });
  }
});

// 处理 Reaction (点赞/表情回应)
app.post('/api/react', async (req, res) => {
  try {
    const { targetId, type, emoji } = req.body;
    if (!targetId || !type || !emoji) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let Model;
    if (type === 'post') {
      Model = Post;
    } else if (type === 'message') {
      Model = Message;
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const item = await Model.findById(targetId);
    if (!item) {
      return res.status(404).json({ message: 'Target not found' });
    }

    // 获取用户标识 (优先使用登录用户 ID，否则使用 IP)
    // 严禁使用 req.body.userId，防止伪造
    const userIdentifier = req.user ? req.user.googleId : getClientIP(req);

    // Initialize reactions map if needed (Mongoose Map defaults to empty map but good to be safe)
    if (!item.reactions) {
      item.reactions = new Map();
    }

    // Get current list for this emoji
    let users = item.reactions.get(emoji) || [];
    
    // Toggle logic
    const index = users.indexOf(userIdentifier);
    if (index > -1) {
      users.splice(index, 1);
    } else {
      users.push(userIdentifier);
    }

    // Update map
    if (users.length === 0) {
      item.reactions.delete(emoji);
    } else {
      item.reactions.set(emoji, users);
    }

    // Update upvotes count (total reactions)
    let totalReactions = 0;
    for (const list of item.reactions.values()) {
      totalReactions += list.length;
    }
    
    // For Post model, we use 'heat', for Message model we use 'upvotes'
    if (type === 'post') {
      // item.heat = totalReactions; // Maybe keep heat separate logic? 
      // Existing logic seemed to use heat for posts, but reactions update upvotes?
      // Let's stick to updating 'heat' for posts based on reactions for now, or just ignore upvotes field on Post if it doesn't exist
      // The Post model has 'heat', Message has 'upvotes'.
      // Let's assume heat is roughly equivalent to upvotes for now or just update it.
      // Actually, let's just save the reactions. The frontend calculates count from reactions object usually.
      // But for sorting, we might need a count.
    } else {
      item.upvotes = totalReactions;
    }

    // Mark modified because Map changes aren't always detected
    item.markModified('reactions');
    await item.save();

    // Convert Map to Object for JSON response
    const reactionsObj = {};
    for (const [key, val] of item.reactions) {
      reactionsObj[key] = val;
    }

    res.json({ 
      success: true, 
      reactions: reactionsObj, 
      upvotes: totalReactions 
    });
  } catch (err) {
    console.error('Reaction error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 获取用户收到的互动 (回复和点赞)
app.get('/api/users/:id/interactions', async (req, res) => {
  try {
    const userId = req.params.id;
    const interactions = [];

    // 1. 获取对我发布的帖子的回复 (Top-level comments)
    const myPosts = await Post.find({ authorId: userId }).select('_id title reactions createdAt');
    const myPostIds = myPosts.map(p => p._id.toString());
    const myPostMap = new Map(myPosts.map(p => [p._id.toString(), p]));

    const postReplies = await Message.find({
      postId: { $in: myPostIds },
      parentId: null,
      authorId: { $ne: userId } // Exclude self
    }).sort({ createdAt: -1 }).limit(50);

    for (const reply of postReplies) {
      const post = myPostMap.get(reply.postId);
      interactions.push({
        type: 'reply',
        targetType: 'post',
        targetId: reply.postId,
        targetContent: post ? post.title : 'Unknown Post',
        actorId: reply.authorId,
        actorNameFallback: reply.author,
        content: reply.content,
        createdAt: reply.createdAt,
        postId: reply.postId
      });
    }

    // 2. 获取对我的评论的回复 (Nested replies)
    const commentReplies = await Message.find({
      replyToUserId: userId,
      authorId: { $ne: userId }
    }).sort({ createdAt: -1 }).limit(50);

    for (const reply of commentReplies) {
      interactions.push({
        type: 'reply',
        targetType: 'comment',
        targetId: reply.parentId,
        targetContent: '...', // Content of the parent comment is hard to get efficiently without join
        actorId: reply.authorId,
        actorNameFallback: reply.author,
        content: reply.content,
        createdAt: reply.createdAt,
        postId: reply.postId
      });
    }

    // 3. 获取对我帖子的点赞/反应
    // 注意：由于 Schema 中没有存储反应的时间，我们只能使用帖子创建时间作为近似，或者就放在列表底部
    // 这里为了展示，我们假设它是最近发生的，或者就按帖子时间排
    for (const post of myPosts) {
      if (!post.reactions) continue;
      for (const [emoji, userIds] of post.reactions) {
        for (const reactorId of userIds) {
          if (reactorId === userId) continue;
          interactions.push({
            type: 'reaction',
            targetType: 'post',
            targetId: post._id,
            targetContent: post.title,
            actorId: reactorId,
            content: emoji,
            createdAt: post.createdAt, // FIXME: Schema limitation
            postId: post._id
          });
        }
      }
    }

    // 4. 获取对我评论的点赞/反应
    const myMessages = await Message.find({
      authorId: userId,
      reactions: { $ne: {} }
    }).select('_id content reactions postId createdAt');

    for (const msg of myMessages) {
      if (!msg.reactions) continue;
      for (const [emoji, userIds] of msg.reactions) {
        for (const reactorId of userIds) {
          if (reactorId === userId) continue;
          interactions.push({
            type: 'reaction',
            targetType: 'comment',
            targetId: msg._id,
            targetContent: msg.content,
            actorId: reactorId,
            content: emoji,
            createdAt: msg.createdAt, // FIXME: Schema limitation
            postId: msg.postId
          });
        }
      }
    }

    // Sort by date desc
    interactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit to 50
    const limitedInteractions = interactions.slice(0, 50);

    // Enrich with actor info
    const actorIds = [...new Set(limitedInteractions.map(i => i.actorId))];
    const actors = await User.find({ googleId: { $in: actorIds } }).select('googleId name picture');
    const actorMap = new Map(actors.map(u => [u.googleId, u]));

    const enrichedInteractions = limitedInteractions.map(i => {
      const actor = actorMap.get(i.actorId);
      let name = 'Unknown';
      if (actor) {
        name = actor.name;
      } else if (i.actorNameFallback) {
        name = i.actorNameFallback;
      } else if (i.actorId) {
        name = i.actorId;
      }

      return {
        ...i,
        actorName: name,
        actorAvatar: actor ? actor.picture : null
      };
    });

    res.json(enrichedInteractions);

  } catch (err) {
    console.error('Interactions error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 图片上传代理端点
app.post('/api/upload-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }

    // 从 base64 中提取纯数据部分
    let base64Data = image;
    if (image.includes(',')) {
      base64Data = image.split(',')[1];
    }

    // 使用 https 模块发送请求到 ImgBB
    const formData = new URLSearchParams();
    // Use environment variable for ImgBB API Key
    const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
    if (!IMGBB_API_KEY) {
        console.error('IMGBB_API_KEY is missing in environment variables');
        return res.status(500).json({ success: false, message: 'Server configuration error' });
    } 
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64Data);

    const postData = formData.toString();
    const options = {
      hostname: 'api.imgbb.com',
      port: 443,
      path: '/1/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const imgbbRequest = https.request(options, (imgbbRes) => {
      let data = '';
      
      imgbbRes.on('data', (chunk) => {
        data += chunk;
      });
      
      imgbbRes.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.data && response.data.url) {
            res.json({ url: response.data.url });
          } else {
            res.status(500).json({ message: 'Upload failed', error: response });
          }
        } catch (err) {
          res.status(500).json({ message: 'Failed to parse response', error: err.message });
        }
      });
    });

    imgbbRequest.on('error', (err) => {
      console.error('ImgBB upload error:', err);
      res.status(500).json({ message: 'Upload request failed', error: err.message });
    });

    imgbbRequest.write(postData);
    imgbbRequest.end();

  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 关注/取消关注话题
app.post('/api/topics/:id/follow', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' });
    }

    const topicId = req.params.id;
    const userId = req.user.googleId;

    const topic = await Topic.findById(topicId);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const user = await User.findOne({ googleId: userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 确保数组存在
    if (!user.followedTopics) user.followedTopics = [];
    if (!topic.followers) topic.followers = [];

    const isFollowing = user.followedTopics.some(id => id.toString() === topicId);

    if (isFollowing) {
      // Unfollow
      user.followedTopics = user.followedTopics.filter(id => id.toString() !== topicId);
      topic.followers = topic.followers.filter(id => id !== userId);
    } else {
      // Follow
      // 避免重复添加
      if (!isFollowing) {
        user.followedTopics.push(topicId);
      }
      if (!topic.followers.includes(userId)) {
        topic.followers.push(userId);
      }
    }

    await user.save();
    await topic.save();

    res.json({ 
      isFollowing: !isFollowing, 
      followersCount: topic.followers.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户关注的话题列表
app.get('/api/users/:id/followed-topics', async (req, res) => {
  try {
    const user = await User.findOne({ googleId: req.params.id }).populate('followedTopics');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.followedTopics || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 更新话题 (仅管理员)
app.put('/api/topics/:id', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const { icon, name, description } = req.body;
    const updateData = {};
    if (icon) updateData.icon = icon;
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const updatedTopic = await Topic.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedTopic) return res.status(404).json({ message: 'Topic not found' });
    res.json(updatedTopic);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 处理所有其他请求，返回 index.html (支持前端路由)
app.get(/(.*)/, (req, res) => {
  console.log('Fallback to index.html for:', req.url);
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

function getHttpsOptions() {
  if (!SSL_KEY_PATH || !SSL_CERT_PATH) return null;
  try {
    const resolvePath = (p) => (path.isAbsolute(p) ? p : path.join(__dirname, p));
    const keyPath = resolvePath(SSL_KEY_PATH);
    const certPath = resolvePath(SSL_CERT_PATH);
    const options = {
      key: fsSync.readFileSync(keyPath),
      cert: fsSync.readFileSync(certPath)
    };
    if (SSL_CA_PATH) {
      const caPath = resolvePath(SSL_CA_PATH);
      options.ca = fsSync.readFileSync(caPath);
    }
    return options;
  } catch (err) {
    console.error('读取 SSL 证书失败，回退到 HTTP：', err.message);
    return null;
  }
}

const httpsOptions = getHttpsOptions();
const PORT = process.env.PORT || 8443;
let server;

if (httpsOptions) {
  server = https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`HTTPS Server is running on https://0.0.0.0:${PORT}`);
    console.log('已启用 SSL，确保前端通过 HTTPS 访问');
  });
} else {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP Server is running on http://0.0.0.0:${PORT} (Using MongoDB)`);
    console.log(`Accessible externally at http://173.206.210.120:${PORT}`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
  } else {
    console.error('Server error:', err);
  }
});

// Helper function to enrich content with latest user info
async function enrichContentWithUser(items) {
  if (!items) return items;
  
  // Handle single item vs array
  const isArray = Array.isArray(items);
  const list = isArray ? items : [items];
  
  if (list.length === 0) return items;

  // Collect authorIds
  const authorIds = [...new Set(list.map(item => item.authorId).filter(id => id))];
  
  if (authorIds.length === 0) return items;
  
  // Fetch users
  const users = await User.find({ googleId: { $in: authorIds } }).select('googleId name picture bio role');
  const userMap = new Map(users.map(u => [u.googleId, u]));
  
  // Map items
  const enriched = list.map(item => {
    const itemObj = item.toObject ? item.toObject({ virtuals: true }) : { ...item };
    
    // Ensure id is present if not already (for lean objects or if virtuals failed)
    if (!itemObj.id && itemObj._id) {
      itemObj.id = itemObj._id.toString();
    }
    
    // Update author info if user exists
    if (itemObj.authorId && userMap.has(itemObj.authorId)) {
      const user = userMap.get(itemObj.authorId);
      itemObj.author = user.name;
      itemObj.authorAvatar = user.picture;
      itemObj.authorRole = user.role;
      if (itemObj.hasOwnProperty('authorBio')) {
        itemObj.authorBio = user.bio;
      }
      
      // Add isBot flag
      if (user.googleId === 'raddit-ai-bot-001') {
        itemObj.isBot = true;
      }
    }
    
    // Also update replyToName if applicable (for messages)
    if (itemObj.replyToUserId && userMap.has(itemObj.replyToUserId)) {
       // Note: We didn't fetch replyToUserId users above, only authorIds. 
       // To be perfectly correct we should also fetch replyToUserIds.
       // For now, let's stick to author updates as that's the primary request.
    }

    // Convert reactions Map to Object explicitly
    if (itemObj.reactions && itemObj.reactions instanceof Map) {
      const reactionsObj = {};
      for (const [key, val] of itemObj.reactions) {
        reactionsObj[key] = val;
      }
      itemObj.reactions = reactionsObj;
    }
    
    return itemObj;
  });
  
  return isArray ? enriched : enriched[0];
}

// Helper function to enrich messages specifically (handling replyTo users too)
async function enrichMessagesWithUser(messages) {
  if (!messages || messages.length === 0) return [];
  
  const list = Array.isArray(messages) ? messages : [messages];
  
  // Collect all relevant user IDs
  const userIds = new Set();
  list.forEach(msg => {
    if (msg.authorId) userIds.add(msg.authorId);
    if (msg.replyToUserId) userIds.add(msg.replyToUserId);
  });
  
  let userMap = new Map();
  if (userIds.size > 0) {
    const users = await User.find({ googleId: { $in: [...userIds] } }).select('googleId name picture bio role');
    userMap = new Map(users.map(u => [u.googleId, u]));
  }
  
  const enriched = list.map(msg => {
    const msgObj = msg.toObject ? msg.toObject({ virtuals: true }) : { ...msg };
    
    // Ensure id is present
    if (!msgObj.id && msgObj._id) {
      msgObj.id = msgObj._id.toString();
    }
    
    // Update author
    if (msgObj.authorId && userMap.has(msgObj.authorId)) {
      const user = userMap.get(msgObj.authorId);
      msgObj.author = user.name;
      msgObj.authorAvatar = user.picture;
      msgObj.authorBio = user.bio;
      msgObj.authorRole = user.role;
      
      // Add isBot flag
      if (user.googleId === 'raddit-ai-bot-001') {
        msgObj.isBot = true;
      }
    }
    
    // Update reply target name
    if (msgObj.replyToUserId && userMap.has(msgObj.replyToUserId)) {
      const targetUser = userMap.get(msgObj.replyToUserId);
      msgObj.replyToName = targetUser.name;
    }

    // Convert reactions Map to Object explicitly
    if (msg.reactions && msg.reactions instanceof Map) {
      const reactionsObj = {};
      for (const [key, val] of msg.reactions) {
        reactionsObj[key] = val;
      }
      msgObj.reactions = reactionsObj;
    }
    
    return msgObj;
  });
  
  return Array.isArray(messages) ? enriched : enriched[0];
}

// 删除帖子
app.delete('/api/posts/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    console.log(`[Delete Post] User: ${req.user.googleId} (${req.user.role}), Post Author: ${post.authorId}`);

    // Check permission: Admin or Author
    // Note: post.authorId is a String (googleId), req.user.googleId is a String.
    // But sometimes post.authorId might be missing or null if created by anonymous/legacy.
    // Also handle case where post.authorId is ObjectId (if schema changed).
    
    // Ensure strict string comparison and trim
    const currentUserId = String(req.user.googleId).trim();
    const postAuthorId = post.authorId ? String(post.authorId).trim() : '';

    const isAuthor = postAuthorId && (postAuthorId === currentUserId);
    const isAdmin = req.user.role === 'admin';

    console.log(`[Delete Post] isAuthor: ${isAuthor}, isAdmin: ${isAdmin}`);

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ message: `无权删除此帖子 (User: ${currentUserId}, Author: ${postAuthorId})` });
    }

    await Post.findByIdAndDelete(req.params.id);
    // Also delete associated messages
    await Message.deleteMany({ postId: req.params.id });
    
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 删除消息/回复
app.delete('/api/messages/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check permission: Admin or Author
    if (req.user.role !== 'admin' && req.user.googleId !== message.authorId) {
      return res.status(403).json({ message: '无权删除此回复' });
    }

    await Message.findByIdAndDelete(req.params.id);
    
    // Delete children recursively
    const deleteChildren = async (parentId) => {
      const children = await Message.find({ parentId });
      for (const child of children) {
        await deleteChildren(child._id);
        await Message.findByIdAndDelete(child._id);
      }
    };
    
    await deleteChildren(req.params.id);

    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 删除话题
app.delete('/api/topics/:id', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: '需要管理员权限' });
    }

    const topic = await Topic.findByIdAndDelete(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Optionally remove this topic from all posts?
    // await Post.updateMany({}, { $pull: { topics: { id: req.params.id } } });

    res.json({ message: 'Topic deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// 处理所有其他请求，返回 index.html (支持前端路由)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
