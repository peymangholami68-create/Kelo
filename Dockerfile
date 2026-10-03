FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN chmod +x server/docker-entrypoint.sh
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "server/docker-entrypoint.sh"]
