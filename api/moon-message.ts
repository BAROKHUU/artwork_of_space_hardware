import { mailConfigFrom, moonMailHandler } from '../server/moonMail.js';

export default moonMailHandler(mailConfigFrom(process.env));
