const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found. Run: node setup-env.js');
  process.exit(1);
}

// Read current .env file
let envContent = fs.readFileSync(envPath, 'utf8');

// Fix the MongoDB URI - replace unencoded @ with %40 in the password
// Pattern: mongodb+srv://username:password@host -> mongodb+srv://username:password%40@host
// But we need to be careful - only replace @ in the password part, not the host part

// Check if it has the wrong format
if (envContent.includes('Yogesh@1987@cluster0')) {
  console.log('🔧 Fixing password encoding in .env file...');
  
  // Replace the incorrect format with correct URL encoding
  envContent = envContent.replace(
    /mongodb\+srv:\/\/yogakumar221_db_user:Yogesh@1987@/g,
    'mongodb+srv://yogakumar221_db_user:Yogesh%401987@'
  );
  
  // Write back
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Fixed .env file! The @ in password is now URL-encoded as %40');
  console.log('✅ You can now run: npm start');
} else if (envContent.includes('Yogesh%401987@')) {
  console.log('✅ .env file already has correct encoding!');
} else {
  console.log('⚠️  Could not detect the MongoDB URI pattern. Please check manually.');
  console.log('   Make sure the password @ is encoded as %40');
}





