const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function convertHTMLtoPDF() {
  const htmlPath = path.join(__dirname, 'cotizacion-planes-parse.html');
  const pdfPath = path.join(__dirname, 'cotizacion-planes-parse.pdf');
  const logoPath = path.join(__dirname, 'axioma_logo_300x500.png');

  // Verificar que el HTML existe
  if (!fs.existsSync(htmlPath)) {
    console.error('El archivo HTML no existe:', htmlPath);
    process.exit(1);
  }

  console.log('Iniciando conversión a PDF...');
  console.log('HTML:', htmlPath);
  console.log('PDF:', pdfPath);

  // Leer logo y convertir a base64
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = logoBuffer.toString('base64');
    console.log('Logo cargado:', logoPath);
  } else {
    console.log('Logo no encontrado, usando solo texto');
  }

  const browser = await puppeteer.launch({
    headless: 'new'
  });

  const page = await browser.newPage();

  // Cargar el HTML
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, {
    waitUntil: 'networkidle0'
  });

  // Agregar clase para modo PDF
  await page.evaluate(() => {
    document.body.classList.add('pdf-mode');
  });

  // Generar el PDF con opciones optimizadas para impresión
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width: 100%; text-align: center; padding: 8px 0 5px 0; border-bottom: 2px solid #8E6AAA; font-size: 10px; margin: 0 10mm;">
        ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" style="height: 28px; display: inline-block; vertical-align: middle;">` : ''}
        <span style="font-family: Arial, sans-serif; font-weight: 900; font-size: 16px; color: #352151; text-transform: uppercase; margin-left: 12px; display: inline-block; vertical-align: middle; font-style: italic; letter-spacing: -0.5px;">PARSE</span>
        <span style="color: #666; font-size: 9px; margin-left: 12px; display: inline-block; vertical-align: middle;">Sistema de Extracción y Transformación de Comprobantes</span>
      </div>
    `,
    footerTemplate: '<div></div>',
    margin: {
      top: '65px',
      right: '10mm',
      bottom: '10mm',
      left: '10mm'
    },
    preferCSSPageSize: false
  });

  await browser.close();

  console.log('✓ PDF generado exitosamente:', pdfPath);
}

convertHTMLtoPDF().catch(error => {
  console.error('Error al convertir HTML a PDF:', error);
  process.exit(1);
});
