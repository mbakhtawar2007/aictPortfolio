// LOCAL-ONLY server. Vercel uses api/index.js instead; this file is never
// imported by the Vercel adapter.
import { createApp } from './app.js';
const port = Number(process.env.PORT || 4001);
createApp().listen(port, () => console.log(`AICT portfolio backend listening on http://localhost:${port}`));
