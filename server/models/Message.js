const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  postId: {
    type: String, // Keeping as String to match existing logic, or could be ObjectId if we migrate fully
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  authorAvatar: String,
  authorId: String, // Google ID
  parentId: {
    type: String,
    default: null
  },
  depth: {
    type: Number,
    default: 1
  },
  replyToUserId: String,
  replyToName: String,
  authorBio: String,
  isVerified: {
    type: Boolean,
    default: false
  },
  upvotes: {
    type: Number,
    default: 0
  },
  reactions: {
    type: Map,
    of: [String], // Array of userIds/IPs who reacted
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
