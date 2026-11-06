# Optional: bake the built package into a pinned n8n image.
# Prefer `docker compose -f compose.yaml up` for local smoke (bind-mounts this repo).
# Build first: npm run build
#
# Layout: n8n loads community extensions from N8N_CUSTOM_EXTENSIONS only
# (no second copy under ~/.n8n/custom).
FROM n8nio/n8n:2.47.2
USER root
COPY package.json /opt/n8n-nodes-cervio/package.json
COPY dist /opt/n8n-nodes-cervio/dist
RUN chown -R node:node /opt/n8n-nodes-cervio
USER node
ENV N8N_CUSTOM_EXTENSIONS=/opt/n8n-nodes-cervio
ENV N8N_COMMUNITY_PACKAGES_ENABLED=true
ENV N8N_UNVERIFIED_PACKAGES_ENABLED=true
