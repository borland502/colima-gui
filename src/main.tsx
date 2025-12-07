import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import colimaIcon from './assets/colima-icon.svg';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find the root element');
}

ReactDOM.render(
  <React.StrictMode>
    <App iconPath={colimaIcon} />
  </React.StrictMode>,
  container,
);