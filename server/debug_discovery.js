const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Message = require('./models/Message');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raddit';

async function debugDiscovery() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const targetGoogleId = '106065900426123009254'; // From screenshot
    const user = await User.findOne({ googleId: targetGoogleId });

    if (!user) {
      console.log('User not found!');
      return;
    }

    console.log(`User found: ${user.name} (${user.googleId})`);
    console.log('Following Users:', user.followingUsers);
    console.log('Followed Posts:', user.followedPosts);

    const followingUserIds = user.followingUsers || [];
    
    if (followingUserIds.length === 0) {
        console.log('User is not following anyone.');
    } else {
        console.log('--- Checking Followed Users ---');
        for (const followedId of followingUserIds) {
            const followedUser = await User.findOne({ googleId: followedId });
            console.log(`Followed User ID: ${followedId}`);
            if (followedUser) {
                console.log(`  Name: ${followedUser.name}`);
            } else {
                console.log(`  User object not found in DB!`);
            }

            // Check posts by this user
            const posts = await Post.find({ authorId: followedId });
            console.log(`  Posts count: ${posts.length}`);
            if (posts.length > 0) {
                console.log(`  Sample Post AuthorId: ${posts[0].authorId}`);
                console.log(`  Sample Post CreatedAt: ${posts[0].createdAt}`);
                console.log(`  Current Server Time: ${new Date()}`);
            }

            // Check messages by this user
            const messages = await Message.find({ authorId: followedId });
            console.log(`  Messages count: ${messages.length}`);
            if (messages.length > 0) {
                console.log(`  Sample Message Depth: ${messages[0].depth}`);
            }
        }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

debugDiscovery();
