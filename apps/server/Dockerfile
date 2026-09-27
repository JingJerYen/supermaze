# Game server image. Build from the repository root (the workspaces need the root lockfile):
#   docker build -f apps/server/Dockerfile -t supermaze-server .
#   docker run -p 2567:2567 supermaze-server
# The server runs TypeScript directly through tsx, so there is no build step.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/sim/package.json packages/sim/
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
# tsx is a root devDependency and is the runtime here, so keep dev dependencies.
RUN npm ci --include=dev --workspace=@supermaze/server --workspace=@supermaze/sim --workspace=@supermaze/protocol --include-workspace-root
COPY packages/sim packages/sim
COPY packages/protocol packages/protocol
COPY apps/server apps/server
COPY content content
EXPOSE 2567
CMD ["npm", "start", "-w", "@supermaze/server"]
