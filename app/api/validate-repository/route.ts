import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { 
  validateRepository, 
  parseGitUrl, 
  isValidGitUrl,
  getBranches,
  generateProjectName 
} from '@/lib/git-utils';

const validateSchema = z.object({
  gitUrl: z.string().min(1, 'Git URL is required'),
  accessToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { gitUrl, accessToken } = validateSchema.parse(body);

    // Basic URL validation
    if (!isValidGitUrl(gitUrl)) {
      return NextResponse.json(
        { 
          error: 'Invalid Git URL format. Please provide a valid GitHub repository URL.',
          valid: false 
        },
        { status: 400 }
      );
    }

    // Parse repository information
    const repoInfo = parseGitUrl(gitUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { 
          error: 'Could not parse repository information from URL',
          valid: false 
        },
        { status: 400 }
      );
    }

    // Validate repository exists and get details
    const validation = await validateRepository(gitUrl, accessToken);
    
    if (!validation.exists) {
      return NextResponse.json(
        {
          error: validation.error || 'Repository not found or not accessible',
          valid: false,
          requiresAuth: validation.error?.includes('private')
        },
        { status: 404 }
      );
    }

    // Get available branches
    let branches: string[] = [validation.defaultBranch];
    try {
      branches = await getBranches(gitUrl, accessToken);
    } catch (error) {
      console.log('Could not fetch branches, using default');
    }

    // Generate suggested project name
    const suggestedName = generateProjectName(gitUrl);

    const response = {
      valid: true,
      repository: {
        url: gitUrl,
        name: repoInfo.name,
        owner: repoInfo.owner,
        isPrivate: validation.isPrivate,
        defaultBranch: validation.defaultBranch,
        branches,
      },
      suggestedProjectName: suggestedName,
      requiresAuth: validation.isPrivate && !accessToken,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Repository validation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: error.errors,
          valid: false 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to validate repository',
        valid: false 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check repository without authentication
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gitUrl = searchParams.get('url');

    if (!gitUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required', valid: false },
        { status: 400 }
      );
    }

    if (!isValidGitUrl(gitUrl)) {
      return NextResponse.json(
        { 
          error: 'Invalid Git URL format', 
          valid: false 
        },
        { status: 400 }
      );
    }

    const repoInfo = parseGitUrl(gitUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { 
          error: 'Could not parse repository information', 
          valid: false 
        },
        { status: 400 }
      );
    }

    // Basic validation without authentication
    const validation = await validateRepository(gitUrl);

    const response = {
      valid: validation.exists,
      repository: validation.exists ? {
        name: repoInfo.name,
        owner: repoInfo.owner,
        isPrivate: validation.isPrivate,
        defaultBranch: validation.defaultBranch,
      } : null,
      requiresAuth: validation.isPrivate,
      error: validation.error,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Repository check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check repository', 
        valid: false 
      },
      { status: 500 }
    );
  }
}