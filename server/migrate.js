const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Post = require('./models/Post');
const Message = require('./models/Message');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raddit';

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Part 1: Link orphan content (missing authorId) to Users by name
    console.log('--- Part 1: Linking orphan content by name ---');
    const users = await User.find({});
    const userMap = new Map(); // name -> user
    const duplicateNames = new Set();

    for (const user of users) {
      if (userMap.has(user.name)) {
        duplicateNames.add(user.name);
      } else {
        userMap.set(user.name, user);
      }
    }

    // Remove duplicates from map to avoid wrong linking
    for (const name of duplicateNames) {
      userMap.delete(name);
      console.log(`Skipping linking for name "${name}" due to duplicates.`);
    }

    // Update Posts
    const orphanPosts = await Post.find({ authorId: { $exists: false } }); // or null/empty
    // Actually check for null or empty string
    const postsToLink = await Post.find({ $or: [{ authorId: { $exists: false } }, { authorId: null }, { authorId: '' }] });
    console.log(`Found ${postsToLink.length} posts missing authorId.`);

    for (const post of postsToLink) {
      if (userMap.has(post.author)) {
        const user = userMap.get(post.author);
        post.authorId = user.googleId;
        post.authorAvatar = user.picture; // Sync avatar too while we are at it
        await post.save();
        console.log(`Linked Post "${post.title}" to user ${user.name}`);
      }
    }

    // Update Messages
    const messagesToLink = await Message.find({ $or: [{ authorId: { $exists: false } }, { authorId: null }, { authorId: '' }] });
    console.log(`Found ${messagesToLink.length} messages missing authorId.`);

    for (const msg of messagesToLink) {
      if (userMap.has(msg.author)) {
        const user = userMap.get(msg.author);
        msg.authorId = user.googleId;
        msg.authorAvatar = user.picture;
        msg.authorBio = user.bio;
        await msg.save();
        console.log(`Linked Message "${msg.content.substring(0, 20)}..." to user ${user.name}`);
      }
    }

    // Part 2: Sync denormalized data for all content with authorId
    console.log('\n--- Part 2: Syncing denormalized data ---');
    
    for (const user of users) {
      // Update Posts
      await Post.updateMany(
        { authorId: user.googleId },
        { 
          $set: { 
            author: user.name,
            authorAvatar: user.picture
          } 
        }
      );

      // Update Messages
      await Message.updateMany(
        { authorId: user.googleId },
        { 
          $set: { 
            author: user.name,
            authorAvatar: user.picture,
            authorBio: user.bio
          } 
        }
      );

      // Update Replies (mentions)
      await Message.updateMany(
        { replyToUserId: user.googleId },
        { 
          $set: { 
            replyToName: user.name
          } 
        }
      );
    }
    console.log('Data sync completed.');

    console.log('Migration finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
