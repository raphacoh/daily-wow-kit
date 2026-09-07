import { handle } from '../lib/arto.js';
export const config = { maxDuration: 60 };
export default { fetch: request => handle(request, 'chat') };
