# Render Deployment Guide

This guide will help you deploy both the backend and frontend to Render.

## Prerequisites

- Render account (free tier works)
- MongoDB Atlas account (or your MongoDB connection string)
- Git repository connected to Render

## Backend Deployment

### 1. Create a New Web Service on Render

1. Go to your Render dashboard
2. Click "New +" → "Web Service"
3. Connect your repository
4. Configure the service:
   - **Name**: `anonymeet-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free (or your preferred plan)

### 2. Set Environment Variables

In the Render dashboard, go to your backend service → Environment tab, and add:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=anonymeet
JWT_SECRET=your_generated_jwt_secret
ALLOWED_ORIGINS=https://your-frontend-url.onrender.com,http://localhost:5173
```

**Important Notes:**
- `PORT` is automatically set by Render, but you can set it explicitly
- `MONGODB_URI`: Your MongoDB Atlas connection string
- `JWT_SECRET`: Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ALLOWED_ORIGINS`: Include your frontend Render URL (you'll get this after deploying frontend)

### 3. Deploy

Click "Create Web Service" and wait for deployment to complete. Note the URL (e.g., `https://anonymeet-backend.onrender.com`)

---

## Frontend Deployment

### 1. Create a New Web Service on Render

1. Go to your Render dashboard
2. Click "New +" → "Web Service"
3. Connect the same repository
4. Configure the service:
   - **Name**: `anonymeet-frontend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or your preferred plan)

### 2. Set Environment Variables

In the Render dashboard, go to your frontend service → Environment tab, and add:

```
NODE_ENV=production
PORT=10000
VITE_BACKEND_URL=https://your-backend-url.onrender.com
```

**Important Notes:**
- `VITE_BACKEND_URL`: Use your backend Render URL (from step 3 above)
- `PORT` is automatically set by Render, but you can set it explicitly

### 3. Update Backend CORS

After getting your frontend URL, go back to your backend service and update the `ALLOWED_ORIGINS` environment variable to include your frontend URL:

```
ALLOWED_ORIGINS=https://your-frontend-url.onrender.com,http://localhost:5173
```

Then redeploy the backend service.

### 4. Deploy

Click "Create Web Service" and wait for deployment to complete.

---

## Troubleshooting

### Backend Issues

1. **MongoDB Connection Error**
   - Verify your `MONGODB_URI` is correct
   - Ensure your MongoDB Atlas IP whitelist includes `0.0.0.0/0` (all IPs) or Render's IPs
   - Check that your MongoDB user has proper permissions

2. **CORS Errors**
   - Ensure `ALLOWED_ORIGINS` includes your frontend URL
   - Make sure there are no trailing slashes in URLs
   - Check that both URLs use the same protocol (https)

3. **Port Issues**
   - Render automatically sets `PORT`, so you don't need to set it manually
   - The backend code already uses `process.env.PORT || 3001`

### Frontend Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Verify Node version (should be >= 18.0.0)
   - Check build logs for specific errors

2. **Connection to Backend Fails**
   - Verify `VITE_BACKEND_URL` is set correctly
   - Ensure the backend URL is accessible (test in browser)
   - Check browser console for CORS errors

3. **Socket.IO Connection Issues**
   - Ensure backend URL in `VITE_BACKEND_URL` matches the actual backend URL
   - Check that backend CORS includes frontend URL
   - Verify Socket.IO is properly configured on backend

### Common Render Issues

1. **Service Goes to Sleep (Free Tier)**
   - Free tier services sleep after 15 minutes of inactivity
   - First request after sleep takes ~30 seconds to wake up
   - Consider upgrading to paid plan for always-on service

2. **Build Timeout**
   - Free tier has build time limits
   - Optimize your build process if it times out
   - Consider using `.renderignore` to exclude unnecessary files

3. **Environment Variables Not Updating**
   - After changing env vars, you may need to manually redeploy
   - Go to Manual Deploy → Deploy latest commit

---

## Quick Checklist

- [ ] Backend deployed and accessible
- [ ] Backend environment variables set correctly
- [ ] Backend health check works (`/health` endpoint)
- [ ] Frontend deployed
- [ ] Frontend `VITE_BACKEND_URL` points to backend
- [ ] Backend `ALLOWED_ORIGINS` includes frontend URL
- [ ] Both services are running (not sleeping)
- [ ] Test full flow: create room, send message, create poll

---

## Using render.yaml (Alternative Method)

If you prefer using the `render.yaml` file:

1. Push `render.yaml` to your repository
2. In Render dashboard, go to "New +" → "Blueprint"
3. Connect your repository
4. Render will automatically detect and use `render.yaml`
5. You'll still need to set environment variables manually in the dashboard

Note: The `render.yaml` file is provided as a template. You may need to adjust service names and URLs based on your actual Render service names.

