const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String, // Emoji or URL
    default: '💬'
  },
  creatorId: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  postCount: {
    type: Number,
    default: 0
  }
});

// Virtual for id
topicSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

topicSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) { delete ret._id; delete ret.__v; }
});

module.exports = mongoose.model('Topic', topicSchema);
