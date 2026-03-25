# Use official Node.js LTS image
FROM node:20-slim

# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json first
# This allows caching of node_modules if package files don't change
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the source code
COPY src ./src

# Expose the port the app will run on
EXPOSE 3000

# Default command to run your frontend (adjust if using React, Vue, etc.)
CMD ["npm", "start"]