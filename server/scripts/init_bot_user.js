const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raddit';

const BOT_USER = {
  googleId: 'raddit-ai-bot-001',
  name: '不吃香菜（考研版）',
  email: 'zhitao@raddit.uk',
  // Assuming the image is placed in client/public/assets/4k_avatar.png or similar accessible URL
  // If using local file, ensure it is served statically. For now, using a placeholder path.
  picture: '/assets/4k_avatar.png', 
  emailVerified: true,
  bio: '祝大家，多喜乐，常安宁。',
};

async function initBotUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    let bot = await User.findOne({ googleId: BOT_USER.googleId });

    if (bot) {
      console.log('Bot user found, updating profile...');
      bot.name = BOT_USER.name;
      bot.picture = BOT_USER.picture;
      bot.bio = BOT_USER.bio;
      await bot.save();
      console.log('Bot profile updated to:', bot.name);
    } else {
      bot = await User.create(BOT_USER);
      console.log('Bot user created successfully:', bot.name);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error initializing bot user:', error);
    process.exit(1);
  }
}

initBotUser();
