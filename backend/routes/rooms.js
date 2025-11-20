const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const Message = require('../models/Message');
const Poll = require('../models/Poll');

const router = express.Router();

const generateAnonymousId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'Anon#';
  for (let i = 0; i < 4; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateRoomCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let exists = true;

  while (exists) {
    code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // eslint-disable-next-line no-await-in-loop
    exists = await Room.exists({ code });
  }

  return code;
};

const mapRoom = (room) => ({
  id: room._id.toString(),
  name: room.name,
  code: room.code,
  created_by: room.createdBy.toString(),
  is_active: room.isActive,
  created_at: room.createdAt,
  updated_at: room.updatedAt,
});

const mapMember = (member) => ({
  id: member._id.toString(),
  room_id: member.roomId.toString(),
  user_id: member.userId.toString(),
  anonymous_id: member.anonymousId,
  joined_at: member.joinedAt,
  is_active: member.isActive,
});

const mapMessage = (message, replyToMap = new Map()) => {
  const reply = message.replyTo ? replyToMap.get(message.replyTo.toString()) : null;

  return {
    id: message._id.toString(),
    room_id: message.roomId.toString(),
    user_id: message.userId.toString(),
    anonymous_id: message.anonymousId,
    content: message.content,
    created_at: message.createdAt,
    reply_to: message.replyTo ? message.replyTo.toString() : null,
    parent_message: reply
      ? {
          id: reply._id.toString(),
          content: reply.content,
          anonymous_id: reply.anonymousId,
        }
      : null,
    reactions: Object.fromEntries(message.reactions || []),
    user_reactions: Object.fromEntries(message.userReactions || []),
  };
};

const mapPoll = (poll) => ({
  id: poll._id.toString(),
  room_id: poll.roomId.toString(),
  created_by: poll.createdBy.toString(),
  creator_anonymous_id: poll.creatorAnonymousId,
  question: poll.question,
  poll_type: poll.pollType,
  options: poll.options,
  votes: Object.fromEntries(poll.votes || []),
  vote_counts: poll.voteCounts,
  is_active: poll.isActive,
  created_at: poll.createdAt,
});

router.post(
  '/',
  auth,
  [body('name').isLength({ min: 3 }).withMessage('Room name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const code = await generateRoomCode();
      const room = await Room.create({
        name: req.body.name,
        code,
        createdBy: req.user.id,
        organizerAnonymousId: generateAnonymousId(),
      });

      const member = await RoomMember.create({
        roomId: room._id,
        userId: req.user.id,
        anonymousId: room.organizerAnonymousId,
      });

      res.status(201).json({
        room: mapRoom(room),
        member: mapMember(member),
        anonymousId: member.anonymousId,
        isOrganizer: true,
      });
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  }
);

router.post(
  '/join',
  auth,
  [body('code').isLength({ min: 6, max: 6 }).withMessage('Valid room code required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const room = await Room.findOne({ code: req.body.code.toUpperCase() });

      if (!room || room.isActive === false) {
        return res.status(404).json({ error: 'Room not found or inactive' });
      }

      let member = await RoomMember.findOne({ roomId: room._id, userId: req.user.id });
      let anonymousId;

      if (!member) {
        anonymousId = generateAnonymousId();
        member = await RoomMember.create({
          roomId: room._id,
          userId: req.user.id,
          anonymousId,
        });
      } else {
        anonymousId = member.anonymousId;
        if (!member.isActive) {
          member.isActive = true;
          member.joinedAt = new Date();
          await member.save();
        }
      }

      res.json({
        room: mapRoom(room),
        member: mapMember(member),
        anonymousId,
        isOrganizer: room.createdBy.toString() === req.user.id,
      });
    } catch (error) {
      console.error('Join room error:', error);
      res.status(500).json({ error: 'Failed to join room' });
    }
  }
);

router.post('/:roomId/leave', auth, async (req, res) => {
  try {
    const member = await RoomMember.findOne({
      roomId: req.params.roomId,
      userId: req.user.id,
    });

    if (!member) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    member.isActive = false;
    await member.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

router.post('/:roomId/end', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only organizer can end the room' });
    }

    room.isActive = false;
    await room.save();

    await RoomMember.updateMany({ roomId: room._id }, { isActive: false });

    res.json({ success: true });
  } catch (error) {
    console.error('End room error:', error);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const memberships = await RoomMember.find({ userId: req.user.id })
      .sort({ joinedAt: -1 })
      .populate('roomId');

    const rooms = await Promise.all(
      memberships.map(async (member) => {
        const room = member.roomId;
        if (!room) return null;

        const activeCount = await RoomMember.countDocuments({
          roomId: room._id,
          isActive: true,
        });

        return {
          ...mapRoom(room),
          joined_at: member.joinedAt,
          member_count: activeCount,
          member_is_active: member.isActive,
        };
      })
    );

    res.json({ rooms: rooms.filter(Boolean) });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to load room history' });
  }
});

router.get('/:roomId/state', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const membership = await RoomMember.findOne({
      roomId: room._id,
      userId: req.user.id,
      isActive: true,
    });

    if (!membership) {
      return res.status(403).json({ error: 'User is not an active member of this room' });
    }

    const members = await RoomMember.find({ roomId: room._id, isActive: true });
    const polls = await Poll.find({ roomId: room._id, isActive: true }).sort({ createdAt: -1 });

    const messages = await Message.find({ roomId: room._id })
      .sort({ createdAt: 1 })
      .limit(200);

    const messageMap = new Map(messages.map((msg) => [msg._id.toString(), msg]));

    res.json({
      room: mapRoom(room),
      members: members.map(mapMember),
      polls: polls.map(mapPoll),
      messages: messages.map((msg) => mapMessage(msg, messageMap)),
    });
  } catch (error) {
    console.error('Room state error:', error);
    res.status(500).json({ error: 'Failed to load room state' });
  }
});

module.exports = router;

