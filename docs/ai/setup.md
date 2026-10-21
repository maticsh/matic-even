Goal:
Set up this computer to build Even Realities G2 apps with matic even. That means Node.js 24 or newer, the matic even repo with its checks passing, and the matic-even plugin for your AI. Then show the demo app in Even's simulator.

Check first:
Run `node --version` and `git --version`.

If Node.js is already installed and the major version is 24 or higher:
Do not install or change Node.js. Continue to "Get the repo".

If Node.js is missing or older than v24:
Install an official Node.js release with major version 24 or higher.

Install policy:
Use a package manager only if it is already installed.
Do not install Homebrew, winget, Chocolatey, Scoop, nvm, fnm, or another package manager just for this task.

Install options:
macOS:
- If Homebrew is already installed, use it to install Node.js.
- Otherwise use the official Node.js `.pkg` installer.

Windows:
- If winget is already installed, use it to install Node.js.
- Otherwise use the official Node.js `.msi` installer.

Linux:
- If the system package manager can install Node.js v24 or newer, use it.
- For Debian/Ubuntu or RHEL/Fedora-compatible systems, use the official NodeSource instructions for Node.js 24 or newer.
- Otherwise use the official Node.js standalone Linux binary for the detected architecture.

Official downloads:
https://nodejs.org/download/release/latest/

Verify:
Run `node --version` again. Only continue if the major version is 24 or higher.

Get the repo:
If the current folder is already a clone of https://github.com/maticsh/matic-even, use it.
Otherwise run:
git clone https://github.com/maticsh/matic-even matic-even
cd matic-even

Install and check:
Run `npm ci`, then `npm run check`.
Only continue if both succeed. If one fails, show the user the first error and stop.

Add the plugin:
If you are Claude Code, run:
claude plugin marketplace add maticsh/matic-even
claude plugin install matic-even@matic-even
If you are another AI tool, read `skills/skills/even-g2/SKILL.md` and `skills/skills/even-g2-preflight/SKILL.md` in the repo, and use them as your instructions for G2 work.

Show the demo:
Start the demo's dev server in the background: `npm run dev --workspace checklist`. It serves on port 5210.
Then start Even's simulator: `npm run sim --workspace checklist`.
On Linux with no display, run the simulator under `xvfb-run -a`.
The simulator shows the demo's glasses screen. The demo's phone page is at http://localhost:5210.

Success message:
If every step succeeded, tell the user they are set up, and what they can do next:

See the demo on your own glasses:
- Sign in at https://hub.evenrealities.com with the same account as the Even Realities app on your phone. Then force-quit the app and open it again. A "Scan QR" button appears in the Even Hub tab.
- With the dev server running, run `npm run qr --workspace checklist`, and scan the code from the Even Hub tab. Your phone must be able to reach this computer on the network.

Start your own app:
- Ask: "Build a G2 app that <what it does>, starting from apps/checklist."
