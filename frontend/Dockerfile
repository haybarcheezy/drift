FROM oven/bun:1-alpine

# Install Python 3, git, and sqlite3
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    sqlite

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install
COPY . .

EXPOSE 3000

CMD [ "bun", "run", "dev", "--host", "0.0.0.0" ]
