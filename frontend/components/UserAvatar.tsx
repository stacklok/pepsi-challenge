import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
      credentials: 'include',
    })
      .then(() => {
        window.location.reload();
      })
      .catch(console.error);
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const response = await fetch('/auth/is_admin', {
        credentials: 'include',
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
      <a
        href="/auth/login"
        className="px-4 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700"
      >
        Login with GitHub
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar>
            <AvatarImage src={user.avatar_url || '/default-avatar.png'} />
            <AvatarFallback>{user.username?.slice(0, 2)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.username}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link className="cursor-pointer" href="/admin">
            Admin Panel
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Button
                className="cursor-pointer w-full justify-start text-red-500 hover:focus:bg-red-500 hover:focus:text-white hover:focus:border-red-600 hover:focus:ring-red-600 "
                onClick={handleLogout}
                variant="link"
                size="sm"
              >
                Logout
              </Button>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
