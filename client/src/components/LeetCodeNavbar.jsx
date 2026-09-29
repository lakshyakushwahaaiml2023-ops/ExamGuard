import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';

export default function LeetCodeNavbar({ connected = true, activeCandidates = 200, extraRight = null }) {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { label: 'Sentinel Grid', path: '/admin', icon: '⚡' },
    { label: 'TrustLedger', path: '/ledger', icon: '⛓️' },
    { label: 'Decision Support', path: '/decisions', icon: '⚖️' },
    { label: 'Public Status', path: '/status', icon: '🌐' },
    { label: 'Candidate Exam', path: '/exam?candidate=cand-1', icon: '🖥️' }
  ];

  return (
    <header className="h-[50px] border-b select-none flex items-center justify-between px-4 sticky top-0 z-50 transition-colors duration-150
      dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200">
      
      {/* ── Left: LeetCode Logo & Navigation ───────────────────────────────── */}
      <div className="flex items-center gap-5">
        {/* LeetCode styled Logo */}
        <Link to="/admin" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-md bg-[#ffa116] flex items-center justify-center shadow-sm">
            {/* LeetCode bracket SVG icon */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white font-black" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 4.818 3.551 5.86 5.86 0 0 0 3.322-.454 5.753 5.753 0 0 0 1.259-.838l4.475-4.489a1.38 1.38 0 0 0 0-1.952 1.38 1.38 0 0 0-1.953 0l-4.476 4.49a3.14 3.14 0 0 1-1.895.733 3.14 3.14 0 0 1-2.073-.787 3.2 3.2 0 0 1-1.077-1.782 3.24 3.24 0 0 1 .425-2.585l3.854-4.127 5.405-5.787A1.38 1.38 0 0 0 13.483 0z"/>
              <path d="M19.167 12.35H9.68a1.38 1.38 0 1 0 0 2.76h9.487a1.38 1.38 0 1 0 0-2.76z" fill="#282828"/>
            </svg>
          </div>
          <span className="font-semibold text-[15px] tracking-tight dark:text-white text-gray-900 group-hover:text-[#ffa116] transition">
            ExamGuard
          </span>
        </Link>

        <div className="h-4 w-[1px] dark:bg-[#404040] bg-gray-200 hidden sm:block" />

        {/* LeetCode styled Nav Links */}
        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          {navItems.map(item => {
            const isActive = location.pathname === item.path.split('?')[0];
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                  isActive
                    ? 'dark:text-[#ffa116] dark:bg-[#333333] text-[#ffa116] bg-amber-50 font-semibold shadow-xs'
                    : 'dark:text-gray-300 dark:hover:text-white dark:hover:bg-[#333333] text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="text-xs">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Right: Indicators, Theme Toggle & Controls ──────────────────────── */}
      <div className="flex items-center gap-2.5">
        {extraRight}

        {/* Live Sentinel Connection Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border
          dark:bg-[#1e1e1e] dark:border-[#383838] dark:text-gray-300 bg-gray-50 border-gray-200 text-gray-700">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#00b8a3] animate-pulse' : 'bg-[#ff375f]'}`} />
          <span>{connected ? 'Live Sync' : 'Offline'}</span>
        </div>

        {/* Active Candidates Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border
          dark:bg-[#1e1e1e] dark:border-[#383838] dark:text-gray-300 bg-gray-50 border-gray-200 text-gray-700">
          <span className="text-[#ffa116]">🔥</span>
          <span><strong className="dark:text-white text-gray-900">{activeCandidates}</strong> Active</span>
        </div>

        {/* Dark / Light Mode Toggle Button (LeetCode exact styling) */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
          title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
          className="p-1.5 rounded-md transition border flex items-center justify-center
            dark:bg-[#333333] dark:border-[#404040] dark:text-amber-400 dark:hover:bg-[#3e3e3e]
            bg-gray-100 border-gray-300 text-slate-700 hover:bg-gray-200"
        >
          {isDark ? (
            /* Sun Icon */
            <svg className="w-4 h-4 fill-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            /* Moon Icon */
            <svg className="w-4 h-4 fill-slate-700" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>

        {/* User avatar circle */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#ffa116] to-amber-300 flex items-center justify-center text-xs font-bold text-white shadow-xs">
          EG
        </div>
      </div>
    </header>
  );
}
