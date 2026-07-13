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

  // Create a new user (with token_version)
  static async create(username, email, hashedPassword, otpHash, otpExpiresAt) {
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, is_verified, otp, otp_expires_at, token_version) VALUES (?, ?, ?, false, ?, ?, 0)',
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

  // Update user's password and increment token_version to logout from other devices
  static async updatePassword(userId, newHashedPassword) {
    await db.execute(
      'UPDATE users SET password = ?, otp = NULL, otp_expires_at = NULL, token_version = token_version + 1 WHERE id = ?',
      [newHashedPassword, userId]
    );
  }

  // Increment token_version (Logout of all devices)
  static async incrementTokenVersion(userId) {
    await db.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
  }

  // Update Profile
  static async updateProfile(userId, username, email) {
    await db.execute('UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, userId]);
  }

  // Delete Account
  static async deleteAccount(userId) {
    await db.execute('DELETE FROM users WHERE id = ?', [userId]);
  }
}

module.exports = User;
