/**
 * Get Database URL from Vercel
 * 
 * This script helps you retrieve the DATABASE_URL from Vercel
 * and save it to .env.local for running migrations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('📦 Get Database URL from Vercel');
console.log('='.repeat(70));
console.log();

// Check if vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log('✅ Vercel CLI is installed\n');
} catch (error) {
  console.log('❌ Vercel CLI is not installed\n');
  console.log('Install it with:');
  console.log('  npm install -g vercel\n');
  console.log('Then run this script again.\n');
  process.exit(1);
}

console.log('🔐 Pulling environment variables from Vercel...\n');
console.log('This will:');
console.log('  1. Prompt you to login to Vercel (if not already)');
console.log('  2. Link to your project (if not already linked)');
console.log('  3. Download environment variables to .env.local\n');

try {
  // Pull environment variables
  execSync('vercel env pull .env.local', { stdio: 'inherit' });
  
  console.log('\n✅ Environment variables downloaded!\n');
  
  // Check if DATABASE_URL exists in .env.local
  const envPath = path.join(__dirname, '.env.local');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('DATABASE_URL') || envContent.includes('POSTGRES_URL')) {
      console.log('✅ DATABASE_URL found in .env.local\n');
      
      // Extract and display (masked)
      const lines = envContent.split('\n');
      const dbLine = lines.find(line => 
        line.startsWith('DATABASE_URL=') || line.startsWith('POSTGRES_URL=')
      );
      
      if (dbLine) {
        const [key, value] = dbLine.split('=');
        const masked = value.substring(0, 30) + '...' + value.substring(value.length - 10);
        console.log(`   ${key}=${masked}\n`);
      }
      
      console.log('='.repeat(70));
      console.log('🎉 Ready to run migration!');
      console.log('='.repeat(70));
      console.log();
      console.log('Next step:');
      console.log('  node run-full-migration.js\n');
      
    } else {
      console.log('⚠️  DATABASE_URL not found in .env.local\n');
      console.log('This might mean:');
      console.log('  1. Your Vercel project doesn\'t have DATABASE_URL set');
      console.log('  2. You need to add it in Vercel dashboard\n');
      console.log('To add DATABASE_URL:');
      console.log('  1. Go to https://vercel.com/dashboard');
      console.log('  2. Select your project');
      console.log('  3. Go to Settings → Environment Variables');
      console.log('  4. Add DATABASE_URL with your database connection string');
      console.log('  5. Run this script again\n');
    }
  } else {
    console.log('⚠️  .env.local file not created\n');
    console.log('This might mean:');
    console.log('  1. You\'re not logged in to Vercel');
    console.log('  2. The project is not linked');
    console.log('  3. There are no environment variables set\n');
  }
  
} catch (error) {
  console.error('\n❌ Failed to pull environment variables\n');
  console.error('Error:', error.message);
  console.error('\nTry manually:');
  console.error('  1. vercel login');
  console.error('  2. vercel link');
  console.error('  3. vercel env pull .env.local\n');
  process.exit(1);
}
