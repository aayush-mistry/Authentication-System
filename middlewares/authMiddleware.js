const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user to check token_version
    const user = await User.findById(decoded.id);
    
    if (!user) {
       return res.status(401).json({ message: 'User no longer exists' });
    }

    if (user.token_version !== decoded.version) {
       return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    
    req.userId = user.id;
    next();
  } catch (error) {
    console.error("JWT Verification failed:", error.message);
    res.status(401).json({ message: 'Not authorized, token failed or expired' });
  }
};

module.exports = { protect };
