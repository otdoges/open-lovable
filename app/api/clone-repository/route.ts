import { NextRequest, NextResponse } from 'next/server';
import simpleGit from 'simple-git';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import path from 'path';
import fs from 'fs/promises';
import { E2BCodeInterpreter } from '@e2b/code-interpreter';

// Validation schema
const cloneSchema = z.object({
  gitUrl: z.string().url(),
  branch: z.string().optional().default('main'),
  projectName: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  isPrivate: z.boolean().optional().default(false),
  accessToken: z.string().optional(), // For private repos
  sandboxId: z.string().optional(), // If cloning to existing sandbox
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
    const validatedData = cloneSchema.parse(body);

    const {
      gitUrl,
      branch,
      projectName,
      description,
      isPrivate,
      accessToken,
      sandboxId
    } = validatedData;

    // Create or use existing sandbox
    let targetSandboxId = sandboxId;
    let sandbox: E2BCodeInterpreter | null = null;

    if (targetSandboxId) {
      // Connect to existing sandbox
      sandbox = await E2BCodeInterpreter.create({
        id: targetSandboxId,
        timeoutMs: 900_000, // 15 minutes
      });
    } else {
      // Create new sandbox
      sandbox = await E2BCodeInterpreter.create({
        timeoutMs: 900_000, // 15 minutes
      });
      targetSandboxId = sandbox.id;
    }

    if (!sandbox) {
      return NextResponse.json(
        { error: 'Failed to create or connect to sandbox' },
        { status: 500 }
      );
    }

    try {
      // Prepare git URL with authentication if needed
      let authGitUrl = gitUrl;
      if (isPrivate && accessToken) {
        const urlParts = gitUrl.replace('https://', '').split('/');
        const [host, ...pathParts] = urlParts;
        authGitUrl = `https://${accessToken}@${host}/${pathParts.join('/')}`;
      }

      // Clone repository in sandbox
      const cloneCommand = `git clone ${isPrivate ? '-q' : ''} -b ${branch} "${authGitUrl}" "${projectName}"`;
      
      console.log(`Cloning repository: ${gitUrl} (branch: ${branch})`);
      
      const cloneResult = await sandbox.codeInterpreter.runCode(`
import subprocess
import os

try:
    # Change to home directory
    os.chdir("/home/user")
    
    # Run git clone
    result = subprocess.run(
        ["${cloneCommand}"],
        shell=True,
        capture_output=True,
        text=True,
        timeout=300  # 5 minutes timeout
    )
    
    if result.returncode == 0:
        # List contents of cloned directory
        if os.path.exists("${projectName}"):
            files = os.listdir("${projectName}")
            print(f"✅ Repository cloned successfully!")
            print(f"📁 Project directory: {projectName}")
            print(f"📝 Files: {', '.join(files[:10])}")
            if len(files) > 10:
                print(f"... and {len(files) - 10} more files")
        else:
            print("⚠️ Clone seemed successful but directory not found")
    else:
        print(f"❌ Git clone failed:")
        print(f"Error: {result.stderr}")
        
    print(f"Exit code: {result.returncode}")
    
except subprocess.TimeoutExpired:
    print("❌ Clone operation timed out")
except Exception as e:
    print(f"❌ Error during clone: {str(e)}")
`);

      // Check if clone was successful
      const checkResult = await sandbox.codeInterpreter.runCode(`
import os
import json

project_path = "/home/user/${projectName}"
if os.path.exists(project_path):
    # Get basic project info
    files = []
    for root, dirs, filenames in os.walk(project_path):
        # Skip .git directory
        if '.git' in dirs:
            dirs.remove('.git')
        for filename in filenames:
            rel_path = os.path.relpath(os.path.join(root, filename), project_path)
            files.append(rel_path)
        # Limit to first 100 files
        if len(files) >= 100:
            break
    
    # Check for common project files
    has_package_json = os.path.exists(os.path.join(project_path, "package.json"))
    has_requirements = os.path.exists(os.path.join(project_path, "requirements.txt"))
    has_dockerfile = os.path.exists(os.path.join(project_path, "Dockerfile"))
    has_readme = any(f.lower().startswith("readme") for f in os.listdir(project_path) if os.path.isfile(os.path.join(project_path, f)))
    
    result = {
        "success": True,
        "projectPath": project_path,
        "fileCount": len(files),
        "files": files[:50],  # First 50 files
        "hasPackageJson": has_package_json,
        "hasRequirements": has_requirements,
        "hasDockerfile": has_dockerfile,
        "hasReadme": has_readme
    }
    
    print(json.dumps(result))
else:
    result = {"success": False, "error": "Project directory not found"}
    print(json.dumps(result))
`);

      let projectInfo;
      try {
        const output = checkResult.results[0]?.text || '{"success": false}';
        const lines = output.trim().split('\n');
        const jsonLine = lines[lines.length - 1];
        projectInfo = JSON.parse(jsonLine);
      } catch (e) {
        projectInfo = { success: false, error: "Failed to parse project info" };
      }

      if (!projectInfo.success) {
        await sandbox.close();
        return NextResponse.json(
          { error: projectInfo.error || 'Failed to clone repository' },
          { status: 400 }
        );
      }

      // If it's a Node.js project, install dependencies
      if (projectInfo.hasPackageJson) {
        console.log('Installing Node.js dependencies...');
        await sandbox.codeInterpreter.runCode(`
import subprocess
import os

os.chdir("/home/user/${projectName}")

try:
    # Install dependencies
    result = subprocess.run(
        ["npm", "install"],
        capture_output=True,
        text=True,
        timeout=300  # 5 minutes timeout
    )
    
    if result.returncode == 0:
        print("✅ Dependencies installed successfully!")
    else:
        print(f"⚠️ Warning: npm install failed: {result.stderr}")
        
except subprocess.TimeoutExpired:
    print("⚠️ npm install timed out")
except Exception as e:
    print(f"⚠️ Error installing dependencies: {str(e)}")
`);
      }

      // Start development server if possible
      const serverUrl = await startDevServer(sandbox, projectName, projectInfo);

      const response = {
        success: true,
        sandboxId: targetSandboxId,
        projectName,
        projectInfo,
        serverUrl,
        message: `Repository '${gitUrl}' cloned successfully!`,
      };

      return NextResponse.json(response);

    } catch (error) {
      console.error('Clone operation failed:', error);
      await sandbox.close();
      
      return NextResponse.json(
        { error: `Clone operation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Clone repository API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to start development server
async function startDevServer(
  sandbox: E2BCodeInterpreter,
  projectName: string,
  projectInfo: any
): Promise<string | null> {
  try {
    if (projectInfo.hasPackageJson) {
      // Try to start a dev server
      const startResult = await sandbox.codeInterpreter.runCode(`
import subprocess
import os
import json
import time

os.chdir("/home/user/${projectName}")

# Read package.json to find dev script
try:
    with open("package.json", "r") as f:
        package_data = json.load(f)
    
    scripts = package_data.get("scripts", {})
    
    # Find appropriate dev command
    dev_command = None
    if "dev" in scripts:
        dev_command = "npm run dev"
    elif "start" in scripts:
        dev_command = "npm start"
    elif "serve" in scripts:
        dev_command = "npm run serve"
    
    if dev_command:
        print(f"Starting server with: {dev_command}")
        # Start server in background
        process = subprocess.Popen(
            dev_command.split(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait a bit for server to start
        time.sleep(3)
        
        # Check if process is still running
        if process.poll() is None:
            print("✅ Development server started!")
            print(f"🔗 Server should be available on port 3000 or 5173")
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Server failed to start: {stderr}")
    else:
        print("ℹ️ No dev script found in package.json")
        
except Exception as e:
    print(f"❌ Error starting server: {str(e)}")
`);

      // Return the likely server URL
      return `https://${sandbox.getHostname(3000)}` || `https://${sandbox.getHostname(5173)}`;
    }
  } catch (error) {
    console.log('Could not start dev server:', error);
  }
  
  return null;
}