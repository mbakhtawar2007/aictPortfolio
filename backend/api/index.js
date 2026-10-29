// Vercel serverless adapter. Importing this file must NOT start a listener.
import { createApp } from '../src/app.js';
const app = createApp();
export default app;
