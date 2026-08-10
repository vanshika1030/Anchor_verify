import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload as UploadIcon, Sparkles, Check, ArrowRight, Camera, X, ShieldCheck, Clock3, Loader2, Plus, AlertTriangle, XCircle, Eye, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { useApp } from '../AppContext';
import { downloadTemplate, extractAnchorAttributes, uploadCSV } from '../services/api';
import FASHION_EDITORIAL from '../assets/fashion-editorial-hero.png';
import MOCK_BLUE_KURTA from '../assets/mockup/blue_kurta_set.png';
import MOCK_BROWN_TOP from '../assets/mockup/brown_printed_top.png';
import MOCK_GREEN_NIGHTWEAR from '../assets/mockup/green_nightwear.png';
import MOCK_WHITE_JACKET from '../assets/mockup/white_jacket.png';

const CATALOG_IMAGE_FIELDS = [
  'catalogImage_front',
  'catalogImage_back',
  'catalogImage_side',
  'catalogImage_closeup',
  'catalogImage_full',
];

const MOCK_LISTINGS = [
  { id: 'mock-1', title: 'Women Blue Printed Anarkali Kurta Set', category: 'Kurta Sets', mrp: 2499, selling_price: 1299, image: MOCK_BLUE_KURTA, verification_status: 'published', verdict: 'PASS', created_at: '2026-07-28T10:00:00Z' },
  { id: 'mock-2', title: 'Women Olive Printed V-Neck Short Kurti', category: 'Kurtis', mrp: 1599, selling_price: 799, image: MOCK_BROWN_TOP, verification_status: 'published', verdict: 'PASS', created_at: '2026-07-30T14:30:00Z' },
  { id: 'mock-3', title: 'Women Green Star Print Night Suit', category: 'Nightwear', mrp: 1299, selling_price: 699, image: MOCK_GREEN_NIGHTWEAR, verification_status: 'published', verdict: 'PASS', created_at: '2026-08-01T09:15:00Z' },
  { id: 'mock-4', title: 'Women White Windcheater Jacket', category: 'Jackets', mrp: 2999, selling_price: 1799, image: MOCK_WHITE_JACKET, verification_status: 'warning', verdict: 'WARNING', created_at: '2026-08-03T16:45:00Z' },
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

const GENERATION_ATTRIBUTE_FIELDS = [
  { key: 'garment_type', label: 'Garment type', required: true, placeholder: 'e.g. Kurti, Crop Top, Dress' },
  { key: 'primary_color', label: 'Primary colour', placeholder: 'e.g. Blue' },
  { key: 'secondary_color', label: 'Secondary colour', placeholder: 'e.g. White' },
  { key: 'pattern_type', label: 'Pattern / print', placeholder: 'e.g. Printed, Solid' },
  { key: 'neck_type', label: 'Neckline', placeholder: 'e.g. V-Neck' },
  { key: 'sleeve_length', label: 'Sleeve length', placeholder: 'e.g. Three-Quarter' },
  { key: 'overall_length', label: 'Garment length', placeholder: 'e.g. Knee Length' },
  { key: 'fit', label: 'Fit / silhouette', placeholder: 'e.g. Regular' },
  { key: 'fabric_appearance', label: 'Fabric appearance', placeholder: 'e.g. Woven cotton texture' },
  { key: 'occasion_style', label: 'Style / occasion', placeholder: 'e.g. Casual ethnic' },
];

const valueForInput = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return String(value.value ?? value.label ?? '');
  return String(value);
};

const buildGenerationClaims = attrs => {
  const claims = {};
  GENERATION_ATTRIBUTE_FIELDS.forEach(({ key }) => {
    const value = valueForInput(attrs?.[key]).trim();
    if (value) claims[key] = value;
  });
  return claims;
};

const emptyGenerationClaims = () => (
  GENERATION_ATTRIBUTE_FIELDS.reduce((claims, { key }) => ({ ...claims, [key]: '' }), {})
);

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
  const [selectedCsvRow, setSelectedCsvRow] = useState(null);
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

  // GENERATE FLOW STATE — anchors first, seller confirmation second.
  const [rightStep, setRightStep] = useState('anchors');
  const [extractedAttrs, setExtractedAttrs] = useState(null);
  const [generationExtractionNotice, setGenerationExtractionNotice] = useState('');
  
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
    setError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data || []).filter(row => Object.values(row || {}).some(value => String(value ?? '').trim() !== ''));
        setCsvData(rows);
        setSelectedCsvRow(rows.length === 1 ? 0 : null);
        if (rows.length === 0) setError('This CSV has no usable product rows. Upload a completed template and try again.');
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        setCsvData(null);
        setSelectedCsvRow(null);
        setError('The CSV could not be read. Please upload a valid CSV template.');
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
    if (!csvFile) {
      setError('Upload a completed CSV before starting verification.');
      return;
    }
    if (selectedCsvRow === null) {
      setError('Choose the listing row you want Anchor to verify.');
      return;
    }
    if (!leftFront || !leftBack || !leftCloseup) {
      setError('Front, back, and close-up anchors are all required for evidence-backed verification.');
      return;
    }
    
    setExtracting(true);
    try {
      // 1. Upload CSV to backend to process images
      const csvRes = await uploadCSV(csvFile);
      setCsvSessionId(csvRes.sessionId);
      
      const selectedRow = csvRes.preview?.[selectedCsvRow];
      const sellerRow = csvRes.sourcePreview?.[selectedCsvRow] || selectedRow;
      if (!selectedRow || !sellerRow) throw new Error('The selected CSV row could not be loaded. Upload the file again and choose a row.');
      setCsvRowIndex(selectedCsvRow);
      setSellerListing(sellerRow);
      
      // 2. Keep the seller's original catalog references for verification.
      // The CSV route may materialize a URL into a fast local preview path,
      // but replacing the signed source URL here would break the immutable
      // catalog evidence binding.  Previews can safely use the local copies.
      const catalogSourcePaths = CATALOG_IMAGE_FIELDS.map(key => sellerRow[key]).filter(Boolean);
      const catalogPreviewPaths = CATALOG_IMAGE_FIELDS.map(key => selectedRow[key]).filter(Boolean);
      setCatalogFiles(catalogSourcePaths.length ? catalogSourcePaths : catalogPreviewPaths);
      setCatalogPreviews(catalogPreviewPaths.map(normalizeCatalogUrl).filter(Boolean));
      
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
      
      try {
        const result = await extractAnchorAttributes(files);
        setExtractedAttrs(result.attributes || {});
        setAnchorExtracted(result.attributes || {});
      } catch (extractError) {
        // The exact evidence fixture can still verify without a transient model
        // extraction. Unknown assets will receive an explicit pending state.
        console.warn('Anchor extraction unavailable; continuing to evidence verification.', extractError);
        setAnchorExtracted({});
        setError('Automatic extraction is unavailable. Anchor will use exact evidence if these anchors match a known fixture; otherwise it will show processing pending.');
      }
      
      setMode('upload');
      navigate('/verify');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to process the selected CSV row.');
    } finally {
      setExtracting(false);
    }
  };

  // --- RIGHT COLUMN HANDLERS ---
  const handleRightImage = (type, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    
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

  // NEW STATE FOR TREE & FLOW
  const [treeOpen, setTreeOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);

  // NEW STATE FOR MY LISTINGS
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [hiddenMockIds, setHiddenMockIds] = useState(new Set());
  const [previewListing, setPreviewListing] = useState(null);
  const [deletingListingId, setDeletingListingId] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/products`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        });
        if (res.ok) setProducts(await res.json());
      } catch (err) {
        console.error('Failed to fetch products', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  const handleDeleteListing = async (event, listingId) => {
    event.stopPropagation();
    if (!window.confirm('Remove this listing from your seller catalog?')) return;

    setDeletingListingId(listingId);
    try {
      const response = await fetch(`http://localhost:3001/api/products/${listingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not remove this listing');
      setProducts(current => current.filter(product => product.id !== listingId));
    } catch (err) {
      console.error('Failed to remove listing', err);
      setError(err.message || 'Could not remove this listing. Please try again.');
    } finally {
      setDeletingListingId(null);
    }
  };

  const renderBadge = status => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'pass' || normalized === 'verified' || normalized === 'published') {
      return <div className="badge badge-pass" style={{ position: 'absolute', top: 10, right: 10 }}><ShieldCheck size={12} /> Verified</div>;
    }
    if (normalized === 'warning') {
      return <div className="badge badge-warn" style={{ position: 'absolute', top: 10, right: 10 }}><AlertTriangle size={12} /> Review</div>;
    }
    return <div className="badge badge-fail" style={{ position: 'absolute', top: 10, right: 10 }}><XCircle size={12} /> Needs fix</div>;
  };


  const handleExtractAttributes = async () => {
    if (!anchorFront || !anchorBack || !anchorCloseup) {
      setError('Front, back, and close-up anchors are required before catalog generation.');
      return;
    }
    
    const files = [];
    if (anchorFront) files.push(anchorFront.file);
    if (anchorBack) files.push(anchorBack.file);
    if (anchorCloseup) files.push(anchorCloseup.file);

    setExtracting(true);
    setError('');
    setGenerationExtractionNotice('');
    try {
      const result = await extractAnchorAttributes(files);
      const claims = buildGenerationClaims(result.attributes || {});
      // An extractor can be deliberately conservative. Give the seller an
      // editable confirmation step rather than pretending empty values are AI
      // facts or blocking the exact finalist fixture.
      setExtractedAttrs({ ...emptyGenerationClaims(), ...claims });
      setAnchorExtracted(result.attributes || {});
      setRightStep('confirm');
    } catch (err) {
      console.error(err);
      // Verification remains honest: the seller can supply confirmed values
      // and the next page will either match immutable evidence or report a
      // pending live render. We never manufacture inferred attributes here.
      setExtractedAttrs(emptyGenerationClaims());
      setAnchorExtracted({});
      setGenerationExtractionNotice('Automatic extraction is temporarily unavailable. Confirm the product details manually; Anchor will still make the evidence status explicit on the next step.');
      setRightStep('confirm');
    } finally {
      setExtracting(false);
    }
  };

  const updateGenerationClaim = (key, value) => {
    setExtractedAttrs(previous => ({ ...(previous || emptyGenerationClaims()), [key]: value }));
  };

  const startGenerationReview = () => {
    const claims = buildGenerationClaims(extractedAttrs);
    if (!claims.garment_type) {
      setError('Confirm the garment type before requesting a catalog candidate.');
      return;
    }
    if (!rightModelSize || !rightModelHeight.trim()) {
      setError('Add the model size and height so Anchor can check the requested setup.');
      return;
    }

    const finalClaims = {
      ...claims,
      model_size: rightModelSize,
      model_height: rightModelHeight.trim(),
    };

    setError('');
    setConfirmedAttrs(finalClaims);
    // In generate mode this is the seller-confirmed declaration. It is kept
    // separate from what a future production vision worker may observe.
    setAnchorExtracted(finalClaims);
    setCatalogFiles([]);
    setCatalogPreviews([]);
    setSizeChartMeasurements(null);
    setMode('generate');
    navigate('/verify');
  };

  const beginGenerateFlow = () => {
    if (selectedFlow !== 'ai') {
      setAnchorFront(null);
      setAnchorBack(null);
      setAnchorCloseup(null);
      setSizeChart(null);
      setSizeChartMeasurements(null);
      setCatalogFiles([]);
      setCatalogPreviews([]);
      setConfirmedAttrs(null);
      setAnchorExtracted(null);
      setExtractedAttrs(null);
      setRightStep('anchors');
      setGenerationExtractionNotice('');
    }
    setError('');
    setSelectedFlow('ai');
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

      <div className="new-listing-cta-container">
        <button className="btn btn-primary new-listing-cta-btn" onClick={() => setTreeOpen(!treeOpen)}>
          <Plus size={20} /> Create New Listing
        </button>
        <div className={`tree-container ${treeOpen ? 'open' : ''}`}>
          <div className="tree-stem"></div>
          <div className="tree-branches">
            <div className="tree-branch">
              <button
                type="button"
                className={`tree-branch-btn tree-branch-btn--csv ${selectedFlow === 'csv' ? 'active' : ''}`}
                onClick={() => setSelectedFlow('csv')}
              >
                <div className="branch-icon"><UploadIcon size={20} /></div>
                <span className="branch-text">Upload CSV & Verify Listing <ArrowRight size={16} /></span>
              </button>
              <p className="tree-branch-description">Upload a completed CSV, add anchor and catalog evidence, review claims, and publish only after verification.</p>
            </div>
            <div className="tree-branch">
              <button
                type="button"
                className={`tree-branch-btn tree-branch-btn--generate ${selectedFlow === 'ai' ? 'active' : ''}`}
                onClick={beginGenerateFlow}
              >
                <div className="branch-icon"><Sparkles size={20} /></div>
                <span className="branch-text">Generate Catalog Images & Verify <ArrowRight size={16} /></span>
              </button>
              <p className="tree-branch-description">Upload garment anchors and size chart, generate a catalog candidate, then verify it against the same evidence.</p>
            </div>
          </div>
        </div>
      </div>

      {selectedFlow && (
        <div className="workflow-grid" style={{ display: 'flex', gap: '40px', position: 'relative', marginTop: '40px', animation: 'slideUp 0.4s ease' }}>
          {selectedFlow === 'csv' && (
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
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Showing all {Object.keys(csvData[0] || {}).length} CSV columns. Scroll sideways to inspect every seller value before choosing a row.
              </p>
              <div
                className="excel-wrap"
                style={{ maxHeight: '360px', overflow: 'auto', borderRadius: '10px' }}
                tabIndex={0}
                aria-label="Scrollable CSV data preview"
              >
                <table className="excel-tbl" style={{ minWidth: `${Math.max(920, Object.keys(csvData[0] || {}).length * 165 + 90)}px` }}>
                  <thead>
                    <tr>
                      <th
                        aria-label="Select listing row"
                        style={{ position: 'sticky', left: 0, top: 0, zIndex: 3, minWidth: 78, background: '#f7f8fa' }}
                      >
                        Select
                      </th>
                      {Object.keys(csvData[0] || {}).map(key => (
                        <th key={key} style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 150, maxWidth: 240 }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.map((row, i) => (
                      <tr key={i} onClick={() => setSelectedCsvRow(i)} style={{ cursor: 'pointer', background: selectedCsvRow === i ? 'var(--accent-light)' : undefined }} aria-selected={selectedCsvRow === i}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: 78, background: selectedCsvRow === i ? 'var(--accent-light)' : '#fff' }}>
                          <input
                            type="radio"
                            name="csv-listing-row"
                            checked={selectedCsvRow === i}
                            onChange={() => setSelectedCsvRow(i)}
                            onClick={event => event.stopPropagation()}
                            aria-label={`Select row ${i + 1}`}
                          />
                        </td>
                        {Object.keys(csvData[0] || {}).map(key => {
                          const value = String(row[key] ?? '');
                          return (
                            <td
                              key={key}
                              title={value || 'Blank'}
                              style={{ minWidth: 150, maxWidth: 240, whiteSpace: 'normal', overflowWrap: 'anywhere', verticalAlign: 'top' }}
                            >
                              {value || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                {selectedCsvRow === null ? 'Select one row before continuing.' : `Row ${selectedCsvRow + 1} selected for verification.`}
              </p>
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
                disabled={!csvFile || selectedCsvRow === null || !leftFront || !leftBack || !leftCloseup || extracting}
              >
                {extracting ? <><span className="spinner"></span> Processing...</> : <>Step 5: Extract & Review <ArrowRight size={16} /></>}
              </button>
            </div>
          )}
        </section>
          )}
          {selectedFlow === 'ai' && (
            <section className="listing-panel listing-panel--ai" style={{ flex: '1 1 0%', padding: '28px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                <div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedFlow(null)} style={{ marginBottom: 12 }}>
                    Back to workflows
                  </button>
                  <div className="section-kicker">Catalog candidate workflow</div>
                  <h2 style={{ fontSize: '22px', fontWeight: 750, margin: '4px 0 7px' }}>Generate catalog images, then verify them.</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: 680, margin: 0, fontSize: '14px', lineHeight: 1.55 }}>
                    Start with three physical-garment anchors. Anchor extracts a draft for seller confirmation, then checks the resulting listing against those same evidence files.
                  </p>
                </div>
                <span className="badge" style={{ background: 'var(--accent-lighter)', color: 'var(--accent)', whiteSpace: 'nowrap', marginTop: 8 }}>
                  {rightStep === 'anchors' ? 'Step 1 of 2' : 'Step 2 of 2'}
                </span>
              </div>

              {error && <div className="inline-form-alert" role="alert" style={{ marginBottom: 18 }}>{error}</div>}

              {rightStep === 'anchors' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Upload physical garment anchors</h3>
                      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>Front, back, and a fabric/detail close-up are required. They become the immutable evidence set for this run.</p>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>3 required views</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 22 }}>
                    <div
                      className={`drop-zone ${anchorFront ? 'filled' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => rightFrontRef.current?.click()}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') rightFrontRef.current?.click(); }}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) handleRightImage('front', { target: { files: event.dataTransfer.files } }); }}
                      style={{ padding: 10, minHeight: 196, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <input type="file" accept="image/*" ref={rightFrontRef} hidden onClick={event => event.stopPropagation()} onChange={event => handleRightImage('front', event)} />
                      {anchorFront ? <img src={anchorFront.preview} alt="Front anchor selected" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} /> : <><Camera size={22} color="var(--text-tertiary)" /><strong style={{ fontSize: 13, marginTop: 10 }}>Front view</strong><span className="drop-hint">Required</span></>}
                    </div>
                    <div
                      className={`drop-zone ${anchorBack ? 'filled' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => rightBackRef.current?.click()}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') rightBackRef.current?.click(); }}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) handleRightImage('back', { target: { files: event.dataTransfer.files } }); }}
                      style={{ padding: 10, minHeight: 196, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <input type="file" accept="image/*" ref={rightBackRef} hidden onClick={event => event.stopPropagation()} onChange={event => handleRightImage('back', event)} />
                      {anchorBack ? <img src={anchorBack.preview} alt="Back anchor selected" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} /> : <><Camera size={22} color="var(--text-tertiary)" /><strong style={{ fontSize: 13, marginTop: 10 }}>Back view</strong><span className="drop-hint">Required</span></>}
                    </div>
                    <div
                      className={`drop-zone ${anchorCloseup ? 'filled' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => rightCloseupRef.current?.click()}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') rightCloseupRef.current?.click(); }}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) handleRightImage('closeup', { target: { files: event.dataTransfer.files } }); }}
                      style={{ padding: 10, minHeight: 196, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <input type="file" accept="image/*" ref={rightCloseupRef} hidden onClick={event => event.stopPropagation()} onChange={event => handleRightImage('closeup', event)} />
                      {anchorCloseup ? <img src={anchorCloseup.preview} alt="Fabric close-up selected" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} /> : <><Camera size={22} color="var(--text-tertiary)" /><strong style={{ fontSize: 13, marginTop: 10 }}>Fabric close-up</strong><span className="drop-hint">Required</span></>}
                    </div>
                  </div>

                  <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,.62)', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Requested model setup</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, .7fr) minmax(180px, .8fr) minmax(220px, 1.3fr)', gap: 12, alignItems: 'end' }}>
                      <div>
                        <label className="form-label">Model wears size <span className="req">*</span></label>
                        <select className="form-select" value={rightModelSize} onChange={event => setRightModelSize(event.target.value)}>
                          {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Model height <span className="req">*</span></label>
                        <input className="form-input" value={rightModelHeight} onChange={event => setRightModelHeight(event.target.value)} placeholder={'e.g. 5\'4"'} aria-label="Model height" />
                      </div>
                      <div
                        className="drop-zone"
                        role="button"
                        tabIndex={0}
                        onClick={() => rightSizeRef.current?.click()}
                        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') rightSizeRef.current?.click(); }}
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) handleRightImage('size', { target: { files: event.dataTransfer.files } }); }}
                        style={{ minHeight: 44, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
                      >
                        <input type="file" ref={rightSizeRef} accept="image/*,.pdf,.csv,.xlsx" hidden onClick={event => event.stopPropagation()} onChange={event => handleRightImage('size', event)} />
                        {sizeChart ? <><Check size={16} color="var(--success)" /><span style={{ fontSize: 12, color: 'var(--success)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sizeChart.name || 'Size chart selected'}</span></> : <><UploadIcon size={16} color="var(--text-tertiary)" /><span style={{ fontSize: 12 }}>Add size chart <span style={{ color: 'var(--danger)', fontWeight: 700 }}>(required)</span></span></>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', background: 'linear-gradient(45deg, var(--accent), var(--coral))', border: 'none' }}
                    onClick={handleExtractAttributes}
                    disabled={!anchorFront || !anchorBack || !anchorCloseup || !sizeChart || extracting}
                  >
                    {extracting ? <><Loader2 size={16} className="spin" /> Extracting garment draft…</> : <>Continue to seller confirmation <ArrowRight size={16} /></>}
                  </button>
                  <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Anchor will never replace your product with an unrelated render. A finalist candidate is reusable only when the exact anchors and requested model setup match its evidence record.
                  </p>
                </>
              ) : (
                <>
                  <div style={{ padding: '13px 15px', borderRadius: 10, background: '#eef9f4', border: '1px solid #c5ead9', color: '#087f5b', fontSize: 13, marginBottom: 16 }}>
                    <strong>Confirm the seller-declared product details.</strong> These are your editable claims; the following page compares them with the immutable anchor evidence rather than treating them as facts.
                  </div>
                  {generationExtractionNotice && (
                    <div className="inline-form-alert" style={{ marginBottom: 16, background: '#fff8ea', borderColor: '#f5d9a3', color: '#9a5b00' }}>
                      {generationExtractionNotice}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px 16px', marginBottom: 20 }}>
                    {GENERATION_ATTRIBUTE_FIELDS.map(({ key, label, required, placeholder }) => (
                      <div key={key} className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">{label}{required && <span className="req"> *</span>}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={valueForInput(extractedAttrs?.[key])}
                          placeholder={placeholder}
                          onChange={event => updateGenerationClaim(key, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,.62)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Requested model setup</div>
                      <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-secondary)' }}>Size {rightModelSize} · Height {rightModelHeight || 'not provided'}{sizeChart ? ` · ${sizeChart.name || 'size chart attached'}` : ''}</div>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setRightStep('anchors')}>Edit anchors or model setup</button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', background: 'linear-gradient(45deg, var(--accent), var(--coral))', border: 'none' }}
                    onClick={startGenerationReview}
                  >
                    Review evidence & generate candidate <ArrowRight size={16} />
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      )}

      {/* ─── MY LISTINGS ─────────────────────────── */}
      <section className="my-listings-section" style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>My Listings</h2>
          {hiddenMockIds.size > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setHiddenMockIds(new Set())}>
              Show sample listings again
            </button>
          )}
        </div>
        {(() => {
          const visibleMocks = MOCK_LISTINGS.filter(m => !hiddenMockIds.has(m.id));
          const allListings = [...visibleMocks, ...products];
          if (loadingProducts) return <div style={{ color: 'var(--text-secondary)' }}>Loading listings…</div>;
          if (!allListings.length) return <div style={{ color: 'var(--text-secondary)' }}>No listings found. Create one above!</div>;
          return (
            <div className="listing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {allListings.map(product => {
                const isMock = product.id?.toString().startsWith('mock-');
                const imgSrc = isMock
                  ? product.image
                  : (product.catalog_images?.[0]?.url || product.catalog_images?.[0] || product.anchor_image_url || FASHION_EDITORIAL);
                const status = isMock ? product.verification_status : (product.verification_report?.verdict?.status || product.verification_status || 'pending');
                return (
                  <article key={product.id} className="listing-card" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-white)', cursor: 'pointer', position: 'relative', transition: 'transform 0.2s, box-shadow 0.2s' }} onClick={() => isMock ? setPreviewListing(product) : navigate(`/product/${product.id}`)}>
                    {isMock && (
                      <button
                        className="mock-dismiss-btn"
                        onClick={e => { e.stopPropagation(); setHiddenMockIds(prev => new Set([...prev, product.id])); }}
                        title="Remove from view"
                      >×</button>
                    )}
                    <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', backgroundColor: '#f5f5f6' }}>
                      <img
                        src={imgSrc}
                        alt={product.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.src = FASHION_EDITORIAL; }}
                      />
                      {renderBadge(status)}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      {isMock && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Sample listing</span>}
                      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={product.title}>{product.title || 'Untitled'}</h3>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{product.category || 'Women · Apparel'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <div>
                          <small style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)' }}>Price</small>
                          <strong>₹{product.selling_price || product.mrp || '999'}</strong>
                        </div>
                        <div className="listing-card-actions">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm listing-delete-btn"
                              onClick={event => isMock
                                ? (event.stopPropagation(), setHiddenMockIds(prev => new Set([...prev, product.id])))
                                : handleDeleteListing(event, product.id)}
                              disabled={!isMock && deletingListingId === product.id}
                              title={isMock ? 'Hide sample listing' : 'Delete listing'}
                            >
                              <Trash2 size={14} /> {!isMock && deletingListingId === product.id ? 'Removing' : 'Delete'}
                            </button>
                            <button type="button" className="btn btn-outline btn-sm listing-view-btn" onClick={e => { e.stopPropagation(); isMock ? setPreviewListing(product) : navigate(`/product/${product.id}`); }}>
                              <Eye size={14} /> View
                            </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          );
        })()}
      </section>
      {previewListing && (
        <div className="listing-preview-backdrop" role="presentation" onClick={() => setPreviewListing(null)}>
          <section className="listing-preview-modal" role="dialog" aria-modal="true" aria-label={`${previewListing.title} preview`} onClick={event => event.stopPropagation()}>
            <button type="button" className="listing-preview-close" onClick={() => setPreviewListing(null)} aria-label="Close preview"><X size={18} /></button>
            <img src={previewListing.image} alt={previewListing.title} />
            <div>
              <span className="badge badge-pass">Sample listing</span>
              <h2>{previewListing.title}</h2>
              <p>{previewListing.category}</p>
              <strong>₹{previewListing.selling_price}</strong>
              <p className="listing-preview-copy">A demo catalog entry showing how an Anchor-verified product appears in the seller workspace.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
