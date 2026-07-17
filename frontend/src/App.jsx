import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AppProvider } from './AppContext'
import Sidebar from './components/Sidebar'
import Landing from './pages/Landing'
import Upload from './pages/Upload'
import Details from './pages/Details'
import Verify from './pages/Verify'
import Success from './pages/Success'
import './index.css'

function Breadcrumb() {
  const loc = useLocation()
  const map = {
    '/': 'Dashboard',
    '/new-listing/upload': 'Upload',
    '/new-listing/details': 'Details',
    '/new-listing/verify': 'Verification',
    '/new-listing/success': 'Published',
  }
  return (
    <div className="breadcrumb">
      Cataloging / <b>{map[loc.pathname] || 'Anchor'}</b>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="layout">
          <Sidebar />
          <div className="main">
            <header className="top-bar">
              <Breadcrumb />
            </header>
            <div className="content">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/new-listing/upload" element={<Upload />} />
                <Route path="/new-listing/details" element={<Details />} />
                <Route path="/new-listing/verify" element={<Verify />} />
                <Route path="/new-listing/success" element={<Success />} />
              </Routes>
            </div>
          </div>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}
