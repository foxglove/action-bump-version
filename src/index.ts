import core from "@actions/core";
import { exec, ExecOptions } from "@actions/exec";
import { promises as fs } from "fs";
import path from "path";
import semver from "semver";

type PackageJson = {
  version?: string;
};

class PrettyError extends Error {}

async function main(): Promise<void> {
  const version = sanitizeVersion(core.getInput("version", { required: true }));
  core.setOutput("version", version);

  const gitStatus = await execOutput("git", ["status", "--porcelain"]);
  if (gitStatus !== "") {
    throw new PrettyError(
      `Git status is not clean. Please commit or stash your changes first.\n\n${gitStatus}`,
    );
  }

  // create branch if requested
  if (core.getBooleanInput("branch")) {
    const branchName = core.getInput("branch-name") || `release/v${version}`;
    await exec("git", ["checkout", "-B", branchName]);
    core.setOutput("branch-name", branchName);
  }

  // update package version
  const updatedFiles = await recursiveUpdatePackageVersion(".", version);
  core.setOutput("updated-files", updatedFiles);
  await exec("git", ["add", ...updatedFiles]);

  // commit changes
  const commitMessage = core.getInput("commit-message") || `Release v${version}`;
  await exec("git", ["commit", "--message", commitMessage]);

  // push to origin if requested
  if (core.getBooleanInput("push")) {
    await exec("git", ["push", "--set-upstream", "origin", "HEAD"]);
  }
}

export async function execOutput(
  program: string,
  args?: string[],
  options?: ExecOptions,
): Promise<string> {
  let output = "";

  await exec(program, args, {
    ...options,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
      stderr: (data: Buffer) => {
        output += data.toString();
      },
    },
  });

  return output;
}

function sanitizeVersion(version: string): string {
  const result = semver.clean(version);

  if (!result) {
    throw new PrettyError(`Invalid version: ${version}`);
  }

  return result;
}

async function recursiveUpdatePackageVersion(dir: string, version: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  const updatedFiles = new Array<string>();

  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (file.startsWith(".") || file === "node_modules") {
      // don't recurse into hidden directories or node_modules
    } else if ((await fs.stat(fullPath)).isDirectory()) {
      // recurse into directory
      const moreUpdatedFiles = await recursiveUpdatePackageVersion(fullPath, version);
      updatedFiles.push(...moreUpdatedFiles);
    } else if (file === "package.json") {
      const pkg = JSON.parse(await fs.readFile(fullPath, "utf8")) as PackageJson;

      // if this package.json has a version field, update it
      if (pkg.version) {
        pkg.version = version;
        await fs.writeFile(fullPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
        updatedFiles.push(fullPath);
        core.info(`Updated ${fullPath} to v${version}`);
      }
    }
  }

  return updatedFiles;
}

if (require.main === module) {
  main().catch((e) => {
    if (e instanceof PrettyError) {
      // no stack trace for expected errors
      core.setFailed(e.message);
    } else {
      // unexpected error
      core.setFailed(e);
    }
    process.exit(1);
  });
}
