export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow iterating a tabbrowser's .browsers list, which materializes lazy session-restored tabs",
      category: "Possible Errors",
      recommended: false,
    },
    schema: [],
    messages: {
      noBrowsersIteration:
        'Iterating {{name}}.browsers materializes every lazy (session-restored) tab: the browsers proxy returns tab.linkedBrowser, which inserts a <browser> and a docShell into each lazy tab it touches. Iterate {{name}}.tabs instead and skip tabs with an empty tab.linkedPanel, or read the lazy tab url with SessionStore.getLazyTabValue(tab, "url") (see issue #587).',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    // reading these members off the browsers proxy does not touch linkedBrowser
    const safeMembers = new Set(["length", "includes", "indexOf"]);

    /**
     * Get a display name for the object holding `.browsers`, or null when the
     * object is not clearly a tabbrowser (identifier ending in "Browser", e.g.
     * gBrowser / tabBrowser / aTabBrowser, or a member expression ending in
     * .gBrowser such as win.gBrowser).
     *
     * @param {import("estree").MemberExpression} node
     * @returns {string | null}
     */
    function getHolderName(node) {
      if (node.object.type === "Identifier") {
        return /Browser$/.test(node.object.name) ? node.object.name : null;
      }
      if (
        node.object.type === "MemberExpression" &&
        node.object.property.type === "Identifier" &&
        node.object.property.name === "gBrowser" &&
        !node.object.computed
      ) {
        return sourceCode.getText(node.object);
      }
      return null;
    }

    /**
     * Heuristic: consider the sweep guarded when an enclosing condition or
     * ternary test mentions linkedPanel or the pending attribute, e.g. `if
     * (tab.linkedPanel) tabs.forEach(...)`.
     *
     * @param {import("estree").MemberExpression} node - the `.browsers` member
     * @returns {boolean}
     */
    function hasLazyTabGuard(node) {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.type === "Program") {
          break;
        }
        if (parent.type === "IfStatement" || parent.type === "ConditionalExpression") {
          if (/linkedPanel|hasAttribute\((["'])pending\1/.test(sourceCode.getText(parent.test))) {
            return true;
          }
        }
      }
      return false;
    }

    return {
      MemberExpression(node) {
        if (
          node.computed ||
          node.property.type !== "Identifier" ||
          node.property.name !== "browsers"
        ) {
          return;
        }

        const name = getHolderName(node);
        if (!name) {
          return;
        }

        const parent = node.parent;

        // proxy members and single-element access do not sweep tabs
        if (
          parent.type === "MemberExpression" &&
          ((parent.computed && parent.object === node) ||
            (!parent.computed &&
              parent.property.type === "Identifier" &&
              safeMembers.has(parent.property.name)))
        ) {
          return;
        }

        if (hasLazyTabGuard(node)) {
          return;
        }

        context.report({node, messageId: "noBrowsersIteration", data: {name}});
      },
    };
  },
};
