# 🗣️ Annoymeet: Real-Time Anonymous Interaction Platform

**Annoymeet** is a real-time, web-based application designed to foster open and honest communication in educational and professional settings. It allows participants to join rooms anonymously, ask questions, and engage in discussions without fear of judgment, while providing room organizers with tools to maintain a productive and respectful environment.

## ✨ Live Demo

- **Frontend (Vercel):** [annoymeet.vercel.app](https://annoymeet.vercel.app)  
- **Backend (Render):** [annoymeet.onrender.com](https://annoymeet.onrender.com)

---

## 🎯 Core Features

- 🔐 **Anonymous Participation:** Join rooms with a randomly generated anonymous ID to ensure privacy.
- 💬 **Real-Time Chat:** Engage in instant messaging with all room participants.
- 📊 **Interactive Polls:** Create and participate in live polls to gather instant feedback.
- 😀 **Emoji Reactions:** React to messages to express sentiment without cluttering the chat.
- 🚫 **Profanity Filtering:** Automatically blocks messages containing inappropriate language.
- 🔑 **Secure & Simple Access:** Join rooms with a unique 6-digit code.
- 💾 **Persistent Sessions:** Sessions are stored locally to allow easy reconnection.

---

## 🛠️ Technical Architecture

This project is built using a modern and scalable tech stack:

- **Frontend:** React.js with [Vite](https://vitejs.dev/) for a fast development experience.
- **Backend:** Node.js with Express.js for server-side logic.
- **Real-Time Communication:** Socket.IO for low-latency, bidirectional communication.
- **Database & Auth:** MongoDB (Mongoose ODM) with JWT-based auth.
- **Styling:** Tailwind CSS for responsive and utility-first UI.

---

## 🚀 Getting Started

Follow these steps to run the project locally for development and testing.

### ✅ Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A MongoDB deployment (Atlas cluster or self-hosted)

---

### 📁 1. Clone the Repository

```bash
git clone https://github.com/CodeMaverick-143/Annoymeet.git
cd Annoymeet
```
---

### 🔧 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file and add your MongoDB connection details plus JWT secret:

```env
# backend/.env
PORT=3001
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=anonymeet
JWT_SECRET=super_secret_string
ALLOWED_ORIGINS=http://localhost:5173,https://annoymeet.vercel.app
```

Start the backend server:

```bash
npm start
```

Backend will run at: [http://localhost:3001](http://localhost:3001)

---

### 💻 3. Frontend Setup

Open a new terminal, then navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file and add the backend URL:

```env
# .env.local
VITE_BACKEND_URL=http://localhost:3001
```

Start the frontend development server:

```bash
npm run dev
```

Frontend will be available at: [http://localhost:5173](http://localhost:5173)

---

## 🌟 Future Enhancements

* 🧹 **Enhanced Moderation:** Mute/remove participants.
* 🔼 **Q\&A Prioritization:** Upvote system for popular questions.
* 🎨 **Theming Support:** Customize room UI/UX.
* 📈 **Analytics Dashboard:** Engagement insights for organizers.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE.md) file for details.


