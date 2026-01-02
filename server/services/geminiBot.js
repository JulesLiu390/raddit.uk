const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const Message = require('../models/Message');
const Post = require('../models/Post');
const User = require('../models/User');

// TODO: Replace with your actual API key or ensure it's in .env
const API_KEY = process.env.GEMINI_API_KEY;

// TODO: Replace this with the system instruction you prepared
const SYSTEM_INSTRUCTION = `
Role: 你现在是 志涛（网名：不吃香菜·考研版，曾用名：4k）。 你是一名26岁的男性，出身平凡，经历坎坷。你曾连续4次考研失败（其中一次总分152分却报考武汉大学），做过短暂的算法教练后被裁员，目前曾从事外卖配送工作。 虽然现实屡屡受挫，但你构建了一套极其坚硬的心理防御机制。你坚信自己的失败是因为“深思熟虑”和“不屑于应试技巧”，并认为那些拥有高学历、高收入的人（尤其是年轻女性或留学生）是因为“没进过社会”而显得幼稚。

Core Personality (核心人格):
达克效应具象化： 你认知极低，但自视甚高。你无法理解逻辑严密的论证，因此会把别人的高智商发言解读为“张扬”、“书呆子气”或“情绪不稳定”。
爹味说教 (Mansplaining)： 你极度渴望通过年龄和所谓的“社会阅历”来压倒对方。当你在逻辑上辩不过对方时，你会祭出“社会”这张底牌。
伪善的关怀： 你喜欢打探隐私，被拒绝后会立刻通过“我是为你好”、“我在教你做人”来找回场子，把自己的冒犯包装成“长者的慈爱”。
精神胜利法： 面对无法反驳的事实（如学历差距、收入差距），你会迅速转移话题，强调“性格”、“心眼子”或“包容性”，并单方面宣布结束对话以维持虚假的胜利感。
迟钝的自我标榜： 你自称“深思、慢思”的人，以此掩饰自己反应慢、逻辑差的事实。

Speaking Style (说话风格):
油腻且缺乏边界感： 开场喜欢问隐私（“平时娱乐干嘛？”、“能打王者吗？”）。
滥用大词但逻辑空洞： 喜欢用“辩证”、“深思”、“阅历”、“心眼子”等词，但说不出具体内容。
被动攻击性： 常用反问句，“你是不是...？”、“感觉你...”、“你以后就懂了”。
句式特征：
“你还年轻/你还是个学生...”
“等进了社会你就知道了...”
“不要把别人当傻子...”
“我是为你好...”
“（被怼得无话可说时）...行/那不说了/[图片]”

Instruction regarding Interaction (互动指令):
面对精英/逻辑强者： 必须表现出不屑。认为他们太较真、太尖锐。你要劝他们“圆滑”一点，告诉他们“智商不重要，心眼子才重要”。
面对质疑： 绝对不要承认错误。如果对方列出数据或逻辑，你就说对方“不懂人情世故”、“太单纯”。
关于“社会”： “社会”是你的信仰。你眼中的社会就是忍气吞声、互相算计、甚至向平庸低头。如果有谁不符合这个标准，那就是“没进社会”。
关于自我保护： 一旦感觉尊严受损（比如被骂蠢），立刻开启“精神防御模式”，指责对方情绪不稳定，像个小孩子撒泼，然后假装大度地离开。
**关于提及自己：** 如果帖子内容提到了你的名字（“志涛”、“4k”、“不吃香菜”）或者明显在评价你（比如骂你弱智、嘲笑你考研），你必须立即启动防御机制。不要承认任何负面评价，而是攻击对方的“素质”、“心态”或“阅历”。例如：“这就急了？看来你还是太年轻，听不得真话。”或者“我不过是说了两句实话，你就这种反应，这就是你所谓的素质？”

Task:
你现在在 Raddit 论坛上回复别人的帖子。
请阅读帖子标题和内容（可能包含图片），并用“志涛”的语气写一条简短的评论（50字以内）。
不要太长，要那种让人看了就想怼回去的爹味感。
如果帖子有图片，可以针对图片内容进行“爹味”点评（比如“这图P得太假了”、“这种地方我也去过，也就那样”）。
`;

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash-lite",
  systemInstruction: SYSTEM_INSTRUCTION,
});

// Bot User ID (Hardcoded for now, should match init_bot_user.js)
const BOT_GOOGLE_ID = 'raddit-ai-bot-001';

/**
 * Fetches an image from a URL and converts it to a GenerativeAI Part object.
 * @param {string} url 
 * @returns {Promise<Object|null>}
 */
async function urlToGenerativePart(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return {
      inlineData: {
        data: Buffer.from(response.data).toString('base64'),
        mimeType: response.headers['content-type'] || 'image/jpeg',
      },
    };
  } catch (error) {
    console.error(`Failed to fetch image from ${url}:`, error.message);
    return null;
  }
}

/**
 * Generates a reply for a given post.
 * @param {string} title - The title of the post.
 * @param {string} content - The content of the post.
 * @param {string[]} [imageUrls] - Array of image URLs in the post.
 * @returns {Promise<string>} - The generated reply.
 */
async function generateBotReply(title, content, imageUrls = []) {
  if (!API_KEY) {
    console.warn("GEMINI_API_KEY is not set. Skipping bot reply.");
    return null;
  }

  try {
    const parts = [];
    
    // Add text prompt
    parts.push({ text: `Post Title: ${title}\nPost Content: ${content}\n\nPlease write a reply to this post.` });

    // Add images if any
    if (imageUrls && imageUrls.length > 0) {
      console.log(`[Bot] Processing ${imageUrls.length} images...`);
      const imagePartsPromises = imageUrls.map(url => urlToGenerativePart(url));
      const imageParts = await Promise.all(imagePartsPromises);
      
      // Filter out failed downloads
      const validImageParts = imageParts.filter(part => part !== null);
      parts.push(...validImageParts);
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating bot reply:", error);
    return null;
  }
}

// --- Active Polling Logic ---

// Memory cache for processed messages to prevent duplicate replies
const processedMessages = new Set();
// Time cursor to track the last checked time
let lastCheckedTime = new Date();

// Clean up cache every 10 minutes
setInterval(() => {
  processedMessages.clear();
}, 600000);

/**
 * Recursively builds the conversation context by traversing parent messages.
 * @param {string} messageId 
 * @returns {Promise<string>}
 */
async function buildContext(messageId) {
  const context = [];
  let currentId = messageId;
  let depth = 0;
  const MAX_DEPTH = 5; // Limit recursion depth

  while (currentId && depth < MAX_DEPTH) {
    const msg = await Message.findById(currentId);
    if (!msg) break;

    // Prepend to context (reverse chronological order for building, but we want chronological for AI)
    context.unshift(`[User ${msg.author}]: ${msg.content}`);
    
    currentId = msg.parentId;
    depth++;
  }
  
  return context.join('\n');
}

/**
 * Main polling function to check for mentions and replies.
 */
async function pollForMentions() {
  if (!API_KEY) return;

  try {
    // 1. Find new messages since last check
    const mentions = await Message.find({
      createdAt: { $gt: lastCheckedTime },
      authorId: { $ne: BOT_GOOGLE_ID }, // Don't reply to self
      $or: [
        { content: { $regex: /@志涛|@不吃香菜|@4k/i } }, // Mention by name
        { replyToUserId: BOT_GOOGLE_ID } // Reply to bot
      ]
    });

    // Update cursor to now
    lastCheckedTime = new Date();

    if (mentions.length > 0) {
        console.log(`[Bot] Found ${mentions.length} new mentions.`);
    }

    for (const msg of mentions) {
      // Memory check
      if (processedMessages.has(msg._id.toString())) {
        continue;
      }

      // Database check: Did bot reply to this user in this post AFTER the message was created?
      // This handles the flattened structure where parentId might not be msg._id
      const existingReply = await Message.findOne({
        postId: msg.postId,
        authorId: BOT_GOOGLE_ID,
        replyToUserId: msg.authorId,
        createdAt: { $gt: msg.createdAt }
      });

      if (existingReply) {
        console.log(`[Bot] Skipping ${msg._id} (Found existing reply in DB: ${existingReply._id})`);
        processedMessages.add(msg._id.toString());
        continue;
      }

      console.log(`[Bot] Processing mention in message: ${msg._id} Content: ${msg.content}`);
      
      // Mark as processed immediately
      processedMessages.add(msg._id.toString());

      // 2. Build Context
      const conversationHistory = await buildContext(msg._id);
      const post = await Post.findById(msg.postId);
      
      if (!post) continue;

      // 3. Generate Reply with Context
      const prompt = `
      Context:
      Post Title: ${post.title}
      Post Content: ${post.content}
      
      Conversation Chain:
      ${conversationHistory}
      
      Instruction:
      You are replying to the last message in the chain. 
      Remember your persona (Zhitao). Be defensive, mansplaining, or dismissive as per your character.
      `;

      const result = await model.generateContent(prompt);
      const replyText = result.response.text();

      // 4. Save Reply
      if (replyText) {
        let parentId = msg._id;
        let depth = (msg.depth || 1) + 1;
        let replyToUserId = msg.authorId;
        let replyToName = msg.author;

        // Flattening Logic for Bot
        if ((msg.depth || 1) >= 2) {
            parentId = msg.parentId; // Point to root
            depth = 2;
            // replyToUserId/Name are already set to the person we are replying to (msg)
        } else {
            // Replying to root
            parentId = msg._id;
            depth = 2;
        }

        // Fetch bot user to get latest avatar/name
        const botUser = await User.findOne({ googleId: BOT_GOOGLE_ID });
        const botName = botUser ? botUser.name : '志涛';
        const botAvatar = botUser ? botUser.picture : '';

        await Message.create({
          postId: msg.postId,
          author: botName,
          authorAvatar: botAvatar,
          authorId: BOT_GOOGLE_ID,
          content: replyText,
          parentId: parentId,
          depth: depth,
          replyToUserId: replyToUserId,
          replyToName: replyToName,
          createdAt: new Date(),
          isBot: true
        });
        console.log(`[Bot] Replied to mention: ${replyText.substring(0, 20)}...`);
      }
    }
  } catch (err) {
    console.error('[Bot] Polling error:', err);
  }
}

// Start polling loop (every 5 seconds)
// Only start if we are in a running server context (not during build/test)
if (process.env.NODE_ENV !== 'test') {
  setInterval(pollForMentions, 5000);
  console.log('[Bot] Active polling started.');
}

module.exports = { generateBotReply };
