import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Upload from './components/Upload';
import Background from './components/Background';
import Download from './components/Download';

function App() {
  return (
    <Router>
    <Header/>
    <Routes>
      <>
      <Route path="/" element={<Background/>}/>
      <Route path="/Upload" element={<Upload/>}/>
      <Route path="/Download" element={<Download/>}/>
      </>
    </Routes>
    </Router>
  );
}

export default App;
