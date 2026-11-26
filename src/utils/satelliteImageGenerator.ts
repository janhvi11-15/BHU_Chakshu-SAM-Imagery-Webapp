/**
 * Procedural High-Fidelity Satellite Tile Synthesis for BhuChakshu
 * Generates realistic Earth Observation satellite imagery textures
 * (Sentinel-2 / Bhuvan LISS-IV / Landsat 9 optical simulations)
 */

export function generateSyntheticSatelliteTile(type: string, width = 800, height = 800): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (type === 'punjab-agri') {
    // Punjab Wheat & Paddy Farm Parcels (Ludhiana)
    // Rich mosaic of geometric rectangular plots with earthen bunds and irrigation canals
    ctx.fillStyle = '#2d4a22';
    ctx.fillRect(0, 0, width, height);

    const plotColors = [
      '#38662c', // Healthy wheat vegetative
      '#477c38', // High chlorophyll green
      '#2d5422', // Deep green paddy
      '#5f8f41', // Bright young crop
      '#8f864d', // Harvested / golden stubble
      '#a3935c', // Fallow tilled soil
      '#665d3d', // Dry loam parcel
      '#24421b', // Shaded grove
    ];

    // Grid of agricultural fields
    const cols = 9;
    const rows = 8;
    const cellW = width / cols;
    const cellH = height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Random field subdivisions
        const x = c * cellW;
        const y = r * cellH;
        const w = cellW - 4; // leave 4px for earthen bund (meḍh)
        const h = cellH - 4;

        ctx.fillStyle = plotColors[(r * 5 + c * 3 + (r + c)) % plotColors.length];
        ctx.fillRect(x + 2, y + 2, w, h);

        // Add subtle crop furrow lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        for (let fy = 6; fy < h - 6; fy += 8) {
          ctx.beginPath();
          ctx.moveTo(x + 4, y + fy);
          ctx.lineTo(x + w - 4, y + fy);
          ctx.stroke();
        }
      }
    }

    // Earthen Bunds (Meḍh / Ridges between fields)
    ctx.strokeStyle = '#c4b58c'; // Tan/dry earth bund color
    ctx.lineWidth = 3.5;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, height);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(width, r * cellH);
      ctx.stroke();
    }

    // Irrigation Canal running diagonally
    ctx.strokeStyle = '#1d4ed8'; // Water canal
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.35);
    ctx.bezierCurveTo(width * 0.4, height * 0.38, width * 0.6, height * 0.6, width, height * 0.65);
    ctx.stroke();

    // Canal embankment
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Farmstead / tube-well settlements (concrete roofs)
    ctx.fillStyle = '#dc2626'; // Red tile roof
    ctx.fillRect(width * 0.25, height * 0.45, 14, 14);
    ctx.fillStyle = '#e2e8f0'; // Tin roof
    ctx.fillRect(width * 0.7, height * 0.2, 18, 12);
  } else if (type === 'godavari-delta') {
    // Godavari River Delta & Aquaculture (Kakinada / Andhra)
    // Rectangular brackish aquaculture ponds and meandering estuary water channels
    ctx.fillStyle = '#223c28';
    ctx.fillRect(0, 0, width, height);

    // River estuary water body
    ctx.fillStyle = '#0f3854';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.2);
    ctx.bezierCurveTo(width * 0.3, height * 0.25, width * 0.5, height * 0.45, width, height * 0.4);
    ctx.lineTo(width, height * 0.6);
    ctx.bezierCurveTo(width * 0.6, height * 0.7, width * 0.3, height * 0.5, 0, height * 0.45);
    ctx.closePath();
    ctx.fill();

    // Aquaculture shrimp ponds (regular water rectangles with aerator glints)
    const pondColors = ['#164e63', '#0e7490', '#155e75', '#083344', '#1e293b'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        const x = 40 + c * 90;
        const y = height * 0.62 + r * 65;
        if (y + 55 < height) {
          ctx.fillStyle = pondColors[(r * 3 + c) % pondColors.length];
          ctx.fillRect(x, y, 75, 48);

          // Earthen pond dykes
          ctx.strokeStyle = '#a89f81';
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, 75, 48);

          // Aerator white foam ripple
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(x + 30, y + 20, 8, 4);
        }
      }
    }

    // Mangrove buffer zone
    ctx.fillStyle = '#14532d';
    for (let i = 0; i < 40; i++) {
      const mx = Math.random() * width;
      const my = Math.random() * (height * 0.25);
      ctx.beginPath();
      ctx.arc(mx, my, 12 + Math.random() * 15, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'wayanad-landslide') {
    // Wayanad Western Ghats (Kerala) - Slope failure, tea plantations & forest
    // Lush green mountain slope with a distinct brown landslide scar path
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#166534');
    grad.addColorStop(0.5, '#14532d');
    grad.addColorStop(1, '#0f3e1b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Tea plantation terraced contour lines
    ctx.strokeStyle = 'rgba(134, 239, 172, 0.15)';
    ctx.lineWidth = 3;
    for (let y = 30; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(width * 0.3, y - 20, width * 0.7, y + 25, width, y);
      ctx.stroke();
    }

    // Prominent Landslide Scar (Mud, boulder debris flow carving down the slope)
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(width * 0.45, 0); // Origin at mountain ridge
    ctx.bezierCurveTo(width * 0.42, height * 0.3, width * 0.35, height * 0.6, width * 0.28, height);
    ctx.lineTo(width * 0.48, height);
    ctx.bezierCurveTo(width * 0.52, height * 0.6, width * 0.55, height * 0.3, width * 0.52, 0);
    ctx.closePath();
    ctx.fill();

    // Debris deposit fan at base
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(width * 0.38, height * 0.88, 120, 60, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Scattered boulders / exposed bedrock
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 25; i++) {
      const bx = width * 0.34 + Math.random() * 90;
      const by = height * 0.4 + Math.random() * (height * 0.5);
      ctx.beginPath();
      ctx.arc(bx, by, 2 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'bengaluru-urban') {
    // Bengaluru Peri-Urban Sprawl & Lake (Varthur / Bellandur)
    // Urban concrete grid, road network, and encroached wetland/lake
    ctx.fillStyle = '#94a3b8'; // Dense urban concrete base
    ctx.fillRect(0, 0, width, height);

    // Lake body (irregular polygon)
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.moveTo(width * 0.2, height * 0.3);
    ctx.bezierCurveTo(width * 0.4, height * 0.25, width * 0.65, height * 0.4, width * 0.8, height * 0.55);
    ctx.bezierCurveTo(width * 0.7, height * 0.85, width * 0.4, height * 0.8, width * 0.25, height * 0.65);
    ctx.closePath();
    ctx.fill();

    // Eutrophic algal green bloom / weed zone on lake margin
    ctx.fillStyle = 'rgba(74, 222, 128, 0.45)';
    ctx.beginPath();
    ctx.ellipse(width * 0.35, height * 0.5, 90, 50, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Road Grid Networks
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.15);
    ctx.lineTo(width, height * 0.15);
    ctx.moveTo(0, height * 0.88);
    ctx.lineTo(width, height * 0.88);
    ctx.moveTo(width * 0.12, 0);
    ctx.lineTo(width * 0.12, height);
    ctx.moveTo(width * 0.88, 0);
    ctx.lineTo(width * 0.88, height);
    ctx.stroke();

    // Tech parks and high-rise apartment footprints
    const roofColors = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#0284c7', '#dc2626'];
    for (let i = 0; i < 45; i++) {
      const rx = Math.random() * (width - 60);
      const ry = Math.random() * (height - 60);
      // Don't place on middle lake
      if (!(rx > width * 0.25 && rx < width * 0.75 && ry > height * 0.3 && ry < height * 0.7)) {
        ctx.fillStyle = roofColors[i % roofColors.length];
        ctx.fillRect(rx, ry, 20 + Math.random() * 35, 16 + Math.random() * 25);
      }
    }
  } else if (type === 'sundarbans-mangrove') {
    // Sundarbans Mangrove Tiger Reserve & Tidal Channels
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, width, height);

    // Meandering muddy tidal creek
    ctx.strokeStyle = '#0f3629';
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.bezierCurveTo(width * 0.3, height * 0.2, width * 0.6, height * 0.8, width, height * 0.45);
    ctx.stroke();

    // Secondary tidal gullies
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(width * 0.35, height * 0.35);
    ctx.bezierCurveTo(width * 0.45, 0, width * 0.5, 0, width * 0.5, 0);
    ctx.stroke();

    // Exposed mudflats at low tide
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.ellipse(width * 0.45, height * 0.48, 80, 25, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'thar-solar') {
    // Thar Desert Bhadla Solar Park (Rajasthan)
    ctx.fillStyle = '#d97706'; // Desert sand base
    ctx.fillRect(0, 0, width, height);

    // Sand dune ripples
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    for (let y = 10; y < height; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(width * 0.4, y + 8, width * 0.6, y - 8, width, y);
      ctx.stroke();
    }

    // Solar PV Arrays (Deep navy rectangular photovoltaic rows)
    const arrayCols = 6;
    const arrayRows = 5;
    for (let r = 0; r < arrayRows; r++) {
      for (let c = 0; c < arrayCols; c++) {
        const sx = 80 + c * 110;
        const sy = 80 + r * 130;
        ctx.fillStyle = '#0f172a'; // Dark silicon absorption
        ctx.fillRect(sx, sy, 85, 95);

        // Sub-panel cell lines
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 0.8;
        for (let py = 12; py < 90; py += 14) {
          ctx.beginPath();
          ctx.moveTo(sx, sy + py);
          ctx.lineTo(sx + 85, sy + py);
          ctx.stroke();
        }

        // Perimeter boundary fence
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - 4, sy - 4, 93, 103);
      }
    }
  }

  // Add realistic satellite sensor atmospheric noise / speckle
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    d[i] = Math.min(255, Math.max(0, d[i] + noise));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.92);
}
