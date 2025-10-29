const fs = require('fs');
const path = require('path');

const files = [
  'packages/web/src/components/layout/Sidebar.tsx',
  'packages/web/src/app/(protected)/rendiciones/page.tsx',
  'packages/web/src/app/(protected)/exportar/page.tsx',
  'packages/web/src/app/(protected)/autorizaciones/page.tsx',
  'packages/web/src/app/auth/register/page.tsx',
  'packages/web/src/app/page.tsx'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace the import
    const originalContent = content;
    content = content.replace(
      "import { useAuth } from '@/lib/auth';",
      "import { useAuth } from '@/contexts/AuthContext';"
    );

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${file}`);
    } else {
      console.log(`⏭️  Skipped (no changes): ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${file}:`, error.message);
  }
});

console.log('\n✨ Import fixes completed!');