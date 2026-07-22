export async function generateCatalogImage(imagePaths, attributes, cvOverallLength, sizeChartPath = null) {
  if (!imagePaths || imagePaths.length === 0) return null
  
  const anchorPath = imagePaths[0]
  const parsedPath = path.parse(anchorPath)
  
  const imageBytes = fs.readFileSync(anchorPath)
  const contentHash = crypto.createHash('md5').update(imageBytes.slice(0, 10240)).digest('hex').substring(0, 12)
  const pregeneratedDir = path.join(process.cwd(), 'uploads', 'pregenerated')
  
  // Build garment description from ALL extracted attributes
  const gt = attributes.garment_type?.value || attributes.garment_type || 'garment'
  const color = attributes.primary_color?.value || attributes.primary_color || ''
  const secColor = attributes.secondary_color?.value || attributes.secondary_color || ''
  const fabric = attributes.fabric_appearance?.value || attributes.fabric || ''
  const pattern = attributes.pattern_type?.value || attributes.pattern_type || 'Solid'
  const neck = attributes.neck_type?.value || attributes.neck_type || ''
  const sleeve = attributes.sleeve_length?.value || attributes.sleeve_length || ''
  const fit = attributes.fit?.value || attributes.fit || 'Regular'
  const silhouette = attributes.silhouette?.value || attributes.silhouette || ''
  const embellishment = attributes.embellishment?.value || attributes.embellishment || 'None'
  const hemline = attributes.hemline?.value || attributes.hemline || ''
  const length = attributes.overall_length?.value || attributes.overall_length || ''
  const occasion = attributes.occasion_style?.value || attributes.occasion_style || ''
  const motif = attributes.motif_description?.value || attributes.motif_description || ''
  const modelHeight = attributes.model_height || '5\'7"'
  const modelSize = attributes.model_size || 'M'

  const garmentDesc = [
    color && `${color} colored`,
    secColor && secColor !== 'None' && `with ${secColor} accents`,
    pattern !== 'Solid' && `${pattern} pattern`,
    fabric && `${fabric} fabric`,
    gt,
    fit !== 'Regular' && `(${fit} fit)`,
    silhouette && `with ${silhouette} silhouette`,
    neck && `featuring ${neck} neckline`,
    sleeve && `${sleeve} sleeves`,
    length && `${length}`,
    hemline && hemline !== 'None' && `${hemline} hemline`,
    embellishment && embellishment !== 'None' && `with ${embellishment}`,
    motif && motif !== 'None' && `${motif} motif`,
  ].filter(Boolean).join(', ')

  // Size to body description mapping
  const sizeToBody = {
    'XS': 'petite, slim build',
    'S': 'slim, lean build',
    'M': 'average, regular build',
    'L': 'slightly curvy, regular-to-full build',
    'XL': 'full-figured, curvy build',
    'XXL': 'plus-size, full-figured build',
  }
  const bodyDesc = sizeToBody[modelSize?.toUpperCase()] || 'average build'

  const VIEWS = [
    {
      name: 'front',
      prompt: `Professional Myntra e-commerce catalog photo. An Indian female fashion model (height ${modelHeight}, ${bodyDesc}, size ${modelSize}) wearing: ${garmentDesc}. FRONT VIEW, full body from head to toe. The garment MUST show: ${fit} fit draping naturally on the body, ${length} length visible. White studio background, soft professional lighting, model standing straight facing camera. Photo-realistic, high resolution, e-commerce product photography style.`
    },
    {
      name: 'back',
      prompt: `Professional Myntra e-commerce catalog photo. Same Indian female model (height ${modelHeight}, ${bodyDesc}) wearing the exact same garment: ${garmentDesc}. BACK VIEW, full body. Show the back design, any back prints or patterns, and how the garment falls from behind. White studio background, professional lighting.`
    },
    {
      name: 'side',
      prompt: `Professional Myntra e-commerce catalog photo. Same Indian female model (height ${modelHeight}, ${bodyDesc}) wearing: ${garmentDesc}. SIDE PROFILE VIEW showing the garment's silhouette and how it drapes on the body. Show the ${fit} fit and ${length} clearly. White studio background, professional lighting.`
    },
    {
      name: 'closeup',
      prompt: `Close-up detail shot of the garment: ${garmentDesc}. Focus on the ${neck} neckline area and ${fabric} fabric texture. Show ${embellishment !== 'None' ? embellishment : 'stitching details'}. On the same Indian model. White background, macro-style e-commerce photography, sharp focus on fabric weave and construction details.`
    },
    {
      name: 'full',
      prompt: `Full-length editorial style Myntra catalog photo. Indian female model (${modelHeight}, ${bodyDesc}, size ${modelSize}) wearing: ${garmentDesc}. Styled for ${occasion || 'casual'} wear. Show the complete garment from a slightly angled perspective. Model in a natural, confident pose. White studio background, professional editorial lighting.`
    },
  ]

  const generatedImages = []

  // Try Gemini image generation first
  if (apiKeys.length > 0) {
    console.log(`[IMAGE-GEN] Generating 5 AI model catalog images via Gemini...`)
    
    const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image']
    const IMAGE_MAX_RETRIES = 1

    for (let i = 0; i < VIEWS.length; i++) {
      const view = VIEWS[i]
      const outputFile = path.join(process.cwd(), 'uploads', `gen_${parsedPath.name}_${view.name}.png`)
      
      // Check content-hash pregenerated cache first
      let pregenFound = false
      const pythonHeight = modelHeight.replace(/['"|]/g, '');
      const sizeHash = `${modelSize}_${pythonHeight}`;
      const pregenFileSize = path.join(pregeneratedDir, `${contentHash}_${sizeHash}_${view.name}.png`);
      const pregenFileBase = path.join(pregeneratedDir, `${contentHash}_${view.name}.png`);
      
      const checkPregen = (filePath, sourceFolder = '') => {
        if (fs.existsSync(filePath)) {
          console.log(`[IMAGE-GEN] Using pregenerated ${view.name} view ${sourceFolder ? `from ${sourceFolder}` : ''} (content-hash match)`);
          fs.copyFileSync(filePath, outputFile);
          generatedImages.push({
            view: view.name,
            url: `http://localhost:3001/uploads/gen_${parsedPath.name}_${view.name}.png`
          });
          return true;
        }
        return false;
      };

      if (checkPregen(pregenFileSize) || checkPregen(pregenFileBase)) {
        pregenFound = true;
      } else if (fs.existsSync(pregeneratedDir)) {
        // Also check subfolders
        const subfolders = fs.readdirSync(pregeneratedDir, { withFileTypes: true }).filter(d => d.isDirectory())
        for (const folder of subfolders) {
          const subFileSize = path.join(pregeneratedDir, folder.name, `${contentHash}_${sizeHash}_${view.name}.png`);
          const subFileBase = path.join(pregeneratedDir, folder.name, `${contentHash}_${view.name}.png`);
          if (checkPregen(subFileSize, folder.name) || checkPregen(subFileBase, folder.name)) {
            pregenFound = true;
            break;
          }
        }
      }
      
      if (pregenFound) continue;

      // Check cache
      if (fs.existsSync(outputFile)) {
        console.log(`[IMAGE-GEN] Using cached ${view.name} view`)
        generatedImages.push({
          view: view.name,
          url: `http://localhost:3001/uploads/gen_${parsedPath.name}_${view.name}.png`
        })
        continue
      }

      let imageGenerated = false

      for (let modelIdx = 0; modelIdx < IMAGE_MODELS.length; modelIdx++) {
        if (imageGenerated) break;
        const modelName = IMAGE_MODELS[modelIdx]

        for (let attempt = 0; attempt <= IMAGE_MAX_RETRIES; attempt++) {
          try {
            console.log(`[IMAGE-GEN] Trying ${modelName} for ${view.name} view (Attempt ${attempt + 1})...`)
            const apiKey = getNextKey() || process.env.GEMINI_API_KEY
            const ai = new GoogleGenAI({ apiKey: apiKey })
            const anchorInlineData = await fileToInlineData(anchorPath)

            const promptParts = [anchorInlineData]
            if (sizeChartPath) {
              promptParts.push(await fileToInlineData(sizeChartPath))
              promptParts.push({ text: `Analyze the attached size chart to determine the accurate bodily proportions and length for size ${modelSize}. Apply these proportions to the generated model image.` })
            }
            promptParts.push({ text: `Using the garment shown in the reference image above, ${view.prompt}` })

            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  parts: promptParts
                }
              ],
              config: { responseModalities: ['TEXT', 'IMAGE'] }
            })

            // Extract generated image from response
            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData || part.inline_data) {
                  const inlineData = part.inlineData || part.inline_data
                  const imgBuffer = Buffer.from(inlineData.data, 'base64')
                  fs.writeFileSync(outputFile, imgBuffer)
                  generatedImages.push({
                    view: view.name,
                    url: `http://localhost:3001/uploads/gen_${parsedPath.name}_${view.name}.png`
                  })
                  imageGenerated = true
                  console.log(`[IMAGE-GEN] ✅ ${view.name} view generated using ${modelName}`)
                  break
                }
              }
            }

            if (!imageGenerated) {
              console.warn(`[IMAGE-GEN] ${view.name} view: no image in response from ${modelName}`)
              break // Break out of retry loop, try next model
            } else {
              break // Success, break out of retry loop
            }
          } catch (err) {
            console.warn(`[IMAGE-GEN] ${view.name} view failed on ${modelName}: ${err.message}`)
            const msg = err.message || ''
            
            if (msg.includes('404') || msg.includes('not found') || msg.includes('does not exist')) {
              break // Break out of retry loop, try next model
            }
            
            if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
              if (attempt < IMAGE_MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt)
                console.warn(`[IMAGE-GEN] Rate limit on ${modelName}, retrying in ${delay}ms...`)
                await new Promise(r => setTimeout(r, delay))
                continue
              } else {
                break // Exhausted retries, try next model
              }
            }
            
            // Unknown error, try next model
            break 
          }
        }
      }

      // Rate limit prevention: 10 second delay between generations
      if (i < VIEWS.length - 1 && imageGenerated) {
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }
  }

  // If Gemini generated at least some images, return them
  if (generatedImages.length > 0) {
    console.log(`[IMAGE-GEN] Generated ${generatedImages.length}/5 AI model images`)
    return generatedImages
  }

  // Fallback: compositing (garment on white canvas)
  console.log('[IMAGE-GEN] Falling back to compositing (no AI model images)')
  
  try {
    let sourceBuffer
    if (cvOverallLength && cvOverallLength.cutout_path && fs.existsSync(cvOverallLength.cutout_path)) {
      sourceBuffer = fs.readFileSync(cvOverallLength.cutout_path)
    } else {
      try {
        const response = await fetch('http://localhost:8100/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_path: anchorPath })
        })
        const segResult = await response.json()
        if (segResult.success && segResult.cutout_path) {
          sourceBuffer = fs.readFileSync(segResult.cutout_path)
        } else {
          sourceBuffer = fs.readFileSync(anchorPath)
        }
      } catch {
        sourceBuffer = fs.readFileSync(anchorPath)
      }
    }
    
    // Dynamic Size and Height scaling maps
    const SIZE_SCALES = { 'XS': 0.85, 'S': 0.92, 'M': 1.0, 'L': 1.08, 'XL': 1.15, 'XXL': 1.25 };
    const HEIGHT_SCALES = { "5'2": 0.9, "5'4": 0.95, "5'6": 1.0, "5'8": 1.05, "5'10": 1.1, "6'0": 1.15 };
    
    const parsedHeight = modelHeight.replace(/"/g, ''); // e.g. "6'0"
    const wScale = SIZE_SCALES[modelSize] || 1.0;
    const hScale = HEIGHT_SCALES[parsedHeight] || 1.0;
    
    // We generate 5 composite images for the 5 views to ensure the frontend doesn't break
    const generatedFallbackImages = [];
    const canvasW = 600;
    const canvasH = 800;
    
    for (const view of VIEWS) {
      const outputPath = path.join(process.cwd(), 'uploads', `gen_${parsedPath.name}_${view.name}.png`);
      
      const resizedGarment = await sharp(sourceBuffer)
        .resize(Math.round(400 * wScale), Math.round(600 * hScale), { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      
      const garmentMeta = await sharp(resizedGarment).metadata();
      const left = Math.round((canvasW - garmentMeta.width) / 2);
      const top = Math.round((canvasH - garmentMeta.height) / 2);
      
      const headRadius = 40;
      const neckWidth = 30;
      const shoulderWidth = 200;
      const bodyWidth = 140;
      const bodyHeight = 350;
      
      const mannequinSvg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="#f0f2f5" />
        <g fill="#dcdfe6">
          <!-- Head -->
          <circle cx="${canvasW/2}" cy="120" r="${headRadius}" />
          <!-- Neck -->
          <rect x="${canvasW/2 - neckWidth/2}" y="${120 + headRadius - 5}" width="${neckWidth}" height="40" rx="10" />
          <!-- Shoulders & Torso -->
          <path d="M ${canvasW/2 - shoulderWidth/2} 180 
                   Q ${canvasW/2} 160 ${canvasW/2 + shoulderWidth/2} 180
                   L ${canvasW/2 + bodyWidth/2} ${180 + bodyHeight}
                   L ${canvasW/2 - bodyWidth/2} ${180 + bodyHeight} Z" rx="20"/>
          <!-- Legs -->
          <rect x="${canvasW/2 - bodyWidth/2 + 10}" y="${180 + bodyHeight}" width="50" height="250" rx="15" />
          <rect x="${canvasW/2 + bodyWidth/2 - 60}" y="${180 + bodyHeight}" width="50" height="250" rx="15" />
        </g>
        <rect x="4" y="4" width="${canvasW - 8}" height="${canvasH - 8}" fill="none" stroke="#e0e0e0" stroke-width="2" rx="8"/>
        <text x="20" y="30" fill="#888" font-family="sans-serif" font-size="12" font-weight="600">${view.name.toUpperCase()} VIEW (AI MODEL FALLBACK)</text>
      </svg>`;
      
      await sharp(Buffer.from(mannequinSvg))
      .composite([
        { input: resizedGarment, top, left }
      ])
      .png()
      .toFile(outputPath);
      
      generatedFallbackImages.push({
        view: view.name,
        url: `http://localhost:3001/uploads/gen_${parsedPath.name}_${view.name}.png`
      });
    }
      
    return generatedFallbackImages;
  } catch (err) {
    console.error("Failed to composite catalog images:", err)
    return null
  }
}

