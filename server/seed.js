const mongoose = require('mongoose');
require('dotenv').config();
const Post = require('./models/Post');

const mockPosts = [
  { title: '如何评价睡前消息称国产茶类饮品（点名某茶姬）咖啡因含量过高，是准毒品的擦边球？', content: '详细内容...', heat: 1661, thumbnail: 'https://picsum.photos/300/200?random=1' },
  { title: '为什么北京经济第一强区海淀至今没有苹果直营店？', content: '详细内容...', heat: 568, thumbnail: 'https://picsum.photos/300/200?random=2' },
  { title: '韩国财阀千金黄荷娜在柬埔寨被逮捕，被曝为电诈园区洗钱，吸毒史长达十余年，她被逮捕后将面临什么？', content: '详细内容...', heat: 468, thumbnail: 'https://picsum.photos/300/200?random=3' },
  { title: '王小骞称 11 岁女儿过度控制饮食患上「正食症」，什么是「正食症」？如何干预?', content: '详细内容...', heat: 352 },
  { title: '海南封关对新加坡有影响吗？', content: '详细内容...', heat: 294, thumbnail: 'https://picsum.photos/300/200?random=5' },
  { title: '女子为出片擅闯在建地铁隧道拍照，她是怎么进去的？除了她本人，管理方又该承担哪些责任？', content: '详细内容...', heat: 170, thumbnail: 'https://picsum.photos/300/200?random=6' },
  { title: '南博「99% 纯金」西汉金兽被质疑掉色，院方称属出土文物正常现象，具体是怎么回事？', content: '详细内容...', heat: 160, thumbnail: 'https://picsum.photos/300/200?random=7' },
  { title: '为啥川普这么大年龄天天把可乐当水喝，人还没事？', content: '详细内容...', heat: 154, thumbnail: 'https://picsum.photos/300/200?random=8' },
  { title: '知名电竞选手 Faker 见面会门票 1588 元，如何看待这一定价？你觉得值吗？', content: '详细内容...', heat: 149, thumbnail: 'https://picsum.photos/300/200?random=9' },
  { title: '如果只能用一个词来形容人和 AI 的区别以及人类的本质特征，你会选什么词？', content: '详细内容...', heat: 142 },
  { title: '2025 年有哪些值得期待的科技产品？', content: '详细内容...', heat: 135, thumbnail: 'https://picsum.photos/300/200?random=11' },
  { title: '程序员如何保持学习的动力和热情？', content: '详细内容...', heat: 128 },
  { title: '你见过最离谱的代码是什么样的？', content: '详细内容...', heat: 121, thumbnail: 'https://picsum.photos/300/200?random=13' },
  { title: '有哪些让你相见恨晚的学习方法？', content: '详细内容...', heat: 114 },
  { title: '2025 年学什么编程语言最有前途？', content: '详细内容...', heat: 107, thumbnail: 'https://picsum.photos/300/200?random=15' },
  { title: '如何优雅地拒绝不合理的工作需求？', content: '详细内容...', heat: 100 },
  { title: '远程办公真的能提高效率吗？', content: '详细内容...', heat: 93, thumbnail: 'https://picsum.photos/300/200?random=17' },
  { title: '年轻人应该买房还是租房？', content: '详细内容...', heat: 86 },
  { title: '有哪些冷门但很实用的网站推荐？', content: '详细内容...', heat: 79, thumbnail: 'https://picsum.photos/300/200?random=19' },
  { title: '如何看待「躺平」这种生活态度？', content: '详细内容...', heat: 72 },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/raddit');
    console.log('Connected to MongoDB for seeding...');
    
    await Post.deleteMany({});
    console.log('Cleared existing posts.');
    
    await Post.insertMany(mockPosts);
    console.log('Successfully seeded 20 mock posts.');
    
    process.exit();
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

seedDB();
