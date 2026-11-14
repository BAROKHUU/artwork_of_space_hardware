import { chatHandler } from '../server/groq.js';

export default chatHandler(process.env.GROQ_API_KEY ?? '', process.env.GROQ_CHAT_PASSWORD ?? '', process.env.COHERE_API_KEY ?? '');
