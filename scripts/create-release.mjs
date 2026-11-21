#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

// 1. Read package.json for version and metadata
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"))
const version = pkg.version
const tagName = `v${version}`

// 2. Read CHANGELOG.md for release notes
let changelogNotes = ""
try {
  const changelog = fs.readFileSync(path.join(rootDir, "CHANGELOG.md"), "utf-8")
  const regex = new RegExp(`## \\[${version}\\][^\n]*\n([\\s\\S]*?)(?=\n## \\[|$)`)
  const match = changelog.match(regex)
  if (match && match[1]) {
    changelogNotes = match[1].replace(/---\s*$/, "").trim()
  }
} catch {}

if (!changelogNotes) {
  changelogNotes = `Release ${tagName} of ${pkg.name}.`
}

// 3. Extract GitHub token from git credential manager
const res = spawnSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf-8",
})

let token = ""
for (const line of (res.stdout || "").split("\n")) {
  if (line.startsWith("password=")) {
    token = line.slice(9).trim()
    break
  }
}

if (!token && process.env.GITHUB_TOKEN) {
  token = process.env.GITHUB_TOKEN
}

if (!token) {
  console.error("Error: Could not retrieve GitHub token from git credentials or GITHUB_TOKEN env.")
  process.exit(1)
}

const repoOwner = "mdsohail99"
const repoName = "opencode-agent-teams"

const releaseBody = `# ⚡ OpenCode Agent-Teams (${tagName})

Native multi-agent hierarchical swarms, 2-tier subagent depth, and automated Git worktree sandboxing for OpenCode v2 (\`@opencode/cli@2.3.2\`).

NPM Package: [\`${pkg.name}\`](https://www.npmjs.com/package/${pkg.name})

---

## 🚀 Changes in ${tagName}

${changelogNotes}

---

## ⚡ Quickstart

Install globally for OpenCode v2:
\`\`\`bash
npx ${pkg.name}
\`\`\`
`

async function run() {
  console.log(`Publishing GitHub Release for ${tagName}...`)

  // Check if release already exists
  const checkRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases/tags/${tagName}`, {
    headers: {
      Authorization: `token ${token}`,
      "User-Agent": "release-script",
    },
  })

  let method = "POST"
  let endpoint = `https://api.github.com/repos/${repoOwner}/${repoName}/releases`

  if (checkRes.ok) {
    const existing = await checkRes.json()
    console.log(`Release ${tagName} already exists (ID: ${existing.id}). Updating...`)
    method = "PATCH"
    endpoint = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/${existing.id}`
  }

  const payload = {
    tag_name: tagName,
    target_commitish: "main",
    name: `${tagName} — OpenCode v2.3.2 Engine Alignment, 2-Tier Swarms & Instant CLI Installer`,
    body: releaseBody,
    draft: false,
    prerelease: false,
  }

  const r = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "release-script",
    },
    body: JSON.stringify(payload),
  })

  const data = await r.json()
  if (r.ok) {
    console.log(`✓ GitHub Release ${method === "POST" ? "created" : "updated"} successfully:`, data.html_url)
  } else {
    console.error("Failed to publish release:", data)
    process.exit(1)
  }

  // Update repository About section
  console.log("Updating repository About section...")
  const patchRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
    method: "PATCH",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "release-script",
    },
    body: JSON.stringify({
      description: "Native Agent-Teams orchestration plugin for OpenCode v2 — multi-agent hierarchical swarms & Git worktree sandboxing",
      homepage: `https://www.npmjs.com/package/${pkg.name}`,
    }),
  })

  if (patchRes.ok) {
    console.log("✓ Repository description and homepage updated successfully.")
  }
}

run().catch((err) => {
  console.error("Release error:", err)
  process.exit(1)
})
