FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY svelte.config.js ./
COPY vite.config.js ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем проект
RUN npm run build

# Проверяем, что создалось (для отладки)
RUN ls -la /app/build || ls -la /app

FROM node:20-alpine

WORKDIR /app

# Копируем собранное приложение
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./

# Устанавливаем только production зависимости
RUN npm install --omit=dev

# Копируем .env файлы если нужно
# COPY .env ./

EXPOSE 3000

# Запускаем собранное приложение
CMD ["node", "build"]