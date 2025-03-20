import type { User } from '@/types/user';
import { useState, useEffect } from 'react';

export const useUser = () => {
  const [user, setUser] = useState<User>(null);

  // Only check user status once when component mounts
  useEffect(() => {
    fetch('/auth/user', {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.username) {
          setUser(data);
        }
      })
      .catch(console.error);
  }, []);

  return user;
};
