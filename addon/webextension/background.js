'use strict';

const MIGRATE = 'tabmix.session.migrate.';

const port = browser.runtime.connect({name: 'tabmix-storage-port'});

function updateSessionsData(message) {
  const {add, remove, messageID, saveBackup} = message;
  const asyncResult = [Promise.resolve()];

  if (remove) {
    remove.messageID = message.messageID + '.remove';
    asyncResult.push(storageMethods('remove', remove));
  }

  if (add) {
    add.messageID = message.messageID + '.add';
    asyncResult.push(storageMethods('set', add));
  }

  if (saveBackup) {
    const postMessage = () => {
      port.postMessage({messageID, saveBackup});
    };
    Promise.all(asyncResult).then(postMessage).catch(postMessage);
  }
}

function getHashList({messageID}) {
  browser.storage.local.get().then(result => {
    return Object.keys(result).filter(key => key.startsWith(MIGRATE));
  }).then(result => port.postMessage({messageID, result}))
      .catch(error => port.postMessage({messageID, error}));
}

function storageMethods(methods, message) {
  const handler = browser.storage.local[methods];

  if (typeof handler != 'function') {
    throw new Error('Unexpected message.type: ' + methods);
  }

  return handler(message.keys).then((result = {}) => {
    const {messageID, successMsg} = message;
    port.postMessage({
      messageID,
      type: methods,
      successMsg,
      result,
    });
  }).catch(error => {
    const {messageID, keys, errorMsg} = message;
    console.error('Tabmix:\n', error);
    error = getErrorMsg(methods, keys, errorMsg, error);
    port.postMessage({
      messageID,
      type: methods,
      error,
    });
  });
}

port.onMessage.addListener(message => {
  if (message.type == 'update') {
    updateSessionsData(message);
  } else if (message.type == 'getHashList') {
    getHashList(message);
  } else {
    storageMethods(message.type, message);
  }
});

function getErrorMsg(name, key, errorMsg, error) {
  let keyVal;
  if (typeof key == 'string') {
    keyVal = key;
  } else if (Array.isArray(key)) {
    keyVal = key.join('\n');
  } else if (Object.keys(key).length == 1) {
    keyVal = Object.keys[0];
  }
  const forKey = keyVal ? `for ${keyVal}, ` : '';
  return `browser.storage.local.${name} ${forKey}${errorMsg}.\n${error}`;
}
