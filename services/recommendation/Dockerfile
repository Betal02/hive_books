FROM node:18-alpine

WORKDIR /usr/src/app

COPY services/recommendation/package*.json ./
RUN npm install

COPY services/recommendation/src ./src

EXPOSE 3005
CMD ["npm", "start"]
