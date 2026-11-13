# Breeze relay — self-hosted Node entry (stage-2 step 3,
# docs/RELAY_STAGE2_PLAN.md). One process serving the static app, the
# API and the WebSocket wake-up, with all state in one SQLite file.
#
#   docker compose up -d        (see docker-compose.yml)
#
# The image serves PLAIN HTTP on PORT. Browsers will only use a relay
# over HTTPS/WSS, so terminate TLS at a reverse proxy in front of it
# (Caddy, nginx, Traefik, …) and set TRUST_PROXY=true there — see
# docs/SELF_HOSTING.md.
FROM node:24-alpine

WORKDIR /app
COPY . .

# Relay state = one SQLite file (mailboxes, directory, and the relay
# identity key inside it) under /data. Mount a volume there: that
# volume is the ENTIRE relay state and the entire backup.
RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV HOST=0.0.0.0 \
    PORT=8787 \
    BREEZE_DB_PATH=/data/breeze-relay.db

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
