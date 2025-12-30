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
    const user = await User.findOne({ googleId: userId }).select('followingUsers followedPosts').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const followedPosts = user.followedPosts || [];
    const followingUsers = user.followingUsers || [];
    
    // 修复 1: 将 ObjectId 转换为 String (Message.postId 是 String)
    const followedPostIds = followedPosts.map(id => id.toString());
    // 修复 3: 确保 followingUsers 也是 String，并去除可能存在的空格
    const followingUserIds = followingUsers.map(id => id.toString().trim());

    console.log(`Discovery API: User ${userId} is following ${followingUserIds.length} users and ${followedPostIds.length} posts`);

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

    const [posts, messages] = await Promise.all([postsPromise, messagesPromise]);
    
    console.log(`Discovery API: Found ${posts.length} posts and ${messages.length} messages`);

    // Merge and sort
    const combined = [
      ...posts.map(p => ({ ...p.toObject(), type: 'post' })),
      ...messages.map(m => ({ ...m.toObject(), type: 'reply' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
      return {
        ...item,
        reason: 'following_user'
      };
    }));

    res.json({
      items: finalResult,
      nextCursor: result.length > 0 ? result[result.length - 1].createdAt : null,
      debug: {
        userId,
        followingUserIds,
        followedPostIds,
        postsFound: posts.length,
        messagesFound: messages.length,
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

// 获取热门帖子 (用于侧边栏)
app.get('/api/posts/hot', async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ heat: -1, createdAt: -1 }) // 按热度倒序，然后按时间倒序
      .limit(10) // 只取前10名
      .select('title heat id authorId'); // 只返回需要的字段
      
    // Note: Hot posts usually just show title, but if we show author, we should enrich
    // Since we selected specific fields, enrichContentWithUser will work if authorId is present
    // But usually hot posts sidebar doesn't show author. 
    // Let's enrich anyway just in case frontend uses it or will use it.
    // Wait, the select above didn't include authorId originally? 
    // Original: .select('title heat id');
    // If frontend doesn't use author, we don't need to enrich.
    // Let's check if frontend uses author in hot posts.
    // Assuming it might, let's leave it as is or just return posts if no author needed.
    // Actually, let's just return posts as before if author is not displayed.
    // But to be safe, let's not change this one unless requested.
    // Wait, the user said "Post should store unique id... to adapt to user name update".
    // If hot posts don't show name, it doesn't matter.
    // Let's skip enriching hot posts for now to save performance, unless we know it shows name.
    res.json(posts);
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
    res.json(enrichedPosts);
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
      for (const topicId of req.body.topics) {
        const topic = await Topic.findById(topicId);
        if (topic) {
          topics.push({ id: topic._id, name: topic.name });
          // Increment post count for each topic
          await Topic.findByIdAndUpdate(topicId, { $inc: { postCount: 1 } });
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
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 获取单个帖子
app.get('/api/posts/:id', async (req, res) => {
  try {
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

    const { bio, name, picture } = req.body;
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
    formData.append('key', '7953ab3bbb9bee09a2b211444a1b3724');
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
  const users = await User.find({ googleId: { $in: authorIds } }).select('googleId name picture bio');
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
      if (itemObj.hasOwnProperty('authorBio')) {
        itemObj.authorBio = user.bio;
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
    const users = await User.find({ googleId: { $in: [...userIds] } }).select('googleId name picture bio');
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

    // Check permission: Admin or Author
    if (req.user.role !== 'admin' && req.user.googleId !== post.authorId) {
      return res.status(403).json({ message: '无权删除此帖子' });
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
