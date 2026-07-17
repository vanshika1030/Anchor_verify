import { createContext, useContext, useState } from 'react'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [anchorFile, setAnchorFile] = useState(null)
  const [anchorPreview, setAnchorPreview] = useState(null)
  const [catalogFiles, setCatalogFiles] = useState([])
  const [catalogPreviews, setCatalogPreviews] = useState([])
  const [mode, setMode] = useState('upload')
  const [confirmedAttrs, setConfirmedAttrs] = useState(null)

  const reset = () => {
    setAnchorFile(null)
    setAnchorPreview(null)
    setCatalogFiles([])
    setCatalogPreviews([])
    setMode('upload')
    setConfirmedAttrs(null)
  }

  return (
    <AppCtx.Provider value={{
      anchorFile, setAnchorFile,
      anchorPreview, setAnchorPreview,
      catalogFiles, setCatalogFiles,
      catalogPreviews, setCatalogPreviews,
      mode, setMode,
      confirmedAttrs, setConfirmedAttrs,
      reset,
    }}>
      {children}
    </AppCtx.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
