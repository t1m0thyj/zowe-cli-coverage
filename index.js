const fs = require("fs");
const path = require("path");
const exec = require("@actions/exec");
const gitClone = require("git-clone/promise");
const jsYaml = require("js-yaml");
const parseLcov = require("parse-lcov");
const uglifyJs = require("uglify-js");

(async () => {
    const config = jsYaml.load(fs.readFileSync("config.yaml", "utf-8"));
    const csvLines = ["Project,Test Type,# Tests,% Coverage,Covered Lines,Total Lines"];

    for (const [repo, tests] of Object.entries(config.projects)) {
        const tempDir = fs.mkdtempSync("zowe");
        await gitClone(`https://github.com/${repo}.git`, tempDir);
        await exec.exec("npm", ["install"], { cwd: tempDir });
        await exec.exec("npm", ["run", "build"], { cwd: tempDir });

        for (const [k, v] of Object.entries(tests)) {
            const collectCoverage = !(typeof v === "boolean" && v);
            if (collectCoverage && typeof v !== "string") {
                continue;
            }

            if (collectCoverage) {
                const output = await exec.getExecOutput("npm", ["run", `test:${k}`], { cwd: tempDir });
                const numTests = parseInt(output.stderr.match(/^Tests:\s+.+, (\d+) total/m)[1]);
                const lcovFile = path.join(tempDir, v, "lcov.info");
                const lcovInfo = parseLcov(fs.readFileSync(lcovFile, "utf-8"));
                let foundLines = 0;
                let hitLines = 0;
                for (const record of lcovInfo) {
                    foundLines += record.found;
                    hitLines += record.hit;
                }
                const percentCoverage = (hitLines / foundLines * 100).toFixed(2);
                csvLines.push(`${repo},${k},${numTests},${percentCoverage},${hitLines},${foundLines}`);
            } else {
                const output = await exec.getExecOutput("npm", ["run", `test:${k}`, "--", "--listTests"], { cwd: tempDir });
                let numTests = 0;
                for (const testFile in output.stdout.split("\n")) {
                    const testContents = fs.readFileSync(testFile, "utf-8");
                    const minTestContents = uglifyJs.minify(testContents).code;
                    numTests += (minTestContents.match(/\bit\(/g) || []).length;
                }
                csvLines.push(`${repo},${k},${numTests}`);
            }
        }

        fs.rmdirSync(tempDir, { recursive: true, force: true });
    }

    const date = new Date();
    const year = date.getFullYear().toString();
    const month = ("0" + date.getMonth().toString()).slice(-2);
    const day = ("0" + date.getDay().toString()).slice(-2);
    const dateDir = path.join("results", year, month);
    fs.mkdirSync(dateDir, { recursive: true });
    fs.writeFileSync(path.join(dateDir, `${day}.csv`), csvLines.join("\n"));
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
