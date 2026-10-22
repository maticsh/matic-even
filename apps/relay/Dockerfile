FROM node:24-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
USER node
EXPOSE 8787
CMD ["node", "src/main.ts"]
