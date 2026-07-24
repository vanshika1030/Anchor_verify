import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload as UploadIcon, Sparkles, Check, ArrowRight, Camera, X, ShieldCheck, Clock3, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { useApp } from '../AppContext';
import { downloadTemplate, extractAnchorAttributes, uploadCSV } from '../services/api';

const CATALOG_IMAGE_FIELDS = [
  'catalogImage_front',
  'catalogImage_back',
  'catalogImage_side',
  'catalogImage_closeup',
  'catalogImage_full',
];

const normalizeCatalogUrl = value => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  return `http://localhost:3001/${String(value).replace(/^\/+/, '')}`;
};

const buildCsvSizeChart = row => {
  const chart = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    const match = key.match(/^sizeChart_([^_]+)_(.+)$/i);
    if (!match || value === '') return;
    const [, size, measurement] = match;
    if (!chart[size]) chart[size] = {};
    const numeric = Number(value);
    chart[size][measurement.toLowerCase()] = Number.isFinite(numeric) ? numeric : value;
  });
  return chart;
};

const mapSellerAttributes = row => ({
  style_id: row.styleId,
  product_title: row.productTitle,
  garment_type: row.articleType,
  primary_color: row.primaryColour || row.brandColour,
  secondary_color: row.secondaryColour,
  pattern_type: row.pattern,
  neck_type: row.neckType,
  sleeve_length: row.sleeveLength,
  fit: row.fit,
  fabric_composition: row.fabric,
  fabric_appearance: row.fabric,
  occasion_style: row.occasion,
  overall_length: row.garmentLength,
  hemline: row.hemline,
  transparency: row.transparency,
  embellishment: row.embellishment,
  dupatta: row.dupatta,
  wash_care: row.washCare,
  gender: row.gender,
  brand: row.brand,
  model_size: row.modelSize,
  model_height: row.modelHeight,
  model_build: row.modelBuild,
  description: row.description,
  tags: row.tags,
  mrp: row.mrp,
  selling_price: row.sellingPrice,
});

export default function NewListing() {
  const navigate = useNavigate();
  const { 
    selectedCategory, setSelectedCategory,
    setAnchorExtracted, setExtracting, extracting,
    setAnchorFront, setAnchorBack, setAnchorCloseup,
    anchorFront, anchorBack, anchorCloseup,
    sizeChart, setSizeChart, setSizeChartMeasurements,
    setMode, setConfirmedAttrs, setCatalogFiles, setCatalogPreviews,
    setCsvSessionId, setComparisonResult, setFabricResult, setPhashResult,
    setVerdict, setModelIssues, setCsvRowIndex, setSellerListing
  } = useApp();

  // Clear global state on mount to prevent bleed-over
  useEffect(() => {
    setAnchorFront(null);
    setAnchorBack(null);
    setAnchorCloseup(null);
    setSizeChart(null);
    setSizeChartMeasurements(null);
    setCatalogFiles([]);
    setCatalogPreviews([]);
    setConfirmedAttrs(null);
    setAnchorExtracted(null);
    setCsvSessionId(null);
    setCsvRowIndex(null);
    setSellerListing(null);
    setComparisonResult(null);
    setFabricResult(null);
    setPhashResult(null);
    setVerdict(null);
    setModelIssues([]);
  }, []);

  // LEFT COLUMN STATE
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [leftLoading, setLeftLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const csvInputRef = useRef(null);
  const [error, setError] = useState('');
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  // Auto-collapse right panel when CSV is uploaded
  useEffect(() => {
    if (csvData && csvData.length > 0) {
      setIsRightPanelCollapsed(true);
    }
  }, [csvData]);

  // Local image previews for left column (don't pollute global state until submit)
  const [leftFront, setLeftFront] = useState(null);
  const [leftBack, setLeftBack] = useState(null);
  const [leftCloseup, setLeftCloseup] = useState(null);
  
  const leftFrontRef = useRef(null);
  const leftBackRef = useRef(null);
  const leftCloseupRef = useRef(null);

  // RIGHT COLUMN STATE
  const [rightStep, setRightStep] = useState(1);
  const [showRightConfirm, setShowRightConfirm] = useState(false);
  const [extractedAttrs, setExtractedAttrs] = useState(null);
  
  const rightFrontRef = useRef(null);
  const rightBackRef = useRef(null);
  const rightCloseupRef = useRef(null);
  const rightSizeRef = useRef(null);

  // --- LEFT COLUMN HANDLERS ---
  const handleDownloadTemplate = async () => {
    if (!selectedCategory) {
      setError('Choose a category before downloading its CSV template.');
      return;
    }

    setDownloadingTemplate(true);
    setError('');
    try {
      await downloadTemplate(selectedCategory);
    } catch (err) {
      setError(err.message || 'The CSV template could not be downloaded.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUploadCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        setCsvData(null);
      }
    });
  };

  const handleLeftImage = (type, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = { file, preview: ev.target.result };
      // Store locally — only push to global state on submit
      if (type === 'front') setLeftFront(data);
      if (type === 'back') setLeftBack(data);
      if (type === 'closeup') setLeftCloseup(data);
    };
    reader.readAsDataURL(file);
  };

  const runLeftVerification = async () => {
    if (!csvFile || (!leftFront && !leftBack && !leftCloseup)) return;
    
    setExtracting(true);
    try {
      // 1. Upload CSV to backend to process images
      const csvRes = await uploadCSV(csvFile);
      setCsvSessionId(csvRes.sessionId);
      
      const firstRow = csvRes.preview[0];
      const sellerRow = csvRes.sourcePreview?.[0] || firstRow;
      setCsvRowIndex(0);
      setSellerListing(sellerRow);
      
      // 2. Extract catalog images from the row
      const catalogPaths = CATALOG_IMAGE_FIELDS.map(key => firstRow[key]).filter(Boolean);
      setCatalogFiles(catalogPaths);
      setCatalogPreviews(catalogPaths.map(normalizeCatalogUrl).filter(Boolean));
      
      // 3. Map attributes for verification
      const mappedAttrs = mapSellerAttributes(sellerRow);
      setConfirmedAttrs(mappedAttrs);
      const csvSizeChart = buildCsvSizeChart(sellerRow);
      setSizeChartMeasurements(csvSizeChart);
      
      // Push local images to global state now
      if (leftFront) setAnchorFront(leftFront);
      if (leftBack) setAnchorBack(leftBack);
      if (leftCloseup) setAnchorCloseup(leftCloseup);

      // 4. Extract Anchor Attributes
      const files = [];
      if (leftFront) files.push(leftFront.file);
      if (leftBack) files.push(leftBack.file);
      if (leftCloseup) files.push(leftCloseup.file);
      
      const result = await extractAnchorAttributes(files);
      setExtractedAttrs(result.attributes);
      setAnchorExtracted(result.attributes);
      
      setMode('upload');
      navigate('/verify');
    } catch (err) {
      console.error(err);
      alert('Failed to process CSV or extract attributes');
    } finally {
      setExtracting(false);
    }
  };

  // --- RIGHT COLUMN HANDLERS ---
  const handleRightImage = (type, e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // For size chart: handle non-image files (CSV, PDF, XLSX)
    if (type === 'size') {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setSizeChart({ file: file, preview: ev.target.result });
        reader.readAsDataURL(file);
      } else {
        // Non-image file — store file reference with name
        setSizeChart({ name: file.name, file });
      }
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = { file, preview: ev.target.result };
      if (type === 'front') setAnchorFront(data);
      if (type === 'back') setAnchorBack(data);
      if (type === 'closeup') setAnchorCloseup(data);
    };
    reader.readAsDataURL(file);
  };

  const [rightModelSize, setRightModelSize] = useState('M');
  const [rightModelHeight, setRightModelHeight] = useState('5\'4"');

  const handleExtractAttributes = async () => {
    if (!anchorFront && !anchorBack && !anchorCloseup) return;
    
    const files = [];
    if (anchorFront) files.push(anchorFront.file);
    if (anchorBack) files.push(anchorBack.file);
    if (anchorCloseup) files.push(anchorCloseup.file);

    setExtracting(true);
    try {
      const result = await extractAnchorAttributes(files);
      setExtractedAttrs(result.attributes);
      setAnchorExtracted(result.attributes);
      setShowRightConfirm(true);
    } catch (err) {
      console.error(err);
      alert('Failed to extract attributes');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <main className="listing-page page-shell" style={{ position: 'relative' }}>
      <section className="workflow-intro">
        <div className="workflow-intro-copy">
          <div className="section-kicker">Create a Myntra-ready listing</div>
          <h1>Choose the workflow that fits your catalog.</h1>
          <p>Upload an existing sheet or let Anchor build the listing from your product photos.</p>
        </div>
        <div className="workflow-benefits" aria-label="Workflow benefits">
          <span><ShieldCheck size={13} color="var(--success)" /> Anchor-verified</span>
          <span><Sparkles size={13} color="var(--accent)" /> 5 model angles</span>
          <span><Clock3 size={13} color="#dd8a00" /> Guided setup</span>
        </div>
      </section>

      <div className="workflow-grid" style={{ display: 'flex', gap: '40px', minHeight: '80vh', position: 'relative' }}>
        
        {/* === LEFT COLUMN === */}
        <section className="listing-panel listing-panel--manual" style={{
          flex: isRightPanelCollapsed ? '1' : '1 1 0%', 
          minWidth: 0,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '24px', 
          background: 'white', 
          borderRadius: '16px', 
          border: '1px solid var(--border)' 
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Upload Your Own Listing</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
            Bulk upload via CSV and verify with anchor images.
          </p>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Step 1: Select Category</label>
            <select 
              className="form-select" 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Choose category...</option>
              <option value="Topwear">T-Shirt / Crop Top</option>
              <option value="Bottomwear">Jeans / Trousers</option>
              <option value="Dresses">Kurti / Dress</option>
              <option value="Footwear">Shoes / Sandals</option>
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Step 2: Upload Data</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                style={{ flex: 1 }}
              >
                {downloadingTemplate
                  ? <><Loader2 size={16} className="spin" /> Preparing template…</>
                  : <><Download size={16} /> Download CSV Template</>}
              </button>
              <input type="file" accept=".csv" ref={csvInputRef} hidden onChange={handleUploadCSV} />
              <button className="btn btn-primary" onClick={() => csvInputRef.current?.click()} style={{ flex: 1 }}>
                <UploadIcon size={16} /> Upload CSV File
              </button>
            </div>
            {error && <div className="inline-form-alert" role="alert">{error}</div>}
            {csvFile && <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px' }}><Check size={12}/> {csvFile.name} uploaded</div>}
          </div>

          {csvData && (
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">Step 3: Data Preview</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      {Object.keys(csvData[0] || {}).slice(0, 6).map(key => <th key={key}>{key}</th>)}
                      {Object.keys(csvData[0] || {}).length > 6 && <th>(+{Object.keys(csvData[0]).length - 6} more columns)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.map((row, i) => (
                      <tr key={i}>
                        {Object.keys(csvData[0] || {}).slice(0, 6).map(key => <td key={key}>{row[key]}</td>)}
                        {Object.keys(csvData[0] || {}).length > 6 && <td>...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvData && (
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">Step 4: Upload Anchor Images</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="drop-zone" style={{ padding: '20px 10px' }} onClick={() => leftFrontRef.current?.click()}>
                  <input type="file" accept="image/*" ref={leftFrontRef} hidden onChange={(e) => handleLeftImage('front', e)} />
                  {leftFront ? (
                    <img src={leftFront.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Front View</div></>
                  )}
                </div>
                <div className="drop-zone" style={{ padding: '20px 10px' }} onClick={() => leftBackRef.current?.click()}>
                  <input type="file" accept="image/*" ref={leftBackRef} hidden onChange={(e) => handleLeftImage('back', e)} />
                  {leftBack ? (
                    <img src={leftBack.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Back View</div></>
                  )}
                </div>
                <div className="drop-zone" style={{ padding: '20px 10px', gridColumn: 'span 2' }} onClick={() => leftCloseupRef.current?.click()}>
                  <input type="file" accept="image/*" ref={leftCloseupRef} hidden onChange={(e) => handleLeftImage('closeup', e)} />
                  {leftCloseup ? (
                    <img src={leftCloseup.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Closeup</div></>
                  )}
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }} 
                onClick={runLeftVerification}
                disabled={(!leftFront && !leftBack && !leftCloseup) || extracting}
              >
                {extracting ? <><span className="spinner"></span> Processing...</> : <>Step 5: Extract & Review <ArrowRight size={16} /></>}
              </button>
            </div>
          )}
        </section>

        {/* === VERTICAL DIVIDER === */}
        {!isRightPanelCollapsed && (
          <div className="workflow-divider" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.4s ease', opacity: isRightPanelCollapsed ? 0 : 1 }}>
            <div style={{ width: '1px', background: 'var(--border)', flex: 1 }}></div>
            <div style={{ 
              padding: '8px 12px', 
              background: 'var(--bg-page)', 
              border: '1px solid var(--border)', 
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-tertiary)',
              margin: '16px 0'
            }} className="workflow-divider-label">OR</div>
            <div style={{ width: '1px', background: 'var(--border)', flex: 1 }}></div>
          </div>
        )}

        {/* === RIGHT COLUMN === */}
        <section className={`listing-panel listing-panel--ai ${isRightPanelCollapsed ? 'is-collapsed' : ''}`} style={{
          flex: isRightPanelCollapsed ? '0 0 60px' : '1 1 0%',
          minWidth: isRightPanelCollapsed ? '60px' : '0',
          height: isRightPanelCollapsed ? '60px' : 'auto',
          position: isRightPanelCollapsed ? 'absolute' : 'relative',
          bottom: isRightPanelCollapsed ? '24px' : 'auto',
          right: isRightPanelCollapsed ? '0px' : 'auto',
          padding: isRightPanelCollapsed ? '0' : '24px',
          background: isRightPanelCollapsed ? 'linear-gradient(45deg, var(--accent), var(--coral))' : 'linear-gradient(to bottom, #fff, var(--bg-highlight))',
          borderRadius: isRightPanelCollapsed ? '30px' : '16px',
          border: isRightPanelCollapsed ? 'none' : '1px solid var(--accent-light)',
          boxShadow: isRightPanelCollapsed ? '0 7px 20px var(--accent-light)' : 'none',
          overflow: 'hidden',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: isRightPanelCollapsed ? 'pointer' : 'default',
          display: 'flex',
          alignItems: isRightPanelCollapsed ? 'center' : 'stretch',
          justifyContent: isRightPanelCollapsed ? 'center' : 'flex-start',
          zIndex: 10
        }} onClick={() => isRightPanelCollapsed && setIsRightPanelCollapsed(false)}>
          
          {isRightPanelCollapsed ? (
            <Sparkles size={24} color="white" />
          ) : (
            <div style={{ width: '100%', opacity: isRightPanelCollapsed ? 0 : 1, transition: 'opacity 0.3s ease', transitionDelay: isRightPanelCollapsed ? '0s' : '0.2s' }}>
              <div style={{ position: 'absolute', top: 24, right: 24, background: 'linear-gradient(45deg, var(--accent), var(--coral))', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={14} /> AI-Powered
              </div>
              
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--accent)' }}>Generate with AI</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                Auto-generate catalog details from raw images.
              </p>

          {rightStep === 1 && !showRightConfirm && (
            <div>
              <label className="form-label">Step 1: Upload Anchor Images</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                
                {/* Front */}
                <div 
                  className="drop-zone" 
                  style={{ padding: '20px 10px' }} 
                  onClick={() => rightFrontRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleRightImage('front', { target: { files: e.dataTransfer.files } }); }}
                >
                  <input type="file" accept="image/*" ref={rightFrontRef} hidden onChange={(e) => handleRightImage('front', e)} />
                  {anchorFront ? (
                    <img src={anchorFront.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Front View</div></>
                  )}
                </div>

                {/* Back */}
                <div 
                  className="drop-zone" 
                  style={{ padding: '20px 10px' }} 
                  onClick={() => rightBackRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleRightImage('back', { target: { files: e.dataTransfer.files } }); }}
                >
                  <input type="file" accept="image/*" ref={rightBackRef} hidden onChange={(e) => handleRightImage('back', e)} />
                  {anchorBack ? (
                    <img src={anchorBack.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Back View</div></>
                  )}
                </div>

                {/* Closeup */}
                <div 
                  className="drop-zone" 
                  style={{ padding: '20px 10px' }} 
                  onClick={() => rightCloseupRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleRightImage('closeup', { target: { files: e.dataTransfer.files } }); }}
                >
                  <input type="file" accept="image/*" ref={rightCloseupRef} hidden onChange={(e) => handleRightImage('closeup', e)} />
                  {anchorCloseup ? (
                    <img src={anchorCloseup.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Closeup</div></>
                  )}
                </div>

                {/* Size Chart */}
                <div 
                  className="drop-zone" 
                  style={{ padding: '20px 10px' }} 
                  onClick={() => rightSizeRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleRightImage('size', { target: { files: e.dataTransfer.files } });
                    }
                  }}
                >
                  <input type="file" ref={rightSizeRef} accept="image/*,.pdf" hidden onChange={(e) => handleRightImage('size', e)} />
                  {sizeChart ? (
                    <>{sizeChart.name ? (
                      <><Check size={20} color="var(--success)" /><div style={{ fontSize: '11px', marginTop: '8px', color: 'var(--success)' }}>{sizeChart.name}</div></>
                    ) : (
                      <img src={sizeChart.preview || sizeChart} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                    )}</>
                  ) : (
                    <><UploadIcon size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Size Chart</div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>IMG / PDF</div></>
                  )}
                </div>

              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '13px' }}>Model Size</label>
                  <select className="form-select" value={rightModelSize} onChange={(e) => setRightModelSize(e.target.value)}>
                    <option value="M">M</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '13px' }}>Model Height</label>
                  <select className="form-select" value={rightModelHeight} onChange={(e) => setRightModelHeight(e.target.value)}>
                    <option value="5'4&quot;">5'4"</option>
                    <option value="5'6&quot;">5'6"</option>
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', background: 'linear-gradient(45deg, var(--accent), var(--coral))', border: 'none' }}
                onClick={handleExtractAttributes}
                disabled={(!anchorFront && !anchorBack && !anchorCloseup) || extracting}
              >
                {extracting ? <><span className="spinner"></span> Generating AI Catalog...</> : 'Extract & Generate Models'}
              </button>
            </div>
          )}

          {showRightConfirm && extractedAttrs && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Confirm Attributes</h3>
                <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setShowRightConfirm(false)}>Back</button>
              </div>
              
              <div style={{ display: 'grid', gap: 12, marginBottom: 24, maxHeight: '400px', overflowY: 'auto', paddingRight: 8 }}>
                {Object.keys(extractedAttrs || {}).length === 0 ? (
                  <div style={{ padding: '16px', background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: '8px', color: '#e65100', fontSize: '13px' }}>
                    <strong>Automatic extraction failed.</strong><br/>
                    Please manually specify the garment type to proceed with AI generation.
                    <div style={{ marginTop: 12 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Garment Type</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. T-Shirt, Kurti, Dress" 
                        onChange={(e) => {
                          const newAttrs = { garment_type: e.target.value };
                          setExtractedAttrs(newAttrs);
                          setConfirmedAttrs(newAttrs);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  Object.entries(extractedAttrs).map(([key, val]) => {
                    if (typeof val === 'object' && val !== null) {
                      return (
                        <div key={key}>
                        <label className="form-label" style={{ fontSize: 12, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={val.value || ''} 
                          onChange={(e) => setExtractedAttrs({...extractedAttrs, [key]: { ...val, value: e.target.value }})} 
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={key}>
                      <label className="form-label" style={{ fontSize: 12, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={val || ''} 
                        onChange={(e) => setExtractedAttrs({...extractedAttrs, [key]: e.target.value})} 
                      />
                    </div>
                  );
                })
              )}
            </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', background: 'linear-gradient(45deg, var(--accent), var(--coral))', border: 'none' }}
                onClick={() => {
                  if (Object.keys(extractedAttrs || {}).length === 0) {
                    alert('Please enter at least the garment type to proceed.');
                    return;
                  }
                  const finalAttrs = {
                    ...extractedAttrs,
                    model_size: rightModelSize,
                    model_height: rightModelHeight
                  };
                  setConfirmedAttrs(finalAttrs);
                  // CRITICAL: Also set anchorExtracted so Verify.jsx sends it to the backend
                  setAnchorExtracted(extractedAttrs);
                  setMode('generate');
                  navigate('/verify');
                }}
              >
                Confirm & Generate AI Catalog <ArrowRight size={16} />
              </button>
            </div>
          )}
          
          {!isRightPanelCollapsed && (
            <button 
              onClick={() => setIsRightPanelCollapsed(true)}
              style={{ 
                background: 'none', border: 'none', color: '#9CA0AE', fontSize: '12px', marginTop: '24px',
                width: '100%', textAlign: 'center', cursor: 'pointer', textDecoration: 'underline' 
              }}>
              Collapse Panel
            </button>
          )}
          
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
