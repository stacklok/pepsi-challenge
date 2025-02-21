'use client';

import { useState } from 'react';

export default function SnippetLibrary() {
  const [snippets, setSnippets] = useState([
    { category: 'API Routes', prefix: 'Write a FastAPI route that...' },
    { category: 'Database', prefix: 'Create a SQL query to...' },
    // Add more predefined snippets
  ]);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Render snippet cards */}
    </div>
  );
} 