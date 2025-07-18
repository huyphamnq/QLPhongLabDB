const express = require("express");
require("dotenv").config();

const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const authRouter = require("./routes/auth");

const app = express();

const allowedOrigins = [
  "https://qlphonglabdb.onrender.com",
  "http://127.0.0.1:5500", // test local FE
  "http://localhost:3000", // test local BE
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware log request
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
//   next();
// });

app.use(express.json());

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Quản lý Phòng Lab",
      version: "1.0.0",
      description: "",
    },
    servers: [
      { url: "http://localhost:3000" },
      { url: "https://qlphonglabdb.onrender.com" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./routes/auth.js"],
};

const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use("/auth", authRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Swagger UI Local Test: http://localhost:${PORT}/api-docs`);
  console.log(`Swagger UI Public: https://qlphonglabdb.onrender.com/api-docs`);
});
