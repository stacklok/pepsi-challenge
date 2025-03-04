# Use an official Node.js runtime as a parent image
FROM node:22 AS builder

# Set the working directory in the container
WORKDIR /app

# Install dependencies (hopefully cached) before the rest of the code
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN npm run build

# Create another stage for production where only the necessary files are exposed
FROM node:22-slim

# Set the working directory in the container
WORKDIR /app

# Copy dependencies from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source from the builder stage
COPY --from=builder /app ./

# Expose the port the app runs on
EXPOSE 3000

# Command to run the app
CMD ["npm", "run", "start"]