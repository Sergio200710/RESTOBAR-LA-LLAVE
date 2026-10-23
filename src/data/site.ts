export const featuredDishes: { id: string; name: string | null; image: string; width: number; height: number }[] = [
  // Sin nombres hasta que el restaurante facilite los nombres oficiales.
  { id: 'plato-1', name: null, image: '/images/plato-la-llave.jpg', width: 540, height: 546 },
  { id: 'plato-2', name: null, image: '/images/plato-la-llave-2.jpg', width: 545, height: 544 },
]

export interface SocialLink { name: string; url: string }

// Añadir solo los nombres y enlaces oficiales facilitados por el restaurante.
// La lista vacía muestra un botón desactivado, sin cuentas ni enlaces inventados.
export const socialLinks: SocialLink[] = []
