/* eslint-disable no-console */
const fs = require("fs");
const child_process = require('child_process');

const inputFile = "./tsc.local.txt";
const outputFile = "./tsc.clean.local.txt";

function filterLines(input, output) {
  fs.readFile(input, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }

    const lines = []
    for (const line of data.split("\n")) {
      if (line.startsWith(" ")) {
        lines[lines.length-1] = lines.at(-1) + "\n" + line;
      } else {
        lines.push(line);
      }
    }
    const prefixes = ["addon", "config", "types"];
    const filteredLines = lines.filter(line => prefixes.some(prefix => line.startsWith(prefix)));
    const cleanData = filteredLines.length ? filteredLines.join("\n") : "No errors found!";

    try {
      fs.writeFileSync(output, cleanData, "utf8");
      console.log(`File ${outputFile} written successfully!`);
    } catch (err) {
      console.error("Error writing file:", err);
    }
  });
}
function main() {
  // clear previous output
  fs.writeFileSync(outputFile, "", "utf8")

  // Execute TypeScript compilation
  try {
    child_process.execSync(`tsc -b -f> ${inputFile}`);
  } catch {}

  // Call your filterLines function
  filterLines(inputFile, outputFile);

  // Delete the input file
  fs.unlinkSync(inputFile);
}

main();