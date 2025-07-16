const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Quản lý Phòng Lab',
      version: '1.0.0',
      description: '',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./app.js'], // Đường dẫn tới file chứa comment tài liệu API (ở đây là app.js)
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
