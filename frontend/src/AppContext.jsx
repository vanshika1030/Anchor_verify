import { createContext, useContext, useState } from 'react'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  // Anchor images — collected one by one (front, back, closeup)
  const [anchorFront, setAnchorFront] = useState(null)      // { file, preview }
  const [anchorBack, setAnchorBack] = useState(null)
  const [anchorCloseup, setAnchorCloseup] = useState(null)

  // Catalog images (multiple)
  const [catalogFiles, setCatalogFiles] = useState([])
  const [catalogPreviews, setCatalogPreviews] = useState([])

  // Mode and attributes
  const [mode, setMode] = useState('upload')
  const [confirmedAttrs, setConfirmedAttrs] = useState(null)

  // Gemini results (real extracted data)
  const [anchorExtracted, setAnchorExtracted] = useState(null)
  const [catalogExtracted, setCatalogExtracted] = useState(null)
  const [comparisonResult, setComparisonResult] = useState(null)
  const [fabricResult, setFabricResult] = useState(null)
  const [phashResult, setPhashResult] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [modelIssues, setModelIssues] = useState([])

  // CSV State
  const [csvSessionId, setCsvSessionId] = useState(null)
  const [csvRowIndex, setCsvRowIndex] = useState(null)

  // Loading states
  const [extracting, setExtracting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)

  const reset = () => {
    setAnchorFront(null); setAnchorBack(null); setAnchorCloseup(null)
    setCatalogFiles([]); setCatalogPreviews([])
    setMode('upload'); setConfirmedAttrs(null)
    setAnchorExtracted(null); setCatalogExtracted(null)
    setComparisonResult(null); setFabricResult(null); setPhashResult(null)
    setVerdict(null); setModelIssues([])
    setError(null)
    // We intentionally DO NOT reset csvSessionId so the user can continue verifying other rows.
    setCsvRowIndex(null)
  }

  // Helper: all anchor previews as array (for Gemini)
  const getAnchorPreviews = () => [
    anchorFront?.preview,
    anchorBack?.preview,
    anchorCloseup?.preview,
  ].filter(Boolean)

  return (
    <AppCtx.Provider value={{
      anchorFront, setAnchorFront,
      anchorBack, setAnchorBack,
      anchorCloseup, setAnchorCloseup,
      catalogFiles, setCatalogFiles,
      catalogPreviews, setCatalogPreviews,
      mode, setMode,
      confirmedAttrs, setConfirmedAttrs,
      anchorExtracted, setAnchorExtracted,
      catalogExtracted, setCatalogExtracted,
      comparisonResult, setComparisonResult,
      fabricResult, setFabricResult,
      phashResult, setPhashResult,
      verdict, setVerdict,
      modelIssues, setModelIssues,
      csvSessionId, setCsvSessionId,
      csvRowIndex, setCsvRowIndex,
      extracting, setExtracting,
      verifying, setVerifying,
      error, setError,
      getAnchorPreviews,
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
