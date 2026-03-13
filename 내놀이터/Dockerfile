FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . ./

VOLUME ["/app/data"]

ENV PORT=3001
ENV STATE_FILE_PATH=/app/data/monitor-state.json
EXPOSE 3001

CMD ["npm", "start"]
