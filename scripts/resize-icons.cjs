const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, '../icons/logo-original.jpg');
const outputDir = path.join(__dirname, '../icons');

const sizes = [16, 48, 128];

async function resizeIcons() {
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error('Input file not found:', inputPath);
      process.exit(1);
    }

    console.log('Resizing logo to icon sizes...');
    
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon${size}.png`);
      await sharp(inputPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
        })
        .png()
        .toFile(outputPath);
      console.log(`Created: icon${size}.png`);
    }
    
    console.log('All icons created successfully!');
  } catch (error) {
    console.error('Error resizing icons:', error);
    process.exit(1);
  }
}

resizeIcons();
