const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  heat: {
    type: Number,
    default: 0
  },
  thumbnail: {
    type: String,
    default: ''
  },
  author: {
    type: String,
    default: 'Anonymous'
  },
  authorAvatar: String,
  authorId: String,
  topics: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic'
    },
    name: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  reactions: {
    type: Map,
    of: [String], // Array of userIds/IPs who reacted
    default: {}
  },
  followers: {
    type: [String], // Array of userIds (googleId) who follow this post
    default: []
  }
});

// Add a virtual 'id' field that returns _id as string
postSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtuals are included in JSON output
postSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {   delete ret._id; delete ret.__v; }
});

module.exports = mongoose.model('Post', postSchema);
