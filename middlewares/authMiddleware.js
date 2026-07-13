const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  // We expect the JWT to be inside an HttpOnly cookie named 'token'
  let token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    // Verify the token signature using our secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the user ID to the request object so the controller can use it
    req.userId = decoded.id;
    next();
  } catch (error) {
    console.error("JWT Verification failed:", error.message);
    res.status(401).json({ message: 'Not authorized, token failed or expired' });
  }
};

module.exports = { protect };
