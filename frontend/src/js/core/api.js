/**
 * URL base da API do backend.
 * Em desenvolvimento, utiliza o proxy do Vite (/api → http://localhost:3000).
 * Em produção, utiliza VITE_API_URL definida no .env.
 */
export const API_URL = import.meta.env.VITE_API_URL || '/api';

export default API_URL;
