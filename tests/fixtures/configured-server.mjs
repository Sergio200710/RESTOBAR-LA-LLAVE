// ONLY browser contract tests. These reserved-domain values are not credentials.
// No .env file is written and every backend call is intercepted by Playwright.
import { createServer } from 'vite'
process.env.VITE_SUPABASE_URL = 'https://supabase.example.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TEST_ONLY_NOT_A_CREDENTIAL'
process.env.VITE_TURNSTILE_SITE_KEY = 'TEST_ONLY_INTERCEPTED_WIDGET'
const server = await createServer({ server:{host:'127.0.0.1',port:5180,strictPort:true} })
await server.listen()
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await server.close();process.exit(0)})
