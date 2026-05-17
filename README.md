# Smart Study Planner

Smart study planner is a we app that helps students organize they study schedule. it allows students to add their courses and tasks and generates a study plan according to the tasks with the highest priorities and shorter due dates. the app also has reminders to remind the students of their upcoming study sessions and progress tracking.

## Tech Stack
- React 18 + Vite
- React Router v6 
- Tailwind CSS + External CSS 
- Firebase Auth + Firestore + Hosting 
- Groq API (Llama 3.3 70B) 
- Lucide React 
- JavaScript (ES6+) 
- Git & GitHub 

## Project Structure
smart-study-planner/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── Chatbot.jsx
│   │   ├── CourseManagement.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Layout.jsx
│   │   ├── NotificationBell.jsx
│   │   ├── SignIn.jsx
│   │   ├── CreateAccount.jsx
│   │   ├── StudySchedule.jsx
│   │   ├── TasksDeadlines.jsx
│   │   ├── TrackCompletion.jsx
│   │   └── welcomepage.jsx
│   ├── .env
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .firebaserc
├── firebase.json
└── README.md

## Prerequisites
- Node.js v18+
- npm

## Getting Started
1. Extract the source code folder
2. cd smart-study-planner/frontend
3. npm install
4. Create a .env file (see Environment Variables below)
5. npm run dev → http://localhost:5173

## Environment Variables
Create a `.env` file inside the `frontend/` folder:

VITE_GROQ_API_KEY=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

## Features
- Sign up / sign in with email verification
- Add and manage courses from a dedicated courses page
- Add tasks linked to a course with priorities and deadlines from a dedicated tasks page
- Set weekly availability and generate a personalized study plan
- Mark sessions as missed → automatically rescheduled
- Mark sessions as completed → statistics update
- Deadline and study session reminders
- Progress page with completion tracking, study streaks, and tips
- AI Study Advisor chatbot powered by Groq (Llama 3.3 70B)