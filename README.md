# Authentication System

A complete, modern Authentication System built from scratch using Node.js, Express, MySQL, and JWT (JSON Web Tokens).

## 🚀 Features (Phase 1)
- MVC Architecture
- Environment Variable Configuration
- User Registration (Username, Email, Password validation)
- Secure Password Hashing with `bcrypt`
- User Login (Username or Email)
- Stateless Authentication using JWT stored in `HttpOnly` Cookies
- Protected Dashboard Route
- Responsive UI (Login, Register, Dashboard)

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JWT, bcrypt
- **Frontend:** HTML, CSS (Vanilla), Vanilla JavaScript

## 📁 Folder Structure
```text
/
├── config/           # Database configuration
├── controllers/      # Application logic (auth handlers)
├── middlewares/      # Express middlewares (JWT verification)
├── models/           # Database interactions
├── public/           # Static frontend assets (HTML, CSS, JS)
├── routes/           # Express route definitions
├── .env              # Environment variables (not committed)
└── server.js         # Entry point
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

3. **Database Setup:**
   - Create a MySQL database named `auth_system`.
   - Run the following SQL command to create the `users` table:
     ```sql
     CREATE TABLE users (
       id INT AUTO_INCREMENT PRIMARY KEY,
       username VARCHAR(50) UNIQUE NOT NULL,
       email VARCHAR(100) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     );
     ```

4. **Environment Variables:**
   - Create a `.env` file in the root directory based on the `.env.example` (or use the existing `.env` if created locally).
   - Update `DB_PASSWORD` to your local MySQL root password.
   - Example:
     ```env
     PORT=3000
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your_mysql_password
     DB_NAME=auth_system
     JWT_SECRET=supersecretjwtkey_change_me_in_production
     JWT_EXPIRES_IN=1d
     ```

5. **Run the server:**
   ```bash
   npm start
   ```
   *(Server should run on http://localhost:3000)*
