import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Auth0Provider } from '@auth0/auth0-react'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Auth0Provider
    domain="dev-s372ha0ip0eozzbh.us.auth0.com"
    clientId="PIMXS5Mvhd0KntuiZpuCt8cC9dtfTvuD"
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience: 'https://agentic-teacher-api'
    }}
    useRefreshTokens={true}
    cacheLocation="localstorage"
  >
    <App />
  </Auth0Provider>
)