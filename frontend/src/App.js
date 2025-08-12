import React, { useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import KnifeDetectionApp from "./components/KnifeDetectionApp";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<KnifeDetectionApp />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;