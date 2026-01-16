FROM node:18-alpine

WORKDIR /app

# 複製 package.json
COPY package.json ./

# 安裝依賴
RUN npm install --production

# 複製程式碼
COPY . .

# 暴露端口
EXPOSE 80

# 啟動服務
CMD ["npm", "start"]
