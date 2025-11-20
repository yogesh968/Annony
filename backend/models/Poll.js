const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    creatorAnonymousId: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    pollType: {
      type: String,
      enum: ['custom', 'yesno'],
      default: 'custom',
    },
    options: {
      type: [String],
      required: true,
      validate: (val) => val.length > 0,
    },
    votes: {
      type: Map,
      of: Number,
      default: {},
    },
    voteCounts: {
      type: [Number],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Poll', pollSchema);

