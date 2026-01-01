import axios from 'axios';

// Use localhost for development, or the production URL if deployed
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal
  ? 'https://localhost:8443/api' 
  : 'https://raddit.uk:8443/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('raddit-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getPosts = async () => {
  const response = await api.get('/posts');
  return response.data;
};

export const getHotPosts = async () => {
  const response = await api.get('/posts/hot');
  return response.data;
};

export const incrementPostView = async (postId) => {
  const response = await api.post(`/posts/${postId}/view`);
  return response.data;
};

export const createPost = async (postData) => {
  const response = await api.post('/posts', postData);
  return response.data;
};

export const getPost = async (postId) => {
  const response = await api.get(`/posts/${postId}`);
  return response.data;
};

export const toggleFollowPost = async (postId) => {
  const response = await api.post(`/posts/${postId}/follow`);
  return response.data;
};

export const getPostMessages = async (postId) => {
  const response = await api.get(`/posts/${postId}/messages`);
  return response.data;
};

export const createMessage = async (postId, messageData) => {
  const response = await api.post(`/posts/${postId}/messages`, messageData);
  return response.data;
};

export const reactToMessage = async (messageId, reaction) => {
  const response = await api.post(`/messages/${messageId}/react`, { reaction });
  return response.data;
};

// Topics
export const getTopics = async () => {
  const response = await api.get('/topics');
  return response.data;
};

export const createTopic = async (topicData) => {
  const response = await api.post('/topics', topicData);
  return response.data;
};

export const getTopic = async (topicId) => {
  const response = await api.get(`/topics/${topicId}`);
  return response.data;
};

export const getTopicPosts = async (topicId) => {
  const response = await api.get(`/topics/${topicId}/posts`);
  return response.data;
};

export const toggleFollowTopic = async (topicId) => {
  const response = await api.post(`/topics/${topicId}/follow`);
  return response.data;
};

export const getUserFollowedTopics = async (userId) => {
  const response = await api.get(`/users/${userId}/followed-topics`);
  return response.data;
};

export const loginWithGoogle = async (credential) => {
  const response = await api.post('/auth/google', { credential });
  return response.data;
};

export const getApiMessage = async () => {
  const response = await api.get('/');
  return response.data;
};

export const getUserPosts = async (userId) => {
  const response = await api.get(`/users/${userId}/posts`);
  return response.data;
};

export const getUserReplies = async (userId) => {
  const response = await api.get(`/users/${userId}/replies`);
  return response.data;
};

export const getUserFollowing = async (userId) => {
  const response = await api.get(`/users/${userId}/following`);
  return response.data;
};

export const getUserFollowingUsers = async (userId) => {
  const response = await api.get(`/users/${userId}/following-users`);
  return response.data;
};

export const getUserReactions = async (userId) => {
  const response = await api.get(`/users/${userId}/reactions`);
  return response.data;
};

export const getUserInteractions = async (userId) => {
  const response = await api.get(`/users/${userId}/interactions`);
  return response.data;
};

export const toggleFollowUser = async (userId) => {
  const response = await api.post(`/users/${userId}/follow`);
  return response.data;
};

export const getUser = async (userId) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

export const updateUser = async (userId, userData) => {
  const response = await api.put(`/users/${userId}`, userData);
  return response.data;
};

// Delete functions
export const deletePost = async (postId) => {
  const response = await api.delete(`/posts/${postId}`);
  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await api.delete(`/messages/${messageId}`);
  return response.data;
};

export const deleteTopic = async (topicId) => {
  const response = await api.delete(`/topics/${topicId}`);
  return response.data;
};

export const getDiscoveryFeed = async (cursor = null) => {
  const params = cursor ? { cursor } : {};
  const response = await api.get('/discovery', { params });
  return response.data;
};

export const getNotificationCount = async () => {
  const response = await api.get('/notifications/count');
  return response.data;
};

export const markNotificationsRead = async () => {
  const response = await api.post('/notifications/read');
  return response.data;
};

export const updateTopic = async (topicId, data) => {
  const response = await api.put(`/topics/${topicId}`, data);
  return response.data;
};

export default api;
