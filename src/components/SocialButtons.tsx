import type { SocialLink } from '../data/site'

export function isSafeSocialUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}

export function SocialButtons({ links }: { links: SocialLink[] }) {
  const configured = links.filter(link => link.name.trim() && isSafeSocialUrl(link.url))
  return <div className="social-buttons">{configured.length ? configured.map(link =>
    <a className="button social-button" key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.name} (se abre en una pestaña nueva)`}>{link.name}<span aria-hidden="true">↗</span></a>,
  ) : <><button className="button" type="button" disabled>Redes oficiales · Próximamente</button><small>Estamos preparando los enlaces oficiales.</small></>}</div>
}
