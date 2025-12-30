const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'raddit-secret-key-change-this-in-prod';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.googleId) {
        const user = await User.findOne({ googleId: decoded.googleId });
        if (user) {
          req.user = user;
        }
      }
    } catch (err) {
      // Token expired or invalid, just treat as not logged in
      // console.error('Token verification failed:', err.message);
    }
  }
  
  next();
};

module.exports = authMiddleware;
