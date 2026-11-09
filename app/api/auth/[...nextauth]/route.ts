import { handlers } from "@/lib/auth/auth";

// Auth.js endpoints: sign-in, sign-out, session, CSRF. Credentials checks run in lib/auth/auth.ts.
export const { GET, POST } = handlers;
