FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# Cloud Run injects PORT automatically; server.js already reads process.env.PORT
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
