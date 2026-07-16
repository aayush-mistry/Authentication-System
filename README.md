# Production-Ready Authentication System

A comprehensive, enterprise-grade Authentication System built from scratch using Node.js, Express, MySQL, and JWT. This project demonstrates best practices in web security, live UI validation, and user profile management.

## 🚀 Key Features

### Authentication & Authorization
- User Registration with robust validation
- Secure Login (via Username or Email)
- Social Login with Google, Facebook, and LinkedIn OAuth 2.0
- Stateless JWT Authentication (stored safely in `HttpOnly` cookies)
- Email Verification (Nodemailer + Ethereal)
- Secure Password Reset Flow (OTP-based)
- **Global Logout**: "Logout of all devices" functionality via JWT `token_version` tracking

### Advanced Security Hardening
- **Rate Limiting**: Defends against brute-force and DDoS attacks (`express-rate-limit`)
- **XSS Protection**: Sanitizes user inputs to prevent Cross-Site Scripting (`xss-clean`)
- **Security Headers**: Hardened HTTP headers to prevent Clickjacking and MIME sniffing (`helmet`)
- **SQL Injection Prevention**: 100% parameterized queries via `mysql2`
- **OTP Security**: OTPs expire in 60 seconds and are immediately invalidated upon use.

### Smart User Experience (UI)
- **Live Validation**: Debounced API calls to check Username and Email availability as the user types.
- **Smart Suggestions**: Generates available username suggestions if the chosen one is taken.
- **Password Strength Meter**: Real-time Regex evaluation of password strength.
- **Strong Password Generator**: Auto-generates cryptographically strong passwords if the user's input is weak.
- **Modern Design**: Glassmorphism aesthetic, custom CSS Spinners, Toast Notifications, and a seamless Dark/Light Mode toggle.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Security:** bcrypt, jsonwebtoken, helmet, express-rate-limit, xss-clean
- **Frontend:** Vanilla HTML, CSS, JavaScript

## 📁 Folder Structure
```text
/
├── config/           # Database configuration and connection pool
├── controllers/      # Business logic (authController, userController)
├── middlewares/      # JWT verification and route protection
├── models/           # Raw SQL database queries (User.js)
├── public/           # Frontend views and assets (CSS/JS)
├── routes/           # Express route definitions
├── utils/            # Helper functions (Nodemailer email sender)
├── .env              # Environment variables
└── server.js         # Express server entry point
```

## ⚙️ Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd authentication-system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Setup (MySQL):**
   - Create a database named `auth_system`.
   - Run the following SQL command to build the table:
     ```sql
     CREATE TABLE users (
       id INT AUTO_INCREMENT PRIMARY KEY,
       username VARCHAR(50) UNIQUE NOT NULL,
       email VARCHAR(100) UNIQUE NOT NULL,
       password VARCHAR(255) NULL,
       is_verified BOOLEAN DEFAULT FALSE,
       authentication_provider VARCHAR(30) DEFAULT 'Local',
       provider_id VARCHAR(255) NULL,
       email_verified BOOLEAN DEFAULT FALSE,
       otp VARCHAR(255) NULL,
       otp_expires_at DATETIME NULL,
       token_version INT DEFAULT 0,
       profile_picture VARCHAR(255) DEFAULT 'default-avatar.png',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY unique_provider_account (authentication_provider, provider_id)
     );
     ```

4. **Environment Variables:**
   - Create a `.env` file in the root directory.
   - Example configuration:
     ```env
     PORT=3000
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your_mysql_password
     DB_NAME=auth_system
     JWT_SECRET=supersecretjwtkey_change_me_in_production
     JWT_EXPIRES_IN=1d
     APP_BASE_URL=http://localhost:3000
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     FACEBOOK_CLIENT_ID=your_facebook_client_id
     FACEBOOK_CLIENT_SECRET=your_facebook_client_secret
     LINKEDIN_CLIENT_ID=your_linkedin_client_id
     LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
     ```

   - Configure provider callback URLs in each OAuth console:
     ```text
     http://localhost:3000/api/auth/google/callback
     http://localhost:3000/api/auth/facebook/callback
     http://localhost:3000/api/auth/linkedin/callback
     ```

5. **Run the server:**
   ```bash
   npm start
   # or 'node server.js'
   ```
   *The application will run on http://localhost:3000*
