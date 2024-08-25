FROM node:20

WORKDIR /app

# Copy package.json and yarn.lock from the monorepo root
COPY package.json yarn.lock ./

RUN yarn install

COPY . .

CMD ["yarn", "start"]