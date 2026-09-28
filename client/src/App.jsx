/**
 * App.jsx – thin shell. All routing handled in main.jsx via react-router-dom.
 * Pages live in src/pages/. This file is kept for potential shared layout wrapping.
 */
import React from 'react';
import { Outlet } from 'react-router-dom';

export default function App() {
  return <Outlet />;
}
