const mongoose = require('mongoose');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raddit';
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

const BOT_USER = {
  googleId: 'raddit-ai-bot-001',
  name: '不吃香菜（考研版）',
  email: 'zhitao@raddit.uk',
  emailVerified: true,
  bio: '祝大家，多喜乐，常安宁。',
};

function uploadImageToImgBB(imagePath) {
    return new Promise((resolve, reject) => {
        if (!IMGBB_API_KEY) {
            return reject(new Error('IMGBB_API_KEY is missing in environment variables'));
        }

        try {
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            
            const postData = new URLSearchParams();
            postData.append('key', IMGBB_API_KEY);
            postData.append('image', base64Image);
            
            const data = postData.toString();

            const options = {
                hostname: 'api.imgbb.com',
                port: 443,
                path: '/1/upload',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => responseBody += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(responseBody);
                        if (json.success) {
                            resolve(json.data.url);
                        } else {
                            reject(new Error('ImgBB Error: ' + (json.error ? json.error.message : 'Unknown error')));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write(data);
            req.end();

        } catch (err) {
            reject(err);
        }
    });
}

async function initBotUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Upload Avatar
    const imagePath = path.join(__dirname, '../assets/image.png');
    let avatarUrl = null;
    
    if (fs.existsSync(imagePath)) {
        console.log('Found avatar image at:', imagePath);
        console.log('Uploading to ImgBB...');
        try {
            avatarUrl = await uploadImageToImgBB(imagePath);
            console.log('Avatar uploaded successfully:', avatarUrl);
            BOT_USER.picture = avatarUrl;
        } catch (uploadErr) {
            console.error('Failed to upload avatar:', uploadErr.message);
            console.log('Falling back to existing picture or placeholder.');
        }
    } else {
        console.warn('Avatar image not found at:', imagePath);
    }

    // 1. Try to find by Google ID (Primary Identity)
    let bot = await User.findOne({ googleId: BOT_USER.googleId });    if (bot) {
        console.log(`Found bot by Google ID: ${bot.googleId}`);
        bot.name = BOT_USER.name;
        bot.picture = BOT_USER.picture;
        bot.bio = BOT_USER.bio;
        
        // Update email if needed, checking for conflicts
        if (bot.email !== BOT_USER.email) {
             const emailTaken = await User.findOne({ email: BOT_USER.email });
             if (emailTaken && emailTaken._id.toString() !== bot._id.toString()) {
                 console.warn(`Cannot update email to ${BOT_USER.email}, taken by another user. Keeping existing email: ${bot.email}`);
             } else {
                 bot.email = BOT_USER.email;
             }
        }
        
        await bot.save();
        console.log('Bot profile updated.');
    } else {
        // 2. If not found by ID, try by Email (Old Identity?)
        let existingByEmail = await User.findOne({ email: BOT_USER.email });
        if (existingByEmail) {
             console.log(`Found bot by Email: ${existingByEmail.email}. Updating Google ID...`);
             existingByEmail.googleId = BOT_USER.googleId;
             existingByEmail.name = BOT_USER.name;
             existingByEmail.picture = BOT_USER.picture;
             existingByEmail.bio = BOT_USER.bio;
             await existingByEmail.save();
             console.log('Bot user migrated and updated.');
        } else {
            // 3. Create new
            bot = await User.create(BOT_USER);
            console.log('Bot user created successfully.');
        }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error initializing bot user:', error);
    process.exit(1);
  }
}

initBotUser();
