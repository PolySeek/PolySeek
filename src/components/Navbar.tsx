import Link from 'next/link';
import { GithubLogo, Book, XLogo } from '@phosphor-icons/react';

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full bg-black/50 backdrop-blur-sm z-50">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <Link 
            href="/" 
            className="flex items-center"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/';
            }}
          >
            <img
              src="/longlogo.svg"
              alt="PolySeek Logo"
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {/* Navigation Links - Always visible on mobile, but as icons only */}
        <div className="flex items-center space-x-2 md:space-x-4">
          <Link 
            href="https://x.com/polyseekcloud" 
            className="group relative flex items-center h-10 px-2 hover:px-4 rounded-lg transition-all duration-200 overflow-hidden hover:bg-white/5"
            target="_blank"
          >
            <XLogo size={24} weight="bold" className="text-gray-300 group-hover:text-white transition-colors" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap md:group-hover:max-w-[100px] md:group-hover:ml-2 transition-all duration-200 text-gray-300 group-hover:text-white hidden md:inline">
              Twitter
            </span>
          </Link>
          <Link 
            href="https://github.com/PolySeek/polyseek" 
            className="group relative flex items-center h-10 px-2 hover:px-4 rounded-lg transition-all duration-200 overflow-hidden hover:bg-white/5"
            target="_blank"
          >
            <GithubLogo size={24} weight="bold" className="text-gray-300 group-hover:text-white transition-colors" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap md:group-hover:max-w-[100px] md:group-hover:ml-2 transition-all duration-200 text-gray-300 group-hover:text-white hidden md:inline">
              GitHub
            </span>
          </Link>
          <Link 
            href="https://docs.polyseek.cloud" 
            className="group relative flex items-center h-10 px-2 hover:px-4 rounded-lg transition-all duration-200 overflow-hidden hover:bg-white/5"
            target="_blank"
          >
            <Book size={24} weight="bold" className="text-gray-300 group-hover:text-white transition-colors" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap md:group-hover:max-w-[150px] md:group-hover:ml-2 transition-all duration-200 text-gray-300 group-hover:text-white hidden md:inline">
              Documentation
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
} 