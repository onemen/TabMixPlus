export default {
  meta: {
    type: "problem",
    docs: {
      description: "Ensure lazyGetter second argument matches the getter name",
      category: "Possible Errors",
      recommended: true,
    },
    fixable: "code",
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        // Check if it's a lazyGetter call
        if (
          !["Property", "MemberExpression"].includes(callee.type) ||
          callee.property.name !== "lazyGetter"
        ) {
          return;
        }

        // Check if it's called on 'this' or 'Tabmix'
        if (callee.object.type !== "ThisExpression" && callee.object.name !== "Tabmix") {
          return;
        }

        // let currentNode = node.parent;
        // while (currentNode && !types.includes(currentNode.type)) {
        //   currentNode = currentNode.parent;
        // }
        let currentNode = node.parent;
        while (currentNode && !["Property", "MethodDefinition"].includes(currentNode.type)) {
          currentNode = currentNode.parent;
        }

        if (!currentNode || currentNode.kind !== "get") {
          return;
        }

        const getterName = currentNode.key.name;
        const lazyGetterNameArg = node.arguments[1];

        if (lazyGetterNameArg.type !== "Literal" || lazyGetterNameArg.value !== getterName) {
          context.report({
            node: lazyGetterNameArg,
            message: `lazyGetter name argument "${lazyGetterNameArg.value}" should match getter name "${getterName}"`,
            fix(fixer) {
              return fixer.replaceText(lazyGetterNameArg, `"${getterName}"`);
            },
          });
        }
      },
    };
  },
};
