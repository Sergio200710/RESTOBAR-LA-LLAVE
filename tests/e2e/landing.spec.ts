import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SocialButtons, isSafeSocialUrl } from '../../src/components/SocialButtons'
import { socialLinks } from '../../src/data/site'

test('landing con exactamente cuatro secciones, dos platos y sin carta ni precios', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main > section')).toHaveCount(4)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tenemos la llave')
  await expect(page.locator('.dish')).toHaveCount(2)
  // El propietario no ha facilitado nombres para estas nuevas fotografías.
  await expect(page.locator('.dish h3')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText(/precio|€|carta digital/i)
  await expect(page.getByRole('link', { name: /carta/i })).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('reservas online aún no están disponibles')
})

test('solo imágenes originales: recursos idénticos y decodificación correcta', async ({ page, request }) => {
  const originals = [['logo.jpg', 'logo-actual.jpg'], ['PlatoLaLlave.jpg', 'plato-la-llave.jpg'], ['PlatoLaLlave2.jpg', 'plato-la-llave-2.jpg']]
  for (const [original, published] of originals) {
    const response = await request.get(`/images/${published}`)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('image/jpeg')
    const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')
    expect(hash(await response.body())).toBe(hash(readFileSync(original)))
  }
  await page.goto('/')
  for (const image of await page.getByRole('img').all()) {
    await image.scrollIntoViewIfNeeded()
    expect(await image.getAttribute('src')).toMatch(/^\/images\/(logo-actual|plato-la-llave|plato-la-llave-2)\.jpg$/)
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true)
  }
})

test('formulario con seis campos, sin envío, almacenamiento ni confirmación ficticia', async ({ page }) => {
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()) })
  await page.goto('/#reservar')
  await expect(page.getByRole('button', { name: 'Solicitar reserva · Próximamente' })).toBeDisabled()
  await page.getByLabel('Fecha', { exact: true }).fill('2099-12-01')
  await page.getByLabel('Hora', { exact: true }).fill('14:30')
  await page.getByLabel('Número de comensales').fill('4')
  await page.getByLabel('Nombre', { exact: true }).fill('Prueba local')
  await page.getByLabel('Teléfono', { exact: true }).fill('000000000')
  await page.getByLabel('Observaciones').fill('Prueba de interfaz')
  await expect(page.getByLabel('Observaciones')).not.toHaveAttribute('required')
  await page.getByLabel('Nombre', { exact: true }).press('Enter')
  await page.getByRole('form').evaluate(form => (form as HTMLFormElement).requestSubmit())
  expect(writes).toEqual([])
  await expect(page.getByText('Reservas online todavía no disponibles', { exact: true })).toBeVisible()
  await expect(page.locator('#reservar')).toContainText('confirmadas manualmente')
  expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0)
  await page.reload()
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('')
})

test('ruta administrativa conservada sin datos ni acciones inseguras; 404 operativa', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Administración')
  await expect(page.getByRole('heading', { name: 'Panel pendiente de conexión segura' })).toBeVisible()
  await expect(page.locator('main')).toContainText('Confirmar, rechazar y cancelar reservas')
  await expect(page.locator('main')).toContainText('calendario')
  await expect(page.locator('main')).toContainText('disponibilidad de mesas')
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.goto('/no-existe')
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
})

for (const [oldPath, hash] of [['/carta', '#platos'], ['/reservar', '#reservar'], ['/contacto', '#redes']]) {
  test(`enlace anterior ${oldPath} redirige a la landing`, async ({ page }) => {
    await page.goto(oldPath)
    await expect(page).toHaveURL(`http://127.0.0.1:5173/${hash}`)
    await expect(page.locator('main > section')).toHaveCount(4)
    await expect(page.locator(hash)).toBeInViewport()
  })
}

test('redes vacías no inventan destinos; enlaces configurados usan pestaña nueva', async ({ page, context }) => {
  await page.goto('/#redes')
  if (!socialLinks.length) {
    await expect(page.getByRole('button', { name: 'Redes oficiales · Próximamente' })).toBeDisabled()
    await expect(page.locator('#redes a')).toHaveCount(0)
  }
  // URL reservada únicamente para esta prueba; nunca se incorpora al sitio.
  await context.route('https://example.invalid/red-oficial', route => route.fulfill({ contentType: 'text/html', body: '<h1>Destino de prueba</h1>' }))
  await page.setContent(renderToStaticMarkup(createElement(SocialButtons, { links: [{ name: 'Red de prueba', url: 'https://example.invalid/red-oficial' }] })))
  const link = page.getByRole('link', { name: /Red de prueba/ })
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  const [popup] = await Promise.all([context.waitForEvent('page'), link.click()])
  await popup.waitForLoadState()
  await expect(popup.getByRole('heading')).toHaveText('Destino de prueba')
  expect(await popup.evaluate(() => window.opener === null)).toBe(true)
})

test('configuración social descarta protocolos inseguros y credenciales', async ({ page }) => {
  for (const url of ['javascript:alert(1)', 'http://example.invalid', 'https://user:pass@example.invalid', '/perfil', '']) expect(isSafeSocialUrl(url)).toBe(false)
  await page.setContent(renderToStaticMarkup(createElement(SocialButtons, { links: [{ name: 'Inválido', url: 'javascript:alert(1)' }] })))
  await expect(page.getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('button')).toBeDisabled()
})

for (const width of [320, 390, 768, 1440]) {
  test(`navegación por anclas y responsive a ${width}px`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' })
    if (width <= 700) {
      const toggle = page.getByRole('button', { name: /Menú|Cerrar/ })
      await toggle.focus()
      await page.keyboard.press('Enter')
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Escape')
      await expect(toggle).toBeFocused()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await toggle.click()
    }
    await navigation.getByRole('link', { name: 'Reservar mesa', exact: true }).click()
    await expect(page).toHaveURL(/\/#reservar$/)
    await expect(page.locator('#reservar')).toBeInViewport()
    if (width <= 700) await expect(navigation).toBeHidden()
    await page.getByLabel('Nombre', { exact: true }).fill('Prueba responsive')
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Prueba responsive')
    for (const id of ['portada', 'platos', 'reservar', 'redes']) {
      await page.goto(`/#${id}`)
      await expect(page.locator(`#${id}`)).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.goto('/')
    // Fuerza la carga de las fotos diferidas antes de la captura completa.
    await page.locator('#platos').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true, animations: 'disabled' })
    await page.goto('/admin')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
