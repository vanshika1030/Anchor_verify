import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload as UploadIcon, Sparkles, Check, ArrowRight, Camera, X } from 'lucide-react';
import Papa from 'papaparse';
import { useApp } from '../AppContext';
import { extractAnchorAttributes, getTemplateURL, uploadCSV } from '../services/api';

export default function NewListing() {
  const navigate = useNavigate();
  const { 
    selectedCategory, setSelectedCategory,
    setAnchorExtracted, setExtracting, extracting,
    setAnchorFront, setAnchorBack, setAnchorCloseup,
    anchorFront, anchorBack, anchorCloseup,
    sizeChart, setSizeChart,
    setMode, setConfirmedAttrs, setCatalogFiles, setCatalogPreviews,
    setCsvSessionId
  } = useApp();

  // LEFT COLUMN STATE
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [leftLoading, setLeftLoading] = useState(false);
  const csvInputRef = useRef(null);
  
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
  const handleDownloadTemplate = () => {
    if (!selectedCategory) return alert('Please select a category first');
    window.location.href = getTemplateURL(selectedCategory);
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
      if (type === 'front') setAnchorFront(data);
      if (type === 'back') setAnchorBack(data);
      if (type === 'closeup') setAnchorCloseup(data);
    };
    reader.readAsDataURL(file);
  };

  const runLeftVerification = async () => {
    if (!csvFile || (!anchorFront && !anchorBack && !anchorCloseup)) return;
    
    setExtracting(true);
    try {
      // 1. Upload CSV to backend to process images
      const csvRes = await uploadCSV(csvFile);
      setCsvSessionId(csvRes.sessionId);
      
      const firstRow = csvRes.preview[0];
      
      // 2. Extract catalog images from the row
      const catalogPaths = [];
      ['catalogImage_front', 'catalogImage_back', 'catalogImage_side', 'catalogImage_closeup', 'catalogImage_full'].forEach(key => {
        if (firstRow[key]) {
          catalogPaths.push(firstRow[key]);
        }
      });
      setCatalogFiles(catalogPaths);
      setCatalogPreviews(catalogPaths.map(p => `http://localhost:3001/${p}`));
      
      // 3. Map attributes for verification
      const mappedAttrs = {
        garment_type: firstRow.articleType,
        primary_color: firstRow.primaryColour,
        secondary_color: firstRow.secondaryColour,
        pattern_type: firstRow.pattern,
        neck_type: firstRow.neckType,
        sleeve_length: firstRow.sleeveLength,
        fit: firstRow.fit,
        fabric_composition: firstRow.fabric,
        occasion_style: firstRow.occasion,
        overall_length: firstRow.garmentLength,
        hemline: firstRow.hemline,
        brand: firstRow.brand,
        model_size: firstRow.modelSize,
        model_height: firstRow.modelHeight
      };
      setConfirmedAttrs(mappedAttrs);
      
      // 4. Extract Anchor Attributes
      const files = [];
      if (anchorFront) files.push(anchorFront.file);
      if (anchorBack) files.push(anchorBack.file);
      if (anchorCloseup) files.push(anchorCloseup.file);
      
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
        reader.onload = (ev) => setSizeChart(ev.target.result);
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
  const [rightModelHeight, setRightModelHeight] = useState('5\'6"');

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

  // right verification handler is no longer used since we redirect to details

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '40px', minHeight: '80vh' }}>
        
        {/* === LEFT COLUMN === */}
        <div style={{ flex: 1, padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)' }}>
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
              <button className="btn btn-outline" onClick={handleDownloadTemplate} style={{ flex: 1 }}>
                <Download size={16} /> Download CSV Template
              </button>
              <input type="file" accept=".csv" ref={csvInputRef} hidden onChange={handleUploadCSV} />
              <button className="btn btn-primary" onClick={() => csvInputRef.current?.click()} style={{ flex: 1 }}>
                <UploadIcon size={16} /> Upload CSV File
              </button>
            </div>
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
                  {anchorFront ? (
                    <img src={anchorFront.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Front View</div></>
                  )}
                </div>
                <div className="drop-zone" style={{ padding: '20px 10px' }} onClick={() => leftBackRef.current?.click()}>
                  <input type="file" accept="image/*" ref={leftBackRef} hidden onChange={(e) => handleLeftImage('back', e)} />
                  {anchorBack ? (
                    <img src={anchorBack.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Back View</div></>
                  )}
                </div>
                <div className="drop-zone" style={{ padding: '20px 10px', gridColumn: 'span 2' }} onClick={() => leftCloseupRef.current?.click()}>
                  <input type="file" accept="image/*" ref={leftCloseupRef} hidden onChange={(e) => handleLeftImage('closeup', e)} />
                  {anchorCloseup ? (
                    <img src={anchorCloseup.preview} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Closeup</div></>
                  )}
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }} 
                onClick={runLeftVerification}
                disabled={(!anchorFront && !anchorBack && !anchorCloseup) || extracting}
              >
                {extracting ? <><span className="spinner"></span> Processing...</> : <>Step 5: Extract & Review <ArrowRight size={16} /></>}
              </button>
            </div>
          )}
        </div>

        {/* === VERTICAL DIVIDER === */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
          }}>OR</div>
          <div style={{ width: '1px', background: 'var(--border)', flex: 1 }}></div>
        </div>

        {/* === RIGHT COLUMN === */}
        <div style={{ flex: 1, padding: '24px', background: 'linear-gradient(to bottom, #fff, #fff0f4)', borderRadius: '16px', border: '1px solid #ff3f6c30', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 24, right: 24, background: 'linear-gradient(45deg, #ff3f6c, #f77062)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={14} /> AI-Powered
          </div>
          
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#ff3f6c' }}>Generate with AI</h2>
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
                      <img src={sizeChart} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
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
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '13px' }}>Model Height</label>
                  <select className="form-select" value={rightModelHeight} onChange={(e) => setRightModelHeight(e.target.value)}>
                    <option value="5'2&quot;">5'2"</option>
                    <option value="5'4&quot;">5'4"</option>
                    <option value="5'6&quot;">5'6"</option>
                    <option value="5'8&quot;">5'8"</option>
                    <option value="5'10&quot;">5'10"</option>
                    <option value="6'0&quot;">6'0"</option>
                  </select>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'linear-gradient(45deg, #ff3f6c, #f77062)', border: 'none' }} 
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
                {Object.entries(extractedAttrs).map(([key, val]) => {
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
                })}
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'linear-gradient(45deg, #ff3f6c, #f77062)', border: 'none' }} 
                onClick={() => {
                  setConfirmedAttrs({
                    ...extractedAttrs,
                    model_size: rightModelSize,
                    model_height: rightModelHeight
                  });
                  setMode('generate');
                  navigate('/verify');
                }}
              >
                Confirm & Generate AI Catalog <ArrowRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
