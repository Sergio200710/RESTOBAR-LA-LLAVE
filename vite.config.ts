import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({mode})=>({ plugins: [react(),mode==='demo'&&{
  name:'demo-package',
  transformIndexHtml(){return [{tag:'meta',attrs:{name:'robots',content:'noindex, nofollow'},injectTo:'head'}]},
  generateBundle(){this.emitFile({type:'asset',fileName:'_redirects',source:'/* /index.html 200\n'})},
}] }))
