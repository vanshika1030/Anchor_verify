const fs = require('fs');
const path = require('path');
let txt = fs.readFileSync('C:/Users/vansh/.gemini/antigravity/scratch/anchor/backend/services/gemini_old2.js', 'utf8');

const searchStr = `  const generatedImages = []

  // Try Gemini image generation first
  if (apiKeys.length > 0) {
    console.log(\`[IMAGE-GEN] Generating 5 AI model catalog images via Gemini...\`)`;

const startIdx = txt.indexOf(searchStr);
if (startIdx === -1) {
    console.log('Search string not found!');
    process.exit(1);
}

const endStr = `  // If Gemini generated at least some images, return them`;
const endIdx = txt.indexOf(endStr, startIdx);

const replacement = `  const generatedImages = []
  const missingViews = []
  
  // Try Gemini image generation first
  if (apiKeys.length > 0) {
    // 1. Check cache / pregenerated for all views first
    for (let i = 0; i < VIEWS.length; i++) {
        const view = VIEWS[i]
        const outputFile = path.join(process.cwd(), 'uploads', \`gen_\${parsedPath.name}_\${view.name}.png\`)
        
        let pregenFound = false
        const pythonHeight = modelHeight.replace(/['"|]/g, '');
        const sizeHash = \`\${modelSize}_\${pythonHeight}\`;
        const pregenFileSize = path.join(pregeneratedDir, \`\${contentHash}_\${sizeHash}_\${view.name}.png\`);
        const pregenFileBase = path.join(pregeneratedDir, \`\${contentHash}_\${view.name}.png\`);
        
        const checkPregen = (filePath, sourceFolder = '') => {
          if (fs.existsSync(filePath)) {
            console.log(\`[IMAGE-GEN] Using pregenerated \${view.name} view \${sourceFolder ? \`from \${sourceFolder}\` : ''} (content-hash match)\`);
            fs.copyFileSync(filePath, outputFile);
            generatedImages.push({
              view: view.name,
              url: \`http://localhost:3001/uploads/gen_\${parsedPath.name}_\${view.name}.png\`
            });
            return true;
          }
          return false;
        };

        if (checkPregen(pregenFileSize) || checkPregen(pregenFileBase)) {
          pregenFound = true;
        } else if (fs.existsSync(pregeneratedDir)) {
          const subfolders = fs.readdirSync(pregeneratedDir, { withFileTypes: true }).filter(d => d.isDirectory())
          for (const folder of subfolders) {
            const subFileSize = path.join(pregeneratedDir, folder.name, \`\${contentHash}_\${sizeHash}_\${view.name}.png\`);
            const subFileBase = path.join(pregeneratedDir, folder.name, \`\${contentHash}_\${view.name}.png\`);
            if (checkPregen(subFileSize, folder.name) || checkPregen(subFileBase, folder.name)) {
              pregenFound = true;
              break;
            }
          }
        }
        
        if (pregenFound) continue;

        if (fs.existsSync(outputFile)) {
          console.log(\`[IMAGE-GEN] Using cached \${view.name} view\`)
          generatedImages.push({
            view: view.name,
            url: \`http://localhost:3001/uploads/gen_\${parsedPath.name}_\${view.name}.png\`
          })
          continue;
        }

        missingViews.push(view);
    }

    // 2. If any views are missing, generate them all in a composite image for identity consistency
    if (missingViews.length > 0) {
      console.log(\`[IMAGE-GEN] Generating 5-panel composite catalog image via Gemini to maintain model identity...\`)
      
      const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image']
      const IMAGE_MAX_RETRIES = 1
      
      const compositePrompt = \`Professional Myntra e-commerce catalog photo. A single wide image containing exactly 5 vertical panels arranged horizontally side-by-side. 
The panels show the SAME Indian female model (height \${modelHeight}, \${bodyDesc}, size \${modelSize}) wearing the EXACT same garment: \${garmentDesc}.
Panel 1 (Left): Front view, full body.
Panel 2: Back view, full body.
Panel 3: Side profile view.
Panel 4: Close-up detail of neck and fabric.
Panel 5 (Right): Full body editorial shot.
Model must have a perfectly consistent identity across all 5 panels. White studio background, professional lighting.\`;

      let imageGenerated = false

      for (let modelIdx = 0; modelIdx < IMAGE_MODELS.length; modelIdx++) {
        if (imageGenerated) break;
        const modelName = IMAGE_MODELS[modelIdx]

        for (let attempt = 0; attempt <= IMAGE_MAX_RETRIES; attempt++) {
          try {
            console.log(\`[IMAGE-GEN] Trying \${modelName} for composite image (Attempt \${attempt + 1})...\`)
            const apiKey = getNextKey() || process.env.GEMINI_API_KEY
            const ai = new GoogleGenAI({ apiKey: apiKey })
            const anchorInlineData = await fileToInlineData(anchorPath)

            const promptParts = [anchorInlineData]
            if (sizeChartPath) {
              promptParts.push(await fileToInlineData(sizeChartPath))
              promptParts.push({ text: \`Analyze the attached size chart to determine the accurate bodily proportions and length for size \${modelSize}. Apply these proportions to the generated model image.\` })
            }
            promptParts.push({ text: compositePrompt })

            const response = await ai.models.generateContent({
              model: modelName,
              contents: [{ parts: promptParts }],
              config: { responseModalities: ['TEXT', 'IMAGE'] }
            })

            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData || part.inline_data) {
                  const inlineData = part.inlineData || part.inline_data
                  const imgBuffer = Buffer.from(inlineData.data, 'base64')
                  
                  // Use Sharp to slice the composite image into 5 equal vertical panels
                  const metadata = await sharp(imgBuffer).metadata();
                  const panelWidth = Math.floor(metadata.width / 5);
                  
                  console.log(\`[IMAGE-GEN] Slicing composite image (\${metadata.width}x\${metadata.height}) into 5 panels of width \${panelWidth}...\`);
                  
                  for (let i = 0; i < VIEWS.length; i++) {
                     const view = VIEWS[i];
                     const outputFile = path.join(process.cwd(), 'uploads', \`gen_\${parsedPath.name}_\${view.name}.png\`);
                     
                     // Only generate if we don't already have it from cache
                     if (missingViews.find(v => v.name === view.name)) {
                         await sharp(imgBuffer)
                           .extract({ left: i * panelWidth, top: 0, width: panelWidth, height: metadata.height })
                           .toFile(outputFile);
                           
                         generatedImages.push({
                           view: view.name,
                           url: \`http://localhost:3001/uploads/gen_\${parsedPath.name}_\${view.name}.png\`
                         });
                     }
                  }

                  imageGenerated = true
                  console.log(\`[IMAGE-GEN] ✅ Composite generation & slicing completed using \${modelName}\`)
                  break
                }
              }
            }

            if (!imageGenerated) {
              console.warn(\`[IMAGE-GEN] Composite image: no image in response from \${modelName}\`)
              break // Try next model
            } else {
              break // Success
            }
          } catch (err) {
            console.warn(\`[IMAGE-GEN] Composite view failed on \${modelName}: \${err.message}\`)
            const msg = err.message || ''
            
            if (msg.includes('404') || msg.includes('not found') || msg.includes('does not exist')) break;
            if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
              if (attempt < IMAGE_MAX_RETRIES) {
                const delay = (typeof BASE_DELAY_MS !== 'undefined' ? BASE_DELAY_MS : 2000) * Math.pow(2, attempt)
                await new Promise(r => setTimeout(r, delay))
                continue
              } else break;
            }
            break; 
          }
        }
      }
    }
  }\n\n`;

txt = txt.substring(0, startIdx) + replacement + txt.substring(endIdx);
fs.writeFileSync('C:/Users/vansh/.gemini/antigravity/scratch/anchor/backend/services/gemini.js', txt);
console.log('Successfully refactored generateCatalogImage in gemini.js');
