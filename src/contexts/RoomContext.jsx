import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { socketService } from '../lib/socket';
import { useAuth } from './AuthContext';

const RoomContext = createContext(undefined);
const STORAGE_KEY = 'anonymeet_current_room';

const mapMembersFromSocket = (members, roomId) =>
  (members || []).map((member) => ({
    id: member.userId,
    room_id: roomId,
    user_id: member.userId,
    anonymous_id: member.anonymousId,
    joined_at: member.joinedAt,
    is_active: true,
  }));

const normalizeSocketPoll = (pollData, userId) => ({
  id: pollData.id,
  room_id: pollData.roomId,
  created_by: pollData.createdBy,
  creator_anonymous_id: pollData.creatorAnonymousId || pollData.creator_anonymous_id,
  question: pollData.question,
  poll_type: pollData.pollType,
  options: pollData.options,
  created_at: pollData.createdAt,
  is_active: pollData.isActive ?? pollData.is_active ?? true,
  vote_counts: pollData.voteCounts || [],
  votes: pollData.votes || {},
  total_votes: (pollData.voteCounts || []).reduce((sum, count) => sum + count, 0),
  user_vote: pollData.votes ? pollData.votes[userId] ?? null : null,
});

const normalizeRestPoll = (poll, userId) => ({
  ...poll,
  total_votes: (poll.vote_counts || []).reduce((sum, count) => sum + count, 0),
  user_vote: poll.votes ? poll.votes[userId] ?? null : null,
});

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

export const RoomProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [currentUserMember, setCurrentUserMember] = useState(null);

  const persistRoomSession = (room, organizerFlag, anonymousId) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ room, isOrganizer: organizerFlag, anonymousId })
    );
  };

  const clearRoomSession = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    if (!currentRoom || !user) return;

    const socket = socketService.connect();

    const handleNewMessage = (messageData) => {
      setMessages((prev) => [...prev, messageData]);
    };

    const handleReactionUpdate = (reactionData) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === reactionData.messageId) {
            return {
              ...msg,
              reactions: reactionData.reactions,
              user_reaction: reactionData.user_reactions[user.id] || null,
            };
          }
          return msg;
        })
      );
    };

    const handleNewPoll = (pollData) => {
      setPolls((prev) => [normalizeSocketPoll(pollData, user.id), ...prev]);
    };

    const handlePollVoteUpdate = (voteData) => {
      setPolls((prev) =>
        prev.map((poll) =>
          poll.id === voteData.pollId
            ? {
                ...poll,
                vote_counts: voteData.voteCounts,
                total_votes: voteData.totalVotes,
                user_vote: voteData.userId === user.id ? voteData.optionIndex : poll.user_vote,
              }
            : poll
        )
      );
    };

    const handlePollEnded = ({ pollId }) => {
      setPolls((prev) => prev.filter((poll) => poll.id !== pollId));
    };

    const handleRoomState = (stateData) => {
      setRoomMembers(mapMembersFromSocket(stateData.members || [], currentRoom.id));
      setMessages(stateData.messages || []);
      setPolls(
        (stateData.polls || []).map((poll) => normalizeSocketPoll(poll, user.id))
      );
    };

    const handleUserJoined = (data) => {
      setRoomMembers(mapMembersFromSocket(data.members || [], currentRoom.id));
    };

    const handleUserLeft = (data) => {
      setRoomMembers(mapMembersFromSocket(data.members || [], currentRoom.id));
    };

    const handleMessageError = (error) => {
      console.error('Message error:', error.error);
      alert(error.error);
    };

    const handlePollError = (error) => {
      console.error('Poll error:', error.error);
      alert(error.error);
    };

      socket.on('new_message', handleNewMessage);
      socket.on('reaction_update', handleReactionUpdate);
      socket.on('new_poll', handleNewPoll);
      socket.on('poll_vote_update', handlePollVoteUpdate);
      socket.on('poll_ended', handlePollEnded);
      socket.on('room_state', handleRoomState);
      socket.on('user_joined', handleUserJoined);
      socket.on('user_left', handleUserLeft);
      socket.on('message_error', handleMessageError);
      socket.on('poll_error', handlePollError);
    
    // Join the room once socket is connected and we have currentUserMember
    const joinRoomIfReady = async () => {
      if (socket.connected && currentUserMember) {
        try {
          await socketService.joinRoom(currentRoom.id, user.id, currentUserMember.anonymous_id);
        } catch (err) {
          console.error('Failed to join room via socket:', err);
        }
      }
    };

    // Try to join immediately if already connected
    joinRoomIfReady();
    
    // Also join when socket connects
    socket.on('connect', joinRoomIfReady);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('reaction_update', handleReactionUpdate);
      socket.off('new_poll', handleNewPoll);
      socket.off('poll_vote_update', handlePollVoteUpdate);
      socket.off('poll_ended', handlePollEnded);
      socket.off('room_state', handleRoomState);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('message_error', handleMessageError);
      socket.off('poll_error', handlePollError);
      socket.off('connect', joinRoomIfReady);
    };
  }, [currentRoom, user, currentUserMember]);

  useEffect(() => {
    if (!user || currentRoom) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    let parsed;
    try {
      parsed = JSON.parse(saved);
    } catch (error) {
      clearRoomSession();
      return;
    }

    setLoading(true);
    apiClient
      .get(`/api/rooms/${parsed.room.id}/state`)
      .then((state) => {
        setCurrentRoom(state.room);
        setIsOrganizer(parsed.isOrganizer);
        setRoomMembers(state.members || []);
        setMessages(state.messages || []);
        setPolls((state.polls || []).map((poll) => normalizeRestPoll(poll, user.id)));

        const activeMember = (state.members || []).find(
          (member) => member.user_id === user.id
        );

        setCurrentUserMember(
          activeMember || {
            id: user.id,
            room_id: state.room.id,
            user_id: user.id,
            anonymous_id: parsed.anonymousId,
            joined_at: new Date().toISOString(),
            is_active: true,
          }
        );

        // Socket join will happen in the useEffect when currentUserMember is set
      })
      .catch((error) => {
        console.error('Failed to restore room session:', error);
        clearRoomSession();
      })
      .finally(() => setLoading(false));
  }, [user, currentRoom]);

  useEffect(() => {
    if (user) return;

    setCurrentRoom(null);
    setRoomMembers([]);
    setMessages([]);
    setPolls([]);
    setIsOrganizer(false);
    setCurrentUserMember(null);
    clearRoomSession();
  }, [user]);

  const createRoom = async (name) => {
    if (!user) throw new Error('User not authenticated');

    setLoading(true);
    try {
      const { room, member, anonymousId, isOrganizer: organizerFlag } = await apiClient.post(
        '/api/rooms',
        { name }
      );

      setCurrentRoom(room);
      setIsOrganizer(organizerFlag);
      setCurrentUserMember(member);
      setRoomMembers([member]);
      setMessages([]);
      setPolls([]);

      persistRoomSession(room, organizerFlag, anonymousId);
      
      // Socket join will happen in the useEffect when currentUserMember is set

      return room;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (code) => {
    if (!user) throw new Error('User not authenticated');

    setLoading(true);
    try {
      const { room, member, anonymousId, isOrganizer: organizerFlag } = await apiClient.post(
        '/api/rooms/join',
        { code }
      );

      setCurrentRoom(room);
      setIsOrganizer(organizerFlag);
      setCurrentUserMember(member);
      setRoomMembers([]);
      setMessages([]);
      setPolls([]);

      persistRoomSession(room, organizerFlag, anonymousId);
      
      // Socket join will happen in the useEffect when currentUserMember is set

      return room;
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = async () => {
    if (!user || !currentRoom || !currentUserMember) return;

    try {
      await apiClient.post(`/api/rooms/${currentRoom.id}/leave`);
      socketService.leaveRoom(currentRoom.id, user.id, currentUserMember.anonymous_id);
    } catch (error) {
      console.error('Error leaving room:', error);
      throw error;
    } finally {
      setCurrentRoom(null);
      setRoomMembers([]);
      setMessages([]);
      setPolls([]);
      setIsOrganizer(false);
      setCurrentUserMember(null);
      clearRoomSession();
    }
  };

  const endRoom = async () => {
    if (!user || !currentRoom || !isOrganizer) return;

    try {
      await apiClient.post(`/api/rooms/${currentRoom.id}/end`);
      socketService.leaveRoom(currentRoom.id, user.id, currentUserMember?.anonymous_id);
    } catch (error) {
      console.error('Error ending room:', error);
      throw error;
    } finally {
      setCurrentRoom(null);
      setRoomMembers([]);
      setMessages([]);
      setPolls([]);
      setIsOrganizer(false);
      setCurrentUserMember(null);
      clearRoomSession();
    }
  };

  const sendMessage = async (content, replyTo) => {
    if (!user || !currentRoom || !currentUserMember) return;

    socketService.sendMessage(
      currentRoom.id,
      user.id,
      content,
      currentUserMember.anonymous_id,
      replyTo
    );
  };

  const addReaction = (messageId, type) => {
    if (!user || !currentRoom || !currentUserMember) return;

    socketService.addReaction(currentRoom.id, messageId, user.id, type, currentUserMember.anonymous_id);
  };

  const createPoll = async (question, type, options) => {
    if (!user || !currentRoom || !currentUserMember) return;

    const pollOptions = type === 'yesno' ? ['Yes', 'No'] : options || [];

    socketService.createPoll(
      currentRoom.id,
      user.id,
      question,
      type,
      pollOptions,
      currentUserMember.anonymous_id
    );
  };

  const votePoll = async (pollId, optionIndex) => {
    if (!user || !currentRoom || !currentUserMember) return;

    socketService.votePoll(
      currentRoom.id,
      pollId,
      user.id,
      optionIndex,
      currentUserMember.anonymous_id
    );
  };

  const endPoll = async (pollId) => {
    if (!user || !currentRoom) return;

    socketService.endPoll(currentRoom.id, pollId, user.id);
  };

  const value = {
    currentRoom,
    roomMembers,
    messages,
    polls,
    loading,
    isOrganizer,
    replyingTo,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    addReaction,
    createPoll,
    votePoll,
    endPoll,
    endRoom,
    setReplyingTo,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
