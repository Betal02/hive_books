FROM node:18-alpine

WORKDIR /usr/src/app

COPY services/orchestrator/package*.json ./
RUN npm install

COPY services/orchestrator/src ./src

EXPOSE 3000
CMD ["npm", "start"]
