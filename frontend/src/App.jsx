import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React from 'react';

import Layout from './Layout';
import WelcomePage from './welcomepage';
import CreateAccount from './CreateAccount';
import SignIn from './SignIn';
import Dashboard from './Dashboard';
import CourseManagement from './CourseManagement';
import TrackCompletion from './TrackCompletion';
//import WeeklyAvailability from './WeeklyAvailability';
import StudyPlan from './StudyPlan';
import StudySchedule from './StudySchedule';      
import TasksDeadlines from './TasksDeadlines';  

function App() {
  return (
    <Router>
      <Routes>
      
        <Route path="/" element={<WelcomePage />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/signin" element={<SignIn />} />

     
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />

        <Route
          path="/courses"
          element={
            <Layout>
              <CourseManagement />
            </Layout>
          }
        />

        <Route
          path="/track"
          element={
            <Layout>
              <TrackCompletion />
            </Layout>
          }
        />
      
       

        <Route
          path="/study-plan"
          element={
            <Layout>
              <StudyPlan />
            </Layout>
          }
        />

        <Route 
          path="/schedule" 
          element={
            <Layout>
              <StudySchedule />
            </Layout>
          } 
        />

        <Route 
          path="/tasks"
          element={
            <Layout>
              <TasksDeadlines />
            </Layout>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;