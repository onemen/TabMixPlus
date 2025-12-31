export default {
  meta: {
    name: "tabmix-xhtml-processor",
    version: "1.0.0",
  },
  preprocess(text, _filename) {
    const blocks = [];
    const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let i = 0;

    while ((match = regex.exec(text)) !== null) {
      const scriptContent = match[1];
      // Get the start index of the code relative to the whole file
      const startOffset = match.index + match[0].indexOf(scriptContent);

      // Count how many newlines exist before the script content
      const linesBefore = text.slice(0, startOffset).split("\n");
      const lineOffset = linesBefore.length - 1;

      // PAD the code with empty newlines to match the original line count
      // This ensures Line 20 in the virtual file = Line 20 in the XHTML
      let paddedCode = "\n".repeat(lineOffset) + scriptContent;

      // Handle CDATA without shifting characters (replace with spaces)
      paddedCode = paddedCode.replace(/<!\[CDATA\[/g, "           ");
      paddedCode = paddedCode.replace(/\]\]>/g, "      ");

      blocks.push({
        text: paddedCode,
        filename: `${i++}.js`,
      });
    }
    return blocks;
  },
  postprocess(messages) {
    // Since we padded the code, line numbers are already identical.
    // We just flatten the results.
    return messages.flat();
  },
  supportsAutofix: true,
};
