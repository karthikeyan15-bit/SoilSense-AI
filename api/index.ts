import { createExpressApp } from '../backend/app.js';

// Vercel Serverless Function entrypoint for all /api/* routes
const app = createExpressApp();

export default app;
