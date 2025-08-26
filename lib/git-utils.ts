import simpleGit, { SimpleGit } from 'simple-git';
import { z } from 'zod';

export interface GitRepoInfo {
  url: string;
  name: string;
  owner: string;
  branch: string;
  isPrivate: boolean;
}

export interface CloneOptions {
  gitUrl: string;
  branch?: string;
  accessToken?: string;
  targetDir: string;
}

// Parse Git URL to extract repository information
export function parseGitUrl(gitUrl: string): GitRepoInfo | null {
  try {
    // Handle different Git URL formats
    let cleanUrl = gitUrl;
    
    // Remove .git suffix if present
    if (cleanUrl.endsWith('.git')) {
      cleanUrl = cleanUrl.slice(0, -4);
    }
    
    // Extract from HTTPS URLs
    const httpsMatch = cleanUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\?]+)/);
    if (httpsMatch) {
      const [, owner, name] = httpsMatch;
      return {
        url: gitUrl,
        name,
        owner,
        branch: 'main', // Default, can be overridden
        isPrivate: false, // Will need to be determined elsewhere
      };
    }
    
    // Extract from SSH URLs
    const sshMatch = cleanUrl.match(/git@github\.com:([^\/]+)\/([^\/\?]+)/);
    if (sshMatch) {
      const [, owner, name] = sshMatch;
      return {
        url: gitUrl,
        name,
        owner,
        branch: 'main',
        isPrivate: false,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Git URL:', error);
    return null;
  }
}

// Validate Git URL
export function isValidGitUrl(url: string): boolean {
  const gitUrlSchema = z.string().regex(
    /^(https:\/\/github\.com\/[^\/]+\/[^\/\?]+|git@github\.com:[^\/]+\/[^\/\?]+)(.git)?$/,
    'Must be a valid GitHub repository URL'
  );
  
  try {
    gitUrlSchema.parse(url);
    return true;
  } catch {
    return false;
  }
}

// Generate authenticated Git URL for private repositories
export function createAuthenticatedGitUrl(gitUrl: string, accessToken: string): string {
  try {
    if (gitUrl.startsWith('https://github.com/')) {
      // Convert to authenticated HTTPS URL
      const urlWithoutProtocol = gitUrl.replace('https://', '');
      return `https://${accessToken}@${urlWithoutProtocol}`;
    } else if (gitUrl.startsWith('git@github.com:')) {
      // Convert SSH to authenticated HTTPS
      const repoPath = gitUrl.replace('git@github.com:', '');
      return `https://${accessToken}@github.com/${repoPath}`;
    }
    
    return gitUrl;
  } catch (error) {
    console.error('Error creating authenticated URL:', error);
    return gitUrl;
  }
}

// Get repository default branch
export async function getDefaultBranch(gitUrl: string, accessToken?: string): Promise<string> {
  try {
    const repoInfo = parseGitUrl(gitUrl);
    if (!repoInfo) return 'main';
    
    // Try to fetch the default branch using GitHub API
    if (accessToken) {
      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.default_branch || 'main';
      }
    }
    
    // Fallback to common default branches
    return 'main';
  } catch (error) {
    console.error('Error getting default branch:', error);
    return 'main';
  }
}

// Check if repository exists and is accessible
export async function validateRepository(gitUrl: string, accessToken?: string): Promise<{
  exists: boolean;
  isPrivate: boolean;
  defaultBranch: string;
  error?: string;
}> {
  try {
    const repoInfo = parseGitUrl(gitUrl);
    if (!repoInfo) {
      return { exists: false, isPrivate: false, defaultBranch: 'main', error: 'Invalid Git URL' };
    }
    
    const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}`;
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };
    
    if (accessToken) {
      headers['Authorization'] = `token ${accessToken}`;
    }
    
    const response = await fetch(apiUrl);
    
    if (response.status === 200) {
      const data = await response.json();
      return {
        exists: true,
        isPrivate: data.private || false,
        defaultBranch: data.default_branch || 'main',
      };
    } else if (response.status === 404) {
      return {
        exists: false,
        isPrivate: false,
        defaultBranch: 'main',
        error: 'Repository not found or not accessible',
      };
    } else if (response.status === 403) {
      return {
        exists: true,
        isPrivate: true,
        defaultBranch: 'main',
        error: 'Repository is private and requires authentication',
      };
    } else {
      return {
        exists: false,
        isPrivate: false,
        defaultBranch: 'main',
        error: `GitHub API error: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      exists: false,
      isPrivate: false,
      defaultBranch: 'main',
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Generate project name from Git URL
export function generateProjectName(gitUrl: string): string {
  const repoInfo = parseGitUrl(gitUrl);
  if (repoInfo) {
    return repoInfo.name;
  }
  
  // Fallback: extract from URL
  const urlParts = gitUrl.split('/');
  let name = urlParts[urlParts.length - 1];
  
  if (name.endsWith('.git')) {
    name = name.slice(0, -4);
  }
  
  return name || 'cloned-project';
}

// Get branch list for a repository
export async function getBranches(gitUrl: string, accessToken?: string): Promise<string[]> {
  try {
    const repoInfo = parseGitUrl(gitUrl);
    if (!repoInfo) return ['main'];
    
    const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}/branches`;
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };
    
    if (accessToken) {
      headers['Authorization'] = `token ${accessToken}`;
    }
    
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const branches = await response.json();
      return branches.map((branch: any) => branch.name);
    }
    
    return ['main'];
  } catch (error) {
    console.error('Error getting branches:', error);
    return ['main'];
  }
}