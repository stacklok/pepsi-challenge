import { useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';

type UserAvatarProps = {
  user: {
    username: string;
    avatar_url: string;
  } | null;
};

export default function UserAvatar({ user }: UserAvatarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    fetch('http://localhost:5000/auth/logout', {
      credentials: 'include'
    })
    .then(() => {
      window.location.reload();
    })
    .catch(console.error);
  };

  if (!user) {
    return (
      <a href="http://localhost:5000/auth/login" 
         className="px-4 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700">
        Login with GitHub
      </a>
    );
  }

  return (
    <div className="relative group">
      <div className="pt-1 pb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Image
            src={user.avatar_url || '/default-avatar.png'}
            alt={user.username}
            width={40}
            height={40}
            className="rounded-full"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/default-avatar.png';
            }}
          />
        </div>
      </div>
      <div className="absolute right-0 top-[calc(100%-8px)] w-48 bg-gray-800 rounded-lg shadow-xl opacity-0 invisible 
                      group-hover:opacity-100 group-hover:visible transition-all duration-200">
        <div className="px-4 py-2 border-b border-gray-700">
          <p className="text-sm text-gray-300">{user.username}</p>
        </div>
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