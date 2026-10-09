import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Tải sẵn font phụ đề để dòng sub đầu tiên không bị nháy font
if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "UVN La Xanh"').catch(() => {});
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

