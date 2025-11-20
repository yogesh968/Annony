# Backend .env File Setup

## Important: Password URL Encoding

Your MongoDB password contains `@` which needs to be URL-encoded as `%40` in the connection string.

**Your password:** `*`  
**URL-encoded:** `

## Create backend/.env file with this content:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://yogakumar221_db_user:Yogesh%401987@cluster0.fqqovex.mongodb.net/anonymeet?retryWrites=true&w=majority
MONGODB_DB=anonymeet

# Server Configuration
PORT=3001

# JWT Secret (auto-generated - run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=REPLACE_WITH_GENERATED_SECRET

# Allowed Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,https://annoymeet.vercel.app
```

## Quick Setup:

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create the .env file (copy the content above)

3. Generate JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and replace `REPLACE_WITH_GENERATED_SECRET` in the .env file

4. Test the connection:
   ```bash
   npm start
   ```

## Alternative: If URL encoding doesn't work

If you still have connection issues, try creating a new MongoDB user with a password that doesn't contain special characters, or use the MongoDB Atlas connection string builder which handles encoding automatically.





