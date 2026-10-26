import { useNavigate } from 'react-router-dom'
import { Dashboard } from '../admin/Admin'
import { resetDemo } from './store'

export default function DemoAdmin() {
  const navigate=useNavigate()
  return <><div className="section"><div className="notice"><strong>PANEL DEMO · Sin acceso a reservas reales</strong><p>Sin cuenta ni contraseña. Solo datos ficticios de este navegador. Puedes confirmar, rechazar y cancelar solicitudes simuladas.</p><button className="button secondary" onClick={()=>{if(window.confirm('¿Borrar únicamente las reservas ficticias de esta demo?'))resetDemo()}}>Restablecer demo</button></div></div><Dashboard email="Demostración local · Sin cuenta real" authError="" onSignOut={async()=>{navigate('/')}} onRevoked={()=>{}} /></>
}
