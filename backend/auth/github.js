const allowedUsers = process.env.ALLOWED_USERS.split(',').map(user => user.trim());

async function handleGithubLogin(githubUser) {
  // Assuming githubUser.login contains the GitHub username
  if (!allowedUsers.includes(githubUser.login)) {
    throw new Error('Sorry, limited access only');
  }
  
  // Continue with your existing login logic
  return githubUser;
} 