FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

COPY services/user-data/package*.json ./
RUN npm install

COPY services/user-data/src ./src

RUN apk del python3 make g++

EXPOSE 3001
CMD ["npm", "start"]
