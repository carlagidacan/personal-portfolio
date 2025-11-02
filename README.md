# Personal Backend Portfolio

This repository contains a static portfolio site (`index.html`) and a small example backend (`sample-api`) demonstrating a minimal Express API.

Quick start (PowerShell):

Open the portfolio in your browser by double-clicking `index.html` or serve it with any static server.

To run the sample API:

  cd sample-api; npm install; npm start

Then, from the portfolio page click "Check API" or visit http://localhost:3000/health

Docker build (optional):

  cd sample-api
  docker build -t sample-api .
  docker run -p 3000:3000 sample-api

Notes:
- The portfolio is intentionally static so you can host it on GitHub Pages or an S3 bucket.
- The `sample-api` shows basic endpoints and a Dockerfile for demonstration.
