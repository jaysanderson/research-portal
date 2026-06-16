# --- build stage ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# --- runtime stage ---
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Only the manifests + prod deps for a lean image.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 8787
ENV PORT=8787
CMD ["node", "server/index.mjs"]
