const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET chưa được cấu hình trong .env");
  process.exit(1);
}

const { authenticateToken, requireAdmin } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * /auth/users:
 *   get:
 *     summary: Lấy danh sách người dùng hoặc tìm theo tên hoặc username (quyền admin)
 *     tags:
 *       - Auth
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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   full_name:
 *                     type: string
 *                   phone_number:
 *                     type: string
 *                   role:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *       403:
 *         description: Không có quyền
 */

router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  const search = req.query.search || '';

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("search", sql.VarChar, `%${search}%`)
      .query(`
        SELECT id, username, email, full_name, phone_number, role, is_active
        FROM users
        WHERE username LIKE @search OR full_name LIKE @search
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách người dùng" });
  }
});


/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập người dùng (bằng email hoặc username)
 *     tags:
 *       - Auth
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
 *                 description: Email hoặc username
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về token và thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Đăng nhập thành công
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     full_name:
 *                       type: string
 *                     phone_number:
 *                       type: string
 *                     role:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *       400:
 *         description: Sai tài khoản hoặc mật khẩu
 *       500:
 *         description: Lỗi server
 */

router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;

  // Validate dữ liệu đầu vào
  if (!identifier || !password) {
    return res.status(400).json({ error: "Thiếu identifier hoặc password" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("identifier", sql.VarChar(100), identifier).query(`
        SELECT * FROM users 
        WHERE email = @identifier OR username = @identifier
      `);

    if (result.recordset.length === 0) {
      // Trả lỗi chung tránh lộ thông tin
      return res
        .status(400)
        .json({ error: "Tài khoản hoặc mật khẩu không đúng" });
    }

    const user = result.recordset[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res
        .status(400)
        .json({ error: "Tài khoản hoặc mật khẩu không đúng" });
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký người dùng mới
 *     tags:
 *       - Auth
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
 *             properties:
 *               username:
 *                 type: string
 *                 example: newuser
 *               email:
 *                 type: string
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               full_name:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               phone_number:
 *                 type: string
 *                 example: 0123456789
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Đăng ký thành công
 *       400:
 *         description: Username hoặc email đã tồn tại hoặc dữ liệu không hợp lệ
 *       500:
 *         description: Lỗi server
 */

router.post("/register", async (req, res) => {
  const { username, email, password, full_name, phone_number } = req.body;

  // Validate dữ liệu đầu vào
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Thiếu username, email hoặc password" });
  }

  try {
    const pool = await poolPromise;

    // Kiểm tra xem username hoặc email đã tồn tại chưa
    const existingUser = await pool
      .request()
      .input("username", sql.VarChar(50), username)
      .input("email", sql.VarChar(100), email).query(`
        SELECT * FROM users 
        WHERE username = @username OR email = @email
      `);

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ error: "Username hoặc email đã tồn tại" });
    }

    // Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Thêm user mới vào database
    await pool
      .request()
      .input("username", sql.VarChar(50), username)
      .input("email", sql.VarChar(100), email)
      .input("password_hash", sql.VarChar(255), hashedPassword)
      .input("full_name", sql.VarChar(100), full_name || null)
      .input("phone_number", sql.VarChar(15), phone_number || null).query(`
        INSERT INTO users (username, email, password_hash, full_name, phone_number)
        VALUES (@username, @email, @password_hash, @full_name, @phone_number)
      `);

    res.status(201).json({ message: "Đăng ký thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
