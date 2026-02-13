FROM node:18-alpine

WORKDIR /usr/src/app

COPY services/follower/package*.json ./
RUN npm install

COPY services/follower/src ./src

EXPOSE 3004
CMD ["npm", "start"]
