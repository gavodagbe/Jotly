FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
