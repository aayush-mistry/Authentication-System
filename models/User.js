const db = require('../config/db');

class User {
  // Find a user by email
  static async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  // Find a user by username
  static async findByUsername(username) {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0];
  }

  // Find a user by ID
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  }

  // Create a new user
  static async create(username, email, hashedPassword, otpHash, otpExpiresAt) {
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, is_verified, otp, otp_expires_at) VALUES (?, ?, ?, false, ?, ?)',
      [username, email, hashedPassword, otpHash, otpExpiresAt]
    );
    return result.insertId;
  }

  // Update OTP details for an existing user (e.g., resend OTP or forgot password)
  static async updateOTP(userId, otpHash, otpExpiresAt) {
    await db.execute(
      'UPDATE users SET otp = ?, otp_expires_at = ? WHERE id = ?',
      [otpHash, otpExpiresAt, userId]
    );
  }

  // Verify the user (clear OTP fields and set is_verified to true)
  static async verifyUser(userId) {
    await db.execute(
      'UPDATE users SET is_verified = true, otp = NULL, otp_expires_at = NULL WHERE id = ?',
      [userId]
    );
  }

  // Update user's password (clear OTP as well)
  static async updatePassword(userId, newHashedPassword) {
    await db.execute(
      'UPDATE users SET password = ?, otp = NULL, otp_expires_at = NULL WHERE id = ?',
      [newHashedPassword, userId]
    );
  }
}

module.exports = User;
