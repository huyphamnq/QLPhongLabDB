const express = require("express");
require("dotenv").config();

const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const authRouter = require("./routes/auth");

const app = express();

const allowedOrigins = [
  "https://qlphonglabdb.onrender.com",
  "http://127.0.0.1:5500", // test local BE
  "http://localhost:3000", // test local FE
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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
      { url: "https://qlphonglabdb.onrender.com" }, // domain public backend
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

app.listen(3000, "0.0.0.0", () => {
  console.log(`Swagger UI Local Test: https://localhost:3000/api-docs`);
  console.log(`Swagger UI Public: https://qlphonglabdb.onrender.com/api-docs`);
});
