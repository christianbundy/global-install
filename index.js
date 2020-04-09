#!/usr/bin/env node

const os = require("os");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const usage = "Usage: global-install <module>\n";
const moduleName = process.argv[2];

if (moduleName === undefined) {
  console.log(usage);
  throw new Error("Missing <module>");
}

const log = (...args) => {
  console.log("=> global-install:", ...args);
};

const platformIsWindows = os.platform() === "win32";
const eacces = 243;

const profileFilenames = [
  ".zprofile",
  ".profile", // Bash checks this, so .bash_profile would be redundant
];

const npm = (...args) =>
  new Promise((resolve, reject) => {
    const npmExecutable = platformIsWindows ? "npm.exe" : "npm";
    spawn(npmExecutable, args, { stdio: "inherit" }).on("exit", (exitCode) => {
      if (exitCode === 0) {
        resolve();
      } else {
        reject(exitCode);
      }
    });
  });

npm("--global", "install", moduleName)
  .then(process.exit)
  .catch((exitCode) => {
    if (platformIsWindows || exitCode !== eacces) {
      // The workaround only fixes EACCES on Unix.
      process.exit(exitCode);
    }

    console.log();
    log("EACCES error detected; attempting automatic fix...");
    console.log();

    const npmGlobalPath = path.join(os.homedir(), ".npm-global");

    try {
      fs.mkdirSync(npmGlobalPath);
    } catch (e) {
      if (e.code !== "EEXIST") {
        throw e;
      }
    }

    npm("config", "set", "prefix", npmGlobalPath).then(() => {
      const exportPathString = "export PATH=~/.npm-global/bin:$PATH";
      const appendContents = `# added by global-install\n${exportPathString}\n`;

      profileFilenames.forEach((filename) => {
        const fullPath = path.join(os.homedir(), filename);
        fs.appendFileSync(fullPath, appendContents);
      });

      npm("--global", "install", moduleName)
        .then(() => {
          console.log();
          log("Almost done! Please restart your shell or run:");
          log(`    ${exportPathString}`);
        })
        .catch(process.exit);
    });
  });
