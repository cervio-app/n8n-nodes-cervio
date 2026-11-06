# Optional: bake the built package into n8n.
# Prefer `docker compose up` for local smoke (mounts this repo via N8N_CUSTOM_EXTENSIONS).
# Build first: npm run build
FROM n8nio/n8n:latest
USER root
COPY package.json /opt/n8n-nodes-cervio/package.json
COPY dist /opt/n8n-nodes-cervio/dist
RUN mkdir -p /home/node/.n8n/custom \
    && cd /home/node/.n8n/custom \
    && npm init -y \
    && npm install /opt/n8n-nodes-cervio \
    && chown -R node:node /home/node/.n8n /opt/n8n-nodes-cervio
USER node
ENV N8N_CUSTOM_EXTENSIONS=/opt/n8n-nodes-cervio

