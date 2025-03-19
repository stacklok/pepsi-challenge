import { ThemeToggle } from "./ThemeToggle";
import UserAvatar from "./UserAvatar"

type HeaderProps = {
  user: {
    username: string;
    avatar_url: string;
  };
};

export const Header = ({ user }: HeaderProps) => {
  return (
    <header className="border-b">
      <div className="max-w-7xl mx-auto py-6 px-4 flex justify-between items-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          🥤 LLM Pepsi Challenge
        </h1>
        <div className="flex h-full content-center items-center flex-wrap gap-2">
          <ThemeToggle />
          <UserAvatar user={user} />
        </div>
      </div>
    </header>
  )
}