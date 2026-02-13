FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

COPY services/item-data/package*.json ./
RUN npm install

COPY services/item-data/src ./src

RUN apk del python3 make g++

EXPOSE 3002
CMD ["npm", "start"]
