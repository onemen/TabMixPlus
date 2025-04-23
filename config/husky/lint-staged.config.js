/** @type {import("lint-staged").Config} */
export default {
  "*": files => {
    const commands = [];

    // ESLint (Flat config handles file filtering)
    commands.push(
      `eslint --fix --format stylish --cache --cache-location config/.eslintcache --no-warn-ignored ${files.join(" ")}`
    );

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
