import { useEffect, useRef, useState } from 'react'

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: TurnstileApi } }

export function Turnstile({ siteKey, onToken, reset }: { siteKey: string; onToken: (token: string) => void; reset: number }) {
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true; let widget: string | undefined
    onToken(''); setError(false)
    const render = () => {
      if (!active || !container.current || !window.turnstile) return
      widget = window.turnstile.render(container.current, { sitekey:siteKey, action:'reserve', language:'es', size:'flexible',
        callback: (token: string) => { if (active) onToken(token) },
        'expired-callback': () => onToken(''), 'error-callback': () => { onToken(''); setError(true) },
      })
    }
    let script = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (window.turnstile) render()
    else {
      if (!script) { script = document.createElement('script'); script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async=true; script.dataset.turnstile='true'; document.head.append(script) }
      script.addEventListener('load',render)
    }
    const failed = () => { if (active) setError(true) }
    script?.addEventListener('error',failed)
    return () => { active=false; script?.removeEventListener('load',render); script?.removeEventListener('error',failed); if (widget) window.turnstile?.remove(widget) }
  }, [siteKey,onToken,reset])
  return <div className="captcha"><div ref={container} />{error && <p role="alert">No se pudo cargar la comprobación de seguridad. Recarga la página para volver a intentarlo.</p>}</div>
}
