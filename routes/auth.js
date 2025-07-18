const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET chưa được cấu hình trong .env");
  process.exit(1);
}

const {
  authenticateToken,
  requireAdmin,
} = require("../middlewares/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Các API xác thực và người dùng
 */

// ====== Helper functions ======

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return re.test(password);
}

function validateRegisterInput({ username, email, password, full_name }) {
  const errors = {};

  if (!username || username.trim() === "") {
    errors.username = "Username là bắt buộc";
  }
  if (!email || email.trim() === "") {
    errors.email = "Email là bắt buộc";
  } else if (!validateEmail(email)) {
    errors.email = "Email không hợp lệ";
  }
  if (!password || password.trim() === "") {
    errors.password = "Password là bắt buộc";
  } else if (!validatePassword(password)) {
    errors.password =
      "Mật khẩu yếu. Phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt";
  }
  if (!full_name || full_name.trim() === "") {
    errors.full_name = "Họ và tên là bắt buộc";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ====== ROUTES ======

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký người dùng mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - full_name
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               full_name:
 *                 type: string
 *               phone_number:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc đã tồn tại
 *       500:
 *         description: Lỗi server
 */
router.post("/register", async (req, res) => {
  const { username, email, password, full_name, phone_number } = req.body;

  const { valid, errors } = validateRegisterInput({
    username,
    email,
    password,
    full_name,
  });

  if (!valid) {
    return res.status(400).json({ errors });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const [existingUsers] = await conn.execute(
      "SELECT username, email FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUsers.length > 0) {
      const errorResponse = {};
      existingUsers.forEach((user) => {
        if (user.username === username)
          errorResponse.username = "Username đã tồn tại";
        if (user.email === email) errorResponse.email = "Email đã tồn tại";
      });
      return res.status(400).json({ errors: errorResponse });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await conn.execute(
      `INSERT INTO users (username, email, password_hash, full_name, phone_number)
       VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, full_name, phone_number || null]
    );

    return res.status(201).json({ message: "Đăng ký thành công" });
  } catch (error) {
    console.error("Error in /register:", error.stack || error);
    return res.status(500).json({ error: "Lỗi server" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập (bằng username hoặc email)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Username hoặc email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       400:
 *         description: Sai thông tin đăng nhập
 *       403:
 *         description: Tài khoản bị khóa
 *       500:
 *         description: Lỗi server
 */
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Thiếu identifier hoặc password" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const [users] = await conn.execute(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: "Tài khoản không tồn tại" });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Tài khoản đã bị khóa" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Mật khẩu không đúng" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone_number: user.phone_number,
        role: user.role,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    console.error("Error in /login:", error.stack || error);
    res.status(500).json({ error: "Lỗi server" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /auth/users:
 *   get:
 *     summary: Lấy danh sách người dùng (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Tìm theo username hoặc full_name
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 *       403:
 *         description: Không có quyền
 *       500:
 *         description: Lỗi server
 */
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  const search = req.query.search || "";

  let conn;
  try {
    conn = await pool.getConnection();
    const [users] = await conn.execute(
      `SELECT id, username, email, full_name, phone_number, role, is_active
       FROM users
       WHERE username LIKE ? OR full_name LIKE ?`,
      [`%${search}%`, `%${search}%`]
    );
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error.stack || error);
    res.status(500).json({ error: "Lỗi server khi lấy người dùng" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
