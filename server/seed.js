const mongoose = require('mongoose');
require('dotenv').config();
const Post = require('./models/Post');

const mockPosts = [];

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
