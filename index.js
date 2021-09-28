const fs = require("fs");
const exec = require("@actions/exec");
const gitClone = require("git-clone/promise");
const jsYaml = require("js-yaml");
// const parseLcov = require("parse-lcov");

(async () => {
    const config = jsYaml.load(fs.readFileSync("config.yaml", "utf-8"));

    for (const [repo, tests] of Object.entries(config.projects)) {
        const tempDir = fs.mkdtempSync("zowe");
        await gitClone(`https://github.com/${repo}.git`, tempDir);
        await exec.exec("npm install", { cwd: tempDir });
        await exec.exec("npm run build", { cwd: tempDir });

        for (const [k, v] of Object.entries(tests)) {
            const jestArgs = (typeof v === "boolean" && v) ? "-- --listTests" : "";
            await exec.exec(`npm run test:${k} ${jestArgs}`, { cwd: tempDir });
        }

        fs.rmdirSync(tempDir, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
