# Environment Setup Guide

## Backend Configuration

Create a file `backend/.env` with the following content:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/anonymeet
# For MongoDB Atlas, use: mongodb+srv://username:password@cluster.mongodb.net/anonymeet?retryWrites=true&w=majority
MONGODB_DB=anonymeet

# Server Configuration
PORT=3001

# JWT Secret (generate a strong random string for production)
# You can generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Allowed Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,https://annoymeet.vercel.app
```

### MongoDB Setup Options:

1. **Local MongoDB**: 
   - Install MongoDB locally and use: `mongodb://localhost:27017/anonymeet`

2. **MongoDB Atlas (Cloud)**:
   - Sign up at https://www.mongodb.com/cloud/atlas
   - Create a free cluster
   - Get your connection string and replace the MONGODB_URI value
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/anonymeet?retryWrites=true&w=majority`

### Generate JWT Secret:

Run this command to generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Frontend Configuration

Create a file `.env.local` in the root directory with the following content:

```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001
# For production, use: https://annoymeet.onrender.com
```

---

## Quick Setup Commands

### Backend:
```bash
cd backend
# Create .env file (copy the template above)
npm install
npm start
```

### Frontend:
```bash
# Create .env.local file (copy the template above)
npm install
npm run dev
```

---

## Important Notes

- Never commit `.env` or `.env.local` files to git (they're already in .gitignore)
- Replace all placeholder values with your actual configuration
- For production, use strong, randomly generated secrets
- Update `ALLOWED_ORIGINS` to include your production frontend URL





