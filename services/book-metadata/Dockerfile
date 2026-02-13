FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

COPY services/book-metadata/package*.json ./
RUN npm install

COPY services/book-metadata/src ./src

RUN apk del python3 make g++

EXPOSE 3003
CMD ["npm", "start"]
