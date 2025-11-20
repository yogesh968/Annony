#!/bin/bash

# Generate JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Create .env file
cat > .env << EOF
# MongoDB Configuration
MONGODB_URI=mongodb+srv://yogakumar221_db_user:Yogesh%401987@cluster0.fqqovex.mongodb.net/anonymeet?retryWrites=true&w=majority
MONGODB_DB=anonymeet

# Server Configuration
PORT=3001

# JWT Secret (auto-generated)
JWT_SECRET=${JWT_SECRET}

# Allowed Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,https://annoymeet.vercel.app
EOF

echo "✅ Created backend/.env file with your MongoDB connection!"
echo "✅ Auto-generated secure JWT secret"
echo ""
echo "⚠️  Note: Password @ has been URL-encoded as %40"



