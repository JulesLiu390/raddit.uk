import axios from 'axios';

const API_URL = 'https://raddit.uk:8443/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getPosts = async () => {
  const response = await api.get('/posts');
  return response.data;
};

export const createPost = async (postData) => {
  const response = await api.post('/posts', postData);
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

export default api;
