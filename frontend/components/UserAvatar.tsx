import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

type UserAvatarProps = {
  user: {
    username: string;
    avatar_url: string;
  };
};

export default function UserAvatar({ user }: UserAvatarProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  const handleLogout = () => {
    fetch('/auth/logout', {
      credentials: 'include'
    })
    .then(() => {
      window.location.reload();
    })
    .catch(console.error);
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const response = await fetch('/auth/is_admin', {
        credentials: 'include'
      });
      const data = await response.json();
      setIsAdmin(data.is_admin);
    };
    if (user) {
      checkAdmin();
    }
  }, [user]);

  if (!user) {
    return (
      <a href="/auth/login" 
         className="px-4 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700">
        Login with GitHub
      </a>
    );
  }

  return (
    <div className="relative group">
      <div className="pt-1 pb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Avatar>
            <AvatarImage src={user.avatar_url || '/default-avatar.png'} />
            <AvatarFallback>{user.username}</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div className="absolute right-0 top-[calc(100%-8px)] w-48 bg-gray-800 rounded-lg shadow-xl opacity-0 invisible 
                      group-hover:opacity-100 group-hover:visible transition-all duration-200">
        <div className="px-4 py-2 border-b border-gray-700">
          <p className="text-sm text-gray-300">{user.username}</p>
        </div>
        {isAdmin && (
          <Link href="/admin" className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
            Admin Panel
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
} 