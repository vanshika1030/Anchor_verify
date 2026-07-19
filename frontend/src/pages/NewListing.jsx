import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload as UploadIcon, Sparkles, Check, ArrowRight, Camera, X } from 'lucide-react';
import { useApp } from '../AppContext';
import { extractAnchorAttributes } from '../services/api';

export default function NewListing() {
  const navigate = useNavigate();
  const { 
    selectedCategory, setSelectedCategory,
    setAnchorExtracted, setExtracting, extracting,
    setAnchorFront, setAnchorBack, setAnchorCloseup,
    anchorFront, anchorBack, anchorCloseup,
    setMode
  } = useApp();

  // LEFT COLUMN STATE
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [leftAnchorImage, setLeftAnchorImage] = useState(null);
  const [leftLoading, setLeftLoading] = useState(false);
  const csvInputRef = useRef(null);
  const leftAnchorInputRef = useRef(null);

  // RIGHT COLUMN STATE
  const [rightStep, setRightStep] = useState(1);
  const [sizeChart, setSizeChart] = useState(null);
  const [extractedAttrs, setExtractedAttrs] = useState(null);
  
  const rightFrontRef = useRef(null);
  const rightBackRef = useRef(null);
  const rightCloseupRef = useRef(null);
  const rightSizeRef = useRef(null);

  // --- LEFT COLUMN HANDLERS ---
  const handleDownloadTemplate = () => {
    if (!selectedCategory) return alert('Please select a category first');
    window.location.href = `http://localhost:3001/api/csv/template?category=${selectedCategory}`;
  };

  const handleUploadCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    // Mock parsing for preview
    setCsvData([
      { id: '1', title: 'Sample T-Shirt', price: '999', color: 'Blue' },
      { id: '2', title: 'Sample Jeans', price: '1999', color: 'Black' }
    ]);
  };

  const handleLeftAnchorUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setLeftAnchorImage(e.target.result);
    reader.readAsDataURL(file);
  };

  const runLeftVerification = () => {
    setMode('upload');
    navigate('/verify');
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

  const handleExtractAttributes = async () => {
    if (!anchorFront || !anchorBack || !anchorCloseup) return;
    setExtracting(true);
    try {
      const result = await extractAnchorAttributes([
        anchorFront.file, 
        anchorBack.file, 
        anchorCloseup.file
      ]);
      setExtractedAttrs(result.attributes);
      setAnchorExtracted(result.attributes);
      setRightStep(2);
    } catch (err) {
      console.error(err);
      alert('Failed to extract attributes');
    } finally {
      setExtracting(false);
    }
  };

  const runRightVerification = () => {
    setMode('generate');
    navigate('/verify');
  };

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
              <option value="Topwear">Topwear</option>
              <option value="Bottomwear">Bottomwear</option>
              <option value="Dresses">Dresses</option>
              <option value="Footwear">Footwear</option>
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
                  <thead><tr><th>ID</th><th>Title</th><th>Price</th><th>Color</th></tr></thead>
                  <tbody>
                    {csvData.map((row, i) => (
                      <tr key={i}><td>{row.id}</td><td>{row.title}</td><td>{row.price}</td><td>{row.color}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvData && (
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">Step 4: Upload Anchor Image</label>
              {!leftAnchorImage ? (
                <div 
                  className="drop-zone"
                  onClick={() => leftAnchorInputRef.current?.click()}
                >
                  <input type="file" accept="image/*" ref={leftAnchorInputRef} hidden onChange={handleLeftAnchorUpload} />
                  <Camera size={24} color="var(--text-tertiary)" />
                  <div className="drop-title">Upload ground-truth image</div>
                </div>
              ) : (
                <div style={{ position: 'relative', width: '120px' }}>
                  <img src={leftAnchorImage} alt="Anchor" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <button onClick={() => setLeftAnchorImage(null)} style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}><X size={14} /></button>
                </div>
              )}
            </div>
          )}

          {leftAnchorImage && (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={runLeftVerification}>
              Step 5: Run Verification <ArrowRight size={16} />
            </button>
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

          {rightStep === 1 && (
            <div>
              <label className="form-label">Step 1: Upload Anchor Images</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                
                {/* Front */}
                <div className="drop-zone" style={{ padding: '20px 10px' }} onClick={() => rightFrontRef.current?.click()}>
                  <input type="file" accept="image/*" ref={rightFrontRef} hidden onChange={(e) => handleRightImage('front', e)} />
                  {anchorFront ? (
                    <img src={anchorFront.preview} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Front View</div></>
                  )}
                </div>

                {/* Back */}
                <div className="drop-zone" style={{ padding: '20px 10px' }} onClick={() => rightBackRef.current?.click()}>
                  <input type="file" accept="image/*" ref={rightBackRef} hidden onChange={(e) => handleRightImage('back', e)} />
                  {anchorBack ? (
                    <img src={anchorBack.preview} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Back View</div></>
                  )}
                </div>

                {/* Closeup */}
                <div className="drop-zone" style={{ padding: '20px 10px' }} onClick={() => rightCloseupRef.current?.click()}>
                  <input type="file" accept="image/*" ref={rightCloseupRef} hidden onChange={(e) => handleRightImage('closeup', e)} />
                  {anchorCloseup ? (
                    <img src={anchorCloseup.preview} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <><Camera size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Closeup</div></>
                  )}
                </div>

                {/* Size Chart */}
                <div className="drop-zone" style={{ padding: '20px 10px' }} onClick={() => rightSizeRef.current?.click()}>
                  <input type="file" ref={rightSizeRef} accept="image/*,.csv,.pdf,.xlsx,.xls" hidden onChange={(e) => handleRightImage('size', e)} />
                  {sizeChart ? (
                    <>{sizeChart.name ? (
                      <><Check size={20} color="var(--success)" /><div style={{ fontSize: '11px', marginTop: '8px', color: 'var(--success)' }}>{sizeChart.name}</div></>
                    ) : (
                      <img src={sizeChart} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                    )}</>
                  ) : (
                    <><UploadIcon size={20} color="var(--text-tertiary)" /><div style={{ fontSize: '12px', marginTop: '8px' }}>Size Chart</div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>IMG / CSV / PDF</div></>
                  )}
                </div>

              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'linear-gradient(45deg, #ff3f6c, #f77062)', border: 'none' }} 
                onClick={handleExtractAttributes}
                disabled={!anchorFront || !anchorBack || !anchorCloseup || extracting}
              >
                {extracting ? <><span className="spinner"></span> Extracting...</> : 'Extract Attributes'}
              </button>
            </div>
          )}

          {rightStep === 2 && extractedAttrs && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <label className="form-label" style={{ margin: 0 }}>Step 2: Edit Attributes</label>
                <button className="btn btn-ghost btn-sm" onClick={() => setRightStep(1)}>Back</button>
              </div>
              
              <div style={{ background: 'white', borderRadius: '8px', border: '1px solid var(--border)', padding: '16px', marginBottom: '24px', maxHeight: '300px', overflowY: 'auto' }}>
                {Object.entries(extractedAttrs).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</label>
                    <input 
                      className="form-input" 
                      value={typeof val === 'object' ? JSON.stringify(val) : val || ''} 
                      onChange={(e) => setExtractedAttrs({...extractedAttrs, [key]: e.target.value})}
                      style={{ padding: '6px 10px' }}
                    />
                  </div>
                ))}
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'linear-gradient(45deg, #ff3f6c, #f77062)', border: 'none' }} 
                onClick={runRightVerification}
              >
                Step 3: Verify & Generate <ArrowRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
