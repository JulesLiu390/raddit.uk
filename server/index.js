const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const https = require('https');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const DATA_FILE = path.join(__dirname, 'posts.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SSL_CA_PATH = process.env.SSL_CA_PATH;

// 如果部署在反向代理后面，需要显式开启 trust proxy 才能拿到真实 IP
app.set('trust proxy', true);

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // 兼容 IPv6 表示法（如 ::ffff:192.168.0.1）
  return (req.ip || '').replace(/^::ffff:/, '') || '0.0.0.0';
}

// 中间件
app.use(cors());
app.use(express.json());

// 托管前端静态文件
app.use(express.static(path.join(__dirname, '../client/dist')));

// 辅助函数：读取数据
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// 辅助函数：写入数据
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 辅助函数：读取消息数据
async function readMessages() {
  try {
    const data = await fs.readFile(MESSAGES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// 辅助函数：写入消息数据
async function writeMessages(data) {
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 辅助函数：读取用户数据
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// 辅助函数：写入用户数据
async function writeUsers(data) {
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 获取所有帖子
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await readData();
    // 按时间倒序排列
    const sortedPosts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sortedPosts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建新帖子
app.post('/api/posts', async (req, res) => {
  try {
    const posts = await readData();
    const clientIp = getClientIP(req);
    
    // 如果有传 author 信息则使用，否则使用 IP
    const authorName = req.body.author || clientIp;
    
    const newPost = {
      id: Date.now().toString(),
      title: req.body.title,
      content: req.body.content,
      thumbnail: req.body.thumbnail || '',
      author: authorName,
      authorAvatar: req.body.authorAvatar || '',
      authorId: req.body.authorId || null,
      heat: 0,
      createdAt: new Date().toISOString()
    };

    posts.push(newPost);
    await writeData(posts);
    res.status(201).json(newPost);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 获取单个帖子
app.get('/api/posts/:id', async (req, res) => {
  try {
    const posts = await readData();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取帖子的所有消息/回答（兼容旧数据，补充 parentId/depth）
app.get('/api/posts/:postId/messages', async (req, res) => {
  try {
    const messages = await readMessages();
    const postMessages = messages.filter(m => m.postId === req.params.postId);

    // 构建 map 以便计算深度
    const map = new Map();
    postMessages.forEach(m => {
      map.set(m.id, m);
    });

    const normalize = (msg) => {
      if (msg.depth) return msg.depth;
      let depth = 1;
      let current = msg;
      let guard = 0;
      while (current.parentId && guard < 5) {
        const parent = map.get(current.parentId);
        if (!parent) break;
        depth += 1;
        current = parent;
        guard += 1;
      }
      msg.depth = depth;
      return depth;
    };

    postMessages.forEach(m => {
      m.parentId = m.parentId || null;
      m.replyToUserId = m.replyToUserId || null;
      m.replyToName = m.replyToName || null;
      normalize(m);
    });

    // 按时间倒序排列
    const sortedMessages = postMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sortedMessages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建新消息/回答（支持楼中楼最多 3 层：1=顶层，2=回复，3=回复的回复）
app.post('/api/posts/:postId/messages', async (req, res) => {
  try {
    const messages = await readMessages();
    const clientIp = getClientIP(req);
    const parentId = req.body.parentId || null;

    let parent = null;
    if (parentId) {
      parent = messages.find(m => m.id === parentId && m.postId === req.params.postId);
      if (!parent) {
        return res.status(400).json({ message: 'Parent message not found or not in this post' });
      }
      const parentDepth = parent.depth || 1;
      if (parentDepth >= 3) {
        return res.status(400).json({ message: 'Max reply depth reached' });
      }
    }

    // 如果有传 author 信息则使用，否则使用 IP
    const authorName = req.body.author || clientIp;
    const authorAvatar = req.body.authorAvatar || '';
    const authorId = req.body.authorId || null;

    const depth = parent ? (parent.depth || 1) + 1 : 1;

    const newMessage = {
      id: Date.now().toString(),
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
      upvotes: 0,
      createdAt: new Date().toISOString()
    };

    messages.push(newMessage);
    await writeMessages(messages);
    res.status(201).json(newMessage);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 获取用户资料
app.get('/api/users/:id', async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 更新用户资料
app.put('/api/users/:id', async (req, res) => {
  try {
    const users = await readUsers();
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'User not found' });

    // 只允许更新特定字段
    const { bio, name, picture } = req.body;
    if (bio !== undefined) users[index].bio = bio;
    if (name !== undefined) users[index].name = name;
    if (picture !== undefined) users[index].picture = picture;

    await writeUsers(users);
    res.json(users[index]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户发布的帖子
app.get('/api/users/:id/posts', async (req, res) => {
  try {
    const posts = await readData();
    const userPosts = posts.filter(p => p.authorId === req.params.id);
    // 按时间倒序
    userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(userPosts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户发布的回复
app.get('/api/users/:id/replies', async (req, res) => {
  try {
    const messages = await readMessages();
    const userMessages = messages.filter(m => m.authorId === req.params.id);
    // 按时间倒序
    userMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(userMessages);
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
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      locale: payload.locale,
      emailVerified: payload.email_verified,
    };

    // 保存或更新用户信息
    const users = await readUsers();
    const existingUserIndex = users.findIndex(u => u.id === userProfile.id);
    
    if (existingUserIndex >= 0) {
      // 保留原有的 bio 等信息，只更新 Google 返回的基本信息
      users[existingUserIndex] = {
        ...users[existingUserIndex],
        ...userProfile,
        lastLogin: new Date().toISOString()
      };
    } else {
      users.push({
        ...userProfile,
        bio: '',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
    }
    await writeUsers(users);

    const sessionToken = Buffer.from(`${payload.sub}:${Date.now()}`).toString('base64');

    res.json({
      token: sessionToken,
      user: users[existingUserIndex >= 0 ? existingUserIndex : users.length - 1],
    });
  } catch (err) {
    console.error('Google auth failed', err);
    res.status(401).json({ message: 'Google 登录失败，请重试' });
  }
});

// 处理 Reaction (点赞/表情回应)
app.post('/api/react', async (req, res) => {
  try {
    const { targetId, type, emoji, userId } = req.body;
    if (!targetId || !type || !emoji) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 确定操作的是帖子还是消息
    let items;
    let writeFunc;
    if (type === 'post') {
      items = await readData();
      writeFunc = writeData;
    } else if (type === 'message') {
      items = await readMessages();
      writeFunc = writeMessages;
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const item = items.find(i => i.id === targetId);
    if (!item) {
      return res.status(404).json({ message: 'Target not found' });
    }

    // 初始化 reactions 对象
    if (!item.reactions) {
      item.reactions = {};
    }
    
    // 兼容旧数据：如果 reactions 为空但 upvotes > 0，初始化 '👍'
    if (Object.keys(item.reactions).length === 0 && item.upvotes > 0) {
      // 这里我们无法知道是谁点的赞，所以只能留空或者忽略旧的 upvotes
      // 为了简单起见，我们暂时忽略旧的 upvotes 计数，或者你可以选择保留它作为显示
      // item.reactions['👍'] = []; 
    }

    // 确保该 emoji 的数组存在
    if (!item.reactions[emoji]) {
      item.reactions[emoji] = [];
    }

    // 获取用户标识 (userId 或 IP)
    const userIdentifier = userId || getClientIP(req);

    // 切换状态
    const index = item.reactions[emoji].indexOf(userIdentifier);
    if (index > -1) {
      // 已存在 -> 移除 (取消点赞)
      item.reactions[emoji].splice(index, 1);
      // 如果数组为空，可以删除该 key
      if (item.reactions[emoji].length === 0) {
        delete item.reactions[emoji];
      }
    } else {
      // 不存在 -> 添加 (点赞)
      item.reactions[emoji].push(userIdentifier);
    }

    // 更新 upvotes 字段以保持兼容性 (总数)
    let totalReactions = 0;
    Object.values(item.reactions).forEach(arr => {
      totalReactions += arr.length;
    });
    item.upvotes = totalReactions;

    await writeFunc(items);
    res.json({ 
      success: true, 
      reactions: item.reactions, 
      upvotes: item.upvotes 
    });
  } catch (err) {
    console.error('Reaction error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 处理所有其他请求，返回 index.html (支持前端路由)
app.get(/(.*)/, (req, res) => {
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
let server;

if (httpsOptions) {
  server = https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on https://0.0.0.0:${PORT}`);
    console.log('已启用 SSL，确保前端通过 HTTPS 访问');
  });
} else {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP Server is running on http://0.0.0.0:${PORT} (Using JSON storage)`);
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
