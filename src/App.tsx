import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { featuredDishes, socialLinks } from './data/site'
import { SocialButtons } from './components/SocialButtons'
import Admin from './admin/Admin'
import { ReservationForm } from './components/ReservationForm'
import { supabase } from './lib/supabase'
import { isDemo } from './demo/mode'
import DemoAdmin from './demo/DemoAdmin'

function Logo() {
  return <img className="logo" src="/images/logo-actual.jpg" alt="La Llave Tapas" width="90" height="117" />
}

function Header() {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  return <header className="site-header" onKeyDown={event => {
    if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus() }
  }}><a href="/#portada" aria-label="La Llave, inicio" onClick={() => setOpen(false)}><Logo /></a>
    <button ref={toggle} className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? 'Cerrar' : 'Menú'} <span aria-hidden="true">{open ? '×' : '☰'}</span></button>
    <nav id="main-navigation" className={open ? 'navigation is-open' : 'navigation'} aria-label="Navegación principal" onClick={() => setOpen(false)}>
      <a href="/#platos">Nuestros platos</a><a href="/#redes">Redes sociales</a><a href="/#reservar" className="nav-reserve">Reservar mesa <span aria-hidden="true">↗</span></a>
    </nav>
  </header>
}

function Reservation() {
  return <section id="reservar" className="reservation-section" aria-labelledby="reservation-title" tabIndex={-1}><div className="section reservation-layout">
    <div className="reservation-copy"><p className="eyebrow">RESERVAR MESA</p><h2 id="reservation-title">Tu próxima mesa,<br />en La Llave.</h2><p>Elige tu compañía.<br />Los buenos momentos empiezan aquí.</p><div className="manual-note"><span aria-hidden="true">✧</span><p>Las solicitudes deberán ser confirmadas manualmente por el restaurante. Enviar una solicitud no garantiza la reserva.</p></div></div>
    <ReservationForm />
  </div></section>
}

function Landing() {
  return <>
    <section id="portada" className="hero" aria-labelledby="hero-title" tabIndex={-1}><div className="hero-copy"><p className="eyebrow">RESTOBAR LA LLAVE</p><h1 id="hero-title">Tenemos la llave<br />de tu <em>apetito.</em></h1><p className="intro">Buena compañía, algo rico para compartir<br />y una mesa para disfrutar.</p><a className="button" href="#reservar">Reservar mesa <span aria-hidden="true">↗</span></a><a className="hero-discover" href="#platos">Un pequeño aperitivo <span aria-hidden="true">↓</span></a></div><figure className="hero-photo"><img src="/images/plato-la-llave.jpg" alt="Fotografía de un plato de Restobar La Llave" width="540" height="546" fetchPriority="high" /><figcaption>LA LLAVE · EL GUSTO DE COMPARTIR</figcaption></figure></section>
    <section id="platos" className="section dishes-section" aria-labelledby="dishes-title" tabIndex={-1}><div className="section-heading"><div><p className="eyebrow">PARA ABRIR BOCA</p><h2 id="dishes-title">Algunos de nuestros platos.</h2></div><p>Un primer vistazo.<br />El resto, alrededor de la mesa.</p></div><div className="dish-grid">{featuredDishes.map(dish => <figure className="dish" key={dish.id}><div className="dish-image"><img src={dish.image} alt="Fotografía de un plato de Restobar La Llave" width={dish.width} height={dish.height} loading="lazy" decoding="async" /></div>{dish.name && <figcaption><h3>{dish.name}</h3></figcaption>}</figure>)}</div><p className="dish-invitation">Descubre más platos y novedades en nuestras <a className="text-link" href="#redes">redes sociales oficiales ↗</a>.</p></section>
    <Reservation />
    <section id="redes" className="section social-section" aria-labelledby="social-title" tabIndex={-1}><p className="eyebrow">SIGAMOS COMPARTIENDO</p><h2 id="social-title">Lo próximo se cocina<br />en nuestras redes.</h2><p>Más platos, novedades y ganas de vernos.<br />Sigue el día a día de La Llave en nuestras redes oficiales.</p><SocialButtons links={socialLinks} /></section>
  </>
}

function PageNavigation() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    document.title = `${pathname.startsWith('/admin') ? 'Administración' : 'Tenemos la llave de tu apetito'} · RESTOBAR LA LLAVE`
    const target = hash ? document.getElementById(hash.slice(1)) : document.getElementById('contenido')
    if (hash) target?.scrollIntoView()
    else window.scrollTo(0, 0)
    target?.focus({ preventScroll: true })
  }, [pathname, hash])
  return null
}

function Footer() {
  return <footer className="site-footer"><a href="/#portada" aria-label="La Llave, inicio"><Logo /></a><p>Tenemos la llave de tu apetito.</p><Link to="/admin">Administración</Link></footer>
}

export function App() {
  return <><PageNavigation /><a className="skip-link" href="#contenido">Saltar al contenido</a><div className="status" role="status">{isDemo ? <>DEMOSTRACIÓN · Reservas ficticias, sin conexión a Supabase. No uses datos personales. <Link to="/admin">Ver panel demo</Link></> : supabase ? 'Las solicitudes de reserva requieren confirmación manual del restaurante.' : 'Vista previa · Las reservas online aún no están disponibles.'}</div><Header /><main id="contenido" tabIndex={-1}><Routes><Route path="/" element={<Landing />} /><Route path="/admin/*" element={isDemo ? <DemoAdmin /> : <Admin />} /><Route path="/carta" element={<Navigate to="/#platos" replace />} /><Route path="/reservar" element={<Navigate to="/#reservar" replace />} /><Route path="/contacto" element={<Navigate to="/#redes" replace />} /><Route path="*" element={<div className="section admin-page"><p className="eyebrow">404</p><h1>Página no encontrada</h1><Link className="button" to="/">Volver al inicio</Link></div>} /></Routes></main><Footer /></>
}
