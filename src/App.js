import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Upload from './components/Upload';
import Background from './components/Background';
import Download from './components/Download';
import Ghostlink from './components/Ghostlink';
import Room from './components/Room';

function App() {
  return (
    <Router>
    <Header/>
    <Routes>
      <>
      <Route path="/" element={<Background/>}/>
      <Route path="/Upload" element={<Upload/>}/>
      <Route path="/Download" element={<Download/>}/>
      <Route path="/Ghostlink" element={<Ghostlink/>}/>
      <Route path="/Room" element={<Room/>}/>
      </>
    </Routes>
    </Router>
  );
}

export default App;
