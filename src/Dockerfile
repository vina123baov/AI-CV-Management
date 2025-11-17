FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files từ ROOT
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code từ thư mục src/
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./

# Build arguments
ARG VITE_API_URL
ARG VITE_SUPABASE_URL  
ARG VITE_SUPABASE_ANON_KEY

# Set environment variables for build
ENV VITE_API_URL=`$VITE_API_URL
ENV VITE_SUPABASE_URL=`$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=`$VITE_SUPABASE_ANON_KEY

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy built files from dist/
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (nginx default)
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
