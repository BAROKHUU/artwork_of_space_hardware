import { chatHandler } from '../server/groq.js';

export default chatHandler(process.env.GROQ_API_KEY ?? '', process.env.COHERE_API_KEY ?? '');
