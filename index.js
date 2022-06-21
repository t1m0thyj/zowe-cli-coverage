const fs = require("fs");
const path = require("path");
const exec = require("@actions/exec");
const gitClone = require("git-clone/promise");
const jsYaml = require("js-yaml");
const padLeft = require("pad-left");
const parseLcov = require("parse-lcov");
const stripColor = require("strip-color");
const stripComments = require("strip-comments");

(async () => {
    const config = jsYaml.load(fs.readFileSync("config.yaml", "utf-8"));
    const csvLines = ["Project,Test Type,# Tests,% Line Coverage,Covered Lines,Total Lines,% Branch Coverage,Covered Branches,Total Branches"];

    for (const [repo, tests] of Object.entries(config.projects)) {
        const tempDir = fs.mkdtempSync(repo.split("/")[0]);
        await gitClone(`https://github.com/${repo}.git`, tempDir);
        await exec.exec("npm", ["install"], { cwd: tempDir });
        await exec.exec("npm", ["run", "build"], { cwd: tempDir });

        for (const [k, v] of Object.entries(tests)) {
            const collectCoverage = typeof v === "string";
            const runTests = collectCoverage || (typeof v === "boolean" && v);

            if (runTests) {
                const output = await exec.getExecOutput("npm", ["run", `test:${k}`], { cwd: tempDir, ignoreReturnCode: true });
                const endOfStderr = stripColor(output.stderr.slice(-1024));
                const numTests = endOfStderr.match(/^Tests:\s+.+, (\d+) total/m)[1];

                if (collectCoverage) {
                    const lcovFile = path.join(tempDir, v, "lcov.info");
                    const lcovInfo = parseLcov.default(fs.readFileSync(lcovFile, "utf-8"));
                    let foundLines = 0;
                    let hitLines = 0;
                    let foundBranches = 0;
                    let hitBranches = 0;
                    for (const { lines, branches } of lcovInfo) {
                        foundLines += lines.found;
                        hitLines += lines.hit;
                        foundBranches += branches.found;
                        hitBranches += branches.hit;
                    }
                    const lineCoverage = (hitLines / foundLines * 100).toFixed(2);
                    const branchCoverage = (hitBranches / foundBranches * 100).toFixed(2);
                    csvLines.push(`${repo},${k},${numTests},${lineCoverage},${hitLines},${foundLines},${branchCoverage},${hitBranches},${foundBranches}`);
                } else {
                    csvLines.push(`${repo},${k},${numTests},,,,,,`);
                }
            } else {
                const output = await exec.getExecOutput("npm", ["run", `test:${k}`, "--", "--listTests"], { cwd: tempDir });
                let numTests = 0;
                for (const testFile of output.stdout.trim().split("\n").filter(line => line.startsWith("/"))) {
                    const testContents = stripComments(fs.readFileSync(testFile, "utf-8"));
                    numTests += (testContents.match(/\bit\(/g) || []).length;
                }
                csvLines.push(`${repo},${k},${numTests},,,,,,`);
            }
        }

        fs.rmdirSync(tempDir, { recursive: true, force: true });
    }

    const date = new Date();
    const year = date.getUTCFullYear().toString();
    const month = padLeft((date.getUTCMonth() + 1).toString(), 2, "0");
    const day = padLeft(date.getUTCDate().toString(), 2, "0");
    const dateDir = path.join("results", year, month);
    fs.mkdirSync(dateDir, { recursive: true });
    fs.writeFileSync(path.join(dateDir, `${day}.csv`), csvLines.join("\n"));
    fs.linkSync(path.join(dateDir, `${day}.csv`), "coverage.csv");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
