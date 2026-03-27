# Ops watcher Dockerfile
FROM node:20-bullseye-slim

WORKDIR /usr/src/ops

# Install python for any python worker parts if needed
RUN apt-get update && apt-get install -y python3 python3-pip curl && rm -rf /var/lib/apt/lists/*

# Copy package.json if needed, otherwise rely on mounted volume
# We'll rely on mounted code in dev

ENV NODE_ENV=development

# default command runs the watcher script (assumes it's mounted at /usr/src/ops/scripts)
CMD ["sh", "-c", "node scripts/redact-and-curate.js /data/sessions/placeholder.json || sleep 3600"]
