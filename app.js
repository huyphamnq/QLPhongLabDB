const express = require("express");
require("dotenv").config();

const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const os = require("os");

const authRouter = require("./routes/auth");

const app = express();

const allowedOrigins = [
  "https://qlphonglabdb.onrender.com/api-docs",
  "http://localhost:5500", // nếu bạn test local be
  "http://localhost:3000" // nếu bạn test local fe
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
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
      {url: "https://qlphonglabdb.onrender.com" },
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

const ifaces = os.networkInterfaces();
let localIP = "localhost";
for (const iface of Object.values(ifaces)) {
  for (const i of iface) {
    if (i.family === "IPv4" && !i.internal) {
      localIP = i.address;
      break;
    }
  }
}

app.listen(3000, "0.0.0.0", () => {
  console.log(`Server chạy tại http://${localIP}:3000`);
  console.log(`Swagger UI: http://${localIP}:3000/api-docs`);
});
