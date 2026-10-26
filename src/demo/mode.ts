// A separate Vite mode/build; never enabled by a URL parameter or local storage.
export const isDemo = import.meta.env.MODE === 'demo'
