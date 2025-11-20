const fs = require('fs');
const crypto = require('crypto');

// Generate a secure JWT secret
const jwtSecret = crypto.randomBytes(32).toString('hex');

const envContent = `# MongoDB Configuration
MONGODB_URI=mongodb+srv://yogakumar221_db_user:Yogesh%401987@cluster0.fqqovex.mongodb.net/anonymeet?retryWrites=true&w=majority
MONGODB_DB=anonymeet

# Server Configuration
PORT=3001

# JWT Secret (auto-generated)
JWT_SECRET=${jwtSecret}

# Allowed Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,https://annoymeet.vercel.app
`;

fs.writeFileSync('.env', envContent);
console.log('✅ Created backend/.env file with your MongoDB connection!');
console.log('✅ Generated secure JWT secret automatically');
console.log('\n⚠️  Note: If you have connection issues, you may need to URL-encode the @ in your password');
console.log('   Current password: Yogesh@1987');
console.log('   URL-encoded: Yogesh%401987');

