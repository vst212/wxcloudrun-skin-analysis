FROM node:18-alpine

WORKDIR /app

# 複製 package 相關檔案
COPY package*.json ./
COPY .npmrc ./

# 安裝依賴
RUN npm install --production --registry=https://registry.npmmirror.com

# 複製程式碼
COPY . .

# 暴露端口
EXPOSE 80

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# 啟動服務
CMD ["node", "index.js"]
