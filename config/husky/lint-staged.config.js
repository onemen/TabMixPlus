/** @type {import("lint-staged").Config} */
export default {
  "*": files => {
    const commands = [];

    // Filter for lintable files, excluding config directory
    const lintableFiles = files.filter(
      f => /\.(js|mjs|ts|jsx|tsx|html|xhtml)$/.test(f) && !f.startsWith("config/")
    );

    if (lintableFiles.length) {
      commands.push(
        `npx eslint --no-warn-ignored --report-unused-disable-directives --max-warnings 0 ${lintableFiles.join(" ")}`
      );
    }

    // stylelint only for addon/**/*.css
    const stylelintFiles = files.filter(f => /^addon\/.*\.css$/.test(f));
    if (stylelintFiles.length) {
      commands.push(
        `stylelint --fix --config config/.stylelintrc.json ${stylelintFiles.join(" ")}`
      );
    }

    return commands;
  },
};
