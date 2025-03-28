import fs from 'fs';
declare const _default: {
    existsSync: typeof fs.existsSync;
    readFile: typeof fs.readFile.__promisify__;
    watchFile: typeof fs.watchFile;
    createReadStream: typeof fs.createReadStream;
    stat: typeof fs.stat.__promisify__;
};
export default _default;
