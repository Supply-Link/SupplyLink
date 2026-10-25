import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import App from './App'
import { AppProviders } from './providers/AppProviders'
import { store } from './state/store'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}><AppProviders><App /></AppProviders></Provider>
  </StrictMode>,
)
