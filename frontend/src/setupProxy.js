const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: process.env.BACKEND_PROXY_URL || "http://127.0.0.1:8000",
      changeOrigin: true,
    })
  );
};
