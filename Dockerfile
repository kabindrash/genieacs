# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY package.json npm-shrinkwrap.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./
RUN npm ci --production && npm cache clean --force
EXPOSE 7547 7557 7567 3000
CMD ["node", "bin/genieacs-cwmp"]
