# Optional image that bakes the community node into n8n.
# Prefer `docker compose up` (official n8nio/n8n + N8N_CUSTOM_EXTENSIONS) for local smoke.
FROM n8nio/n8n:latest
USER root
COPY package.json /opt/n8n-nodes-cervio/package.json
COPY dist /opt/n8n-nodes-cervio/dist
COPY nodes /opt/n8n-nodes-cervio/nodes
COPY credentials /opt/n8n-nodes-cervio/credentials
RUN mkdir -p /home/node/.n8n/custom \
  && cd /home/node/.n8n/custom \
  && npm init -y \
  && npm install /opt/n8n-nodes-cervio \
  && chown -R node:node /home/node/.n8n /opt/n8n-nodes-cervio
USER node
ENV N8N_CUSTOM_EXTENSIONS=/opt/n8n-nodes-cervio
